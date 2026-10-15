/**
 * QM Editor Document Recovery, Autosave & Crash-Safe Unsaved Work Tests
 * Phase 05, Step 52 — Document Recovery, Autosave & Crash-Safe Unsaved Work Foundation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DocumentRecoveryCoordinator } from './DocumentRecoveryCoordinator';
import { DocumentRecoveryRepository } from '../storage/repositories/DocumentRecoveryRepository';
import { StorageService } from '../storage/StorageService';
import { MemoryStorageAdapter } from '../storage/adapters/MemoryStorageAdapter';
import { DocumentEngine } from '../documents/DocumentEngine';
import { StorageSerializer } from '../storage/serialization/StorageSerializer';
import {
  RecoveryDocumentDTO,
  RecoveryManifestDTO,
  RecoverySnapshotDTO,
} from '../storage/StorageTypes';

describe('Phase 05, Step 52 — Document Recovery, Autosave & Crash-Safe Unsaved Work Foundation', () => {
  let storageAdapter: MemoryStorageAdapter;
  let storageService: StorageService;
  let repository: DocumentRecoveryRepository;
  let documentEngine: DocumentEngine;
  let coordinator: DocumentRecoveryCoordinator;

  beforeEach(async () => {
    storageAdapter = new MemoryStorageAdapter();
    storageService = new StorageService({ adapter: storageAdapter });
    await storageService.initialize();

    repository = new DocumentRecoveryRepository(storageService);
    documentEngine = new DocumentEngine();

    coordinator = new DocumentRecoveryCoordinator({
      documentEngine,
      repository,
      autoSaveDelayMs: 50, // fast debounce for testing
      enabled: true,
    } as any);
  });

  afterEach(async () => {
    await coordinator.dispose();
    await documentEngine.dispose();
    await storageService.dispose();
  });

  // ===========================================================================
  // 1. Session Lifecycle & Clean Shutdown Detection
  // ===========================================================================

  describe('1. Session Lifecycle & Clean Shutdown Detection', () => {
    it('initializes active session and writes unconfirmed active manifest', async () => {
      const discovery = await coordinator.initialize('session_test_1', 'ws-test-1');

      expect(coordinator.getActiveSessionId()).toBe('session_test_1');
      expect(discovery.wasAbnormalTermination).toBe(false);

      const activeSession = await repository.getActiveSession();
      expect(activeSession).not.toBeNull();
      expect(activeSession?.sessionId).toBe('session_test_1');
      expect(activeSession?.state).toBe('active');

      const manifest = await repository.getManifest('session_test_1');
      expect(manifest).not.toBeNull();
      expect(manifest?.state).toBe('active');
      expect(manifest?.documents).toEqual([]);
    });

    it('marks session and manifest clean on graceful shutdown', async () => {
      await coordinator.initialize('session_test_clean', 'ws-clean');
      await coordinator.markSessionClean();

      const activeSession = await repository.getActiveSession();
      expect(activeSession?.state).toBe('clean');

      const manifest = await repository.getManifest('session_test_clean');
      expect(manifest?.state).toBe('clean');
    });

    it('detects abnormal termination if previous session was never marked clean', async () => {
      // 1. Simulate crashed session that left an active/unconfirmed state
      const crashedSessionId = 'session_crashed_1';
      await repository.setActiveSession({
        sessionId: crashedSessionId,
        startedAt: Date.now() - 5000,
        lastUpdatedAt: Date.now() - 5000,
        state: 'active',
        schemaVersion: 1,
      });

      const snapshot: RecoverySnapshotDTO = {
        version: 1,
        recoveryId: `rec_${crashedSessionId}_doc1`,
        sessionId: crashedSessionId,
        documentId: 'doc1',
        resourceUri: 'file:///workspace/main.ts',
        isUntitled: false,
        documentRevision: 3,
        recoveryGeneration: 1,
        content: 'const recovered = true;',
        encoding: 'utf-8',
        lineEnding: 'lf',
        baseFileMetadata: {
          path: 'file:///workspace/main.ts',
          size: 10,
          modifiedAt: 1000,
          fingerprint: '10_1000',
        },
        checksum: StorageSerializer.computeChecksum('const recovered = true;'),
        createdAt: Date.now() - 4000,
      };
      await repository.saveSnapshot(snapshot);

      const manifest: RecoveryManifestDTO = {
        version: 1,
        sessionId: crashedSessionId,
        startedAt: Date.now() - 5000,
        lastUpdatedAt: Date.now() - 4000,
        state: 'active',
        documents: [
          {
            recoveryId: snapshot.recoveryId,
            sessionId: crashedSessionId,
            workspaceId: 'ws-crashed',
            documentId: 'doc1',
            resourceUri: 'file:///workspace/main.ts',
            isUntitled: false,
            documentTitle: 'main.ts',
            documentRevision: 3,
            recoveryGeneration: 1,
            dirty: true,
            baseFileMetadata: snapshot.baseFileMetadata,
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.createdAt,
          },
        ],
      };
      await repository.saveManifest(manifest);

      // 2. Start a fresh session and discover candidates
      const newCoordinator = new DocumentRecoveryCoordinator({
        documentEngine,
        repository,
        autoSaveDelayMs: 50,
      } as any);

      const discovery = await newCoordinator.initialize('session_fresh', 'ws-crashed');

      expect(discovery.wasAbnormalTermination).toBe(true);
      expect(discovery.previousSessionId).toBe(crashedSessionId);
      expect(discovery.candidates.length).toBe(1);
      expect(discovery.candidates[0].candidate.documentTitle).toBe('main.ts');
      expect(discovery.candidates[0].decision).toBe('recovery_available');

      await newCoordinator.dispose();
    });
  });

  // ===========================================================================
  // 2. Autosave Scheduling, Coalescing & Race Protection
  // ===========================================================================

  describe('2. Autosave Scheduling, Coalescing & Race Protection', () => {
    it('creates recovery snapshot after configured delay when document is dirty', async () => {
      await coordinator.initialize('session_autosave_1');

      const doc = await documentEngine.createUntitled({
        title: 'Untitled-1',
        content: 'Initial text',
      });

      // Advance dirty revision
      await documentEngine.updateText(doc.id, 'Unsaved modification', 'user');
      expect(doc.isDirty).toBe(true);

      // Wait for debounced autosave
      await new Promise((resolve) => setTimeout(resolve, 80));

      const recoveryId = `rec_session_autosave_1_${doc.id}`;
      const snapshot = await repository.getSnapshot(recoveryId);

      expect(snapshot).not.toBeNull();
      expect(snapshot?.content).toBe('Unsaved modification');
      expect(snapshot?.documentRevision).toBe(doc.contentRevision);
      expect(snapshot?.checksum).toBe(
        StorageSerializer.computeChecksum('Unsaved modification')
      );
    });

    it('coalesces rapid multiple edits into a single final snapshot write', async () => {
      await coordinator.initialize('session_coalesce_1');

      const doc = await documentEngine.createUntitled({
        title: 'Untitled-Rapid',
        content: 'Start',
      });

      // 5 rapid edits in bursts
      await documentEngine.updateText(doc.id, 'Edit 1', 'user');
      await documentEngine.updateText(doc.id, 'Edit 2', 'user');
      await documentEngine.updateText(doc.id, 'Edit 3', 'user');
      await documentEngine.updateText(doc.id, 'Edit 4', 'user');
      await documentEngine.updateText(doc.id, 'Final Coalesced Content', 'user');

      // Wait for quiet period
      await new Promise((resolve) => setTimeout(resolve, 80));

      const recoveryId = `rec_session_coalesce_1_${doc.id}`;
      const snapshot = await repository.getSnapshot(recoveryId);

      expect(snapshot).not.toBeNull();
      expect(snapshot?.content).toBe('Final Coalesced Content');
      expect(snapshot?.documentRevision).toBe(doc.contentRevision);

      const manifest = await repository.getManifest('session_coalesce_1');
      expect(manifest?.documents.length).toBe(1);
      expect(manifest?.documents[0].documentRevision).toBe(doc.contentRevision);
    });

    it('prevents older snapshot generation from overwriting a newer generation', async () => {
      await coordinator.initialize('session_race_1');

      const doc = await documentEngine.createUntitled({
        title: 'Untitled-Race',
        content: 'Original',
      });

      await documentEngine.updateText(doc.id, 'Content Gen 1', 'user');
      // Force snapshot gen 1 with simulated slow write
      const gen1Promise = coordinator.createRecoverySnapshot(doc.id, 1);

      // Immediately advance to Gen 2
      await documentEngine.updateText(doc.id, 'Content Gen 2 (Winner)', 'user');
      const gen2Snapshot = await coordinator.createRecoverySnapshot(doc.id, 2);
      expect(gen2Snapshot).not.toBeNull();

      await gen1Promise;

      const recoveryId = `rec_session_race_1_${doc.id}`;
      const finalSnapshot = await repository.getSnapshot(recoveryId);

      expect(finalSnapshot?.content).toBe('Content Gen 2 (Winner)');
      expect(finalSnapshot?.recoveryGeneration).toBe(2);
    });
  });

  // ===========================================================================
  // 3. Autosave Cancellation on Save and Close
  // ===========================================================================

  describe('3. Autosave Cancellation on Save and Close', () => {
    it('cancels pending autosave timer and deletes snapshot upon successful save', async () => {
      await coordinator.initialize('session_save_clean');

      const fileResource = {
        uri: 'file:///workspace/script.ts',
        name: 'script.ts',
        extension: 'ts',
        readOnly: false,
        exists: true,
        size: 20,
        modifiedTime: 5000,
      };

      const { document: doc } = await documentEngine.openResource(
        fileResource.uri,
        { initialContent: 'console.log("hello");' }
      );

      // Make dirty
      await documentEngine.updateText(doc.id, 'console.log("updated");', 'user');

      // Wait for snapshot creation
      await new Promise((resolve) => setTimeout(resolve, 80));

      const recoveryId = `rec_session_save_clean_${doc.id}`;
      expect(await repository.getSnapshot(recoveryId)).not.toBeNull();

      // Normal save completes
      await documentEngine.save(doc.id);

      // Verify snapshot is immediately cleaned up
      expect(await repository.getSnapshot(recoveryId)).toBeNull();

      const manifest = await repository.getManifest('session_save_clean');
      expect(manifest?.documents.length).toBe(0);
    });

    it('cancels pending autosave timer upon document close', async () => {
      await coordinator.initialize('session_close_clean');

      const doc = await documentEngine.createUntitled({
        title: 'Untitled-Close',
        content: 'To be closed',
      });

      await documentEngine.updateText(doc.id, 'dirty text', 'user');

      // Close before timer fires
      await documentEngine.close(doc.id, true);

      // Wait past debounce period
      await new Promise((resolve) => setTimeout(resolve, 80));

      const recoveryId = `rec_session_close_clean_${doc.id}`;
      expect(await repository.getSnapshot(recoveryId)).toBeNull();
    });
  });

  // ===========================================================================
  // 4. Candidate Evaluation & Conflict Handling
  // ===========================================================================

  describe('4. Candidate Evaluation & Conflict Handling', () => {
    it('evaluates untouched disk file as recovery_available', async () => {
      const candidate: RecoveryDocumentDTO = {
        recoveryId: 'rec_eval_1',
        sessionId: 'session_old',
        documentId: 'doc1',
        resourceUri: 'file:///app/config.json',
        isUntitled: false,
        documentTitle: 'config.json',
        documentRevision: 2,
        recoveryGeneration: 1,
        dirty: true,
        baseFileMetadata: {
          path: 'file:///app/config.json',
          size: 50,
          modifiedAt: 1000,
          fingerprint: '50_1000',
        },
        createdAt: 2000,
        updatedAt: 2000,
      };

      const snapshot: RecoverySnapshotDTO = {
        version: 1,
        recoveryId: 'rec_eval_1',
        sessionId: 'session_old',
        documentId: 'doc1',
        resourceUri: 'file:///app/config.json',
        isUntitled: false,
        documentRevision: 2,
        recoveryGeneration: 1,
        content: '{ "port": 8080 }',
        encoding: 'utf-8',
        lineEnding: 'lf',
        baseFileMetadata: candidate.baseFileMetadata,
        checksum: StorageSerializer.computeChecksum('{ "port": 8080 }'),
        createdAt: 2000,
      };

      await repository.saveSnapshot(snapshot);

      const evaluation = await coordinator.evaluateCandidate(candidate);
      expect(evaluation.decision).toBe('recovery_available');
    });

    it('evaluates candidate as conflict if disk file was modified after snapshot base', async () => {
      // Pre-open the file in document engine with a newer disk timestamp
      const openRes = await documentEngine.openResource('file:///app/server.ts', {
        initialContent: 'const diskVersion = 2;',
      });
      (openRes.document.metadata as { modifiedTime?: number }).modifiedTime = 5000; // newer than base 1000

      const candidate: RecoveryDocumentDTO = {
        recoveryId: 'rec_eval_conflict',
        sessionId: 'session_old',
        documentId: 'doc2',
        resourceUri: 'file:///app/server.ts',
        isUntitled: false,
        documentTitle: 'server.ts',
        documentRevision: 2,
        recoveryGeneration: 1,
        dirty: true,
        baseFileMetadata: {
          path: 'file:///app/server.ts',
          size: 20,
          modifiedAt: 1000, // old base
        },
        createdAt: 2000,
        updatedAt: 2000,
      };

      const snapshot: RecoverySnapshotDTO = {
        version: 1,
        recoveryId: 'rec_eval_conflict',
        sessionId: 'session_old',
        documentId: 'doc2',
        resourceUri: 'file:///app/server.ts',
        isUntitled: false,
        documentRevision: 2,
        recoveryGeneration: 1,
        content: 'const memoryUnsavedVersion = 3;',
        encoding: 'utf-8',
        lineEnding: 'lf',
        baseFileMetadata: candidate.baseFileMetadata,
        checksum: StorageSerializer.computeChecksum(
          'const memoryUnsavedVersion = 3;'
        ),
        createdAt: 2000,
      };

      await repository.saveSnapshot(snapshot);

      const evaluation = await coordinator.evaluateCandidate(candidate);
      expect(evaluation.decision).toBe('conflict');
      expect(evaluation.explanation).toContain('Both recovery snapshot and disk file were modified');
    });

    it('evaluates candidate as corrupt if snapshot checksum fails', async () => {
      const candidate: RecoveryDocumentDTO = {
        recoveryId: 'rec_corrupt_1',
        sessionId: 'session_old',
        documentId: 'doc_corrupt',
        resourceUri: 'file:///app/corrupt.ts',
        isUntitled: false,
        documentTitle: 'corrupt.ts',
        documentRevision: 1,
        recoveryGeneration: 1,
        dirty: true,
        createdAt: 1000,
        updatedAt: 1000,
      };

      const snapshot: RecoverySnapshotDTO = {
        version: 1,
        recoveryId: 'rec_corrupt_1',
        sessionId: 'session_old',
        documentId: 'doc_corrupt',
        resourceUri: 'file:///app/corrupt.ts',
        isUntitled: false,
        documentRevision: 1,
        recoveryGeneration: 1,
        content: 'Tampered content',
        encoding: 'utf-8',
        lineEnding: 'lf',
        checksum: 'invalid_bogus_checksum',
        createdAt: 1000,
      };

      await repository.saveSnapshot(snapshot);

      const evaluation = await coordinator.evaluateCandidate(candidate);
      expect(evaluation.decision).toBe('corrupt');
    });
  });

  // ===========================================================================
  // 5. Safe Restoration Semantics
  // ===========================================================================

  describe('5. Safe Restoration Semantics', () => {
    it('restores existing file safely: leaves disk untouched and marks document dirty', async () => {
      await coordinator.initialize('session_restore_1');

      const fileUri = 'file:///workspace/app.js';
      // Baseline disk content
      await documentEngine.openResource(fileUri, {
        initialContent: 'console.log("disk content");',
      });

      const snapshot: RecoverySnapshotDTO = {
        version: 1,
        recoveryId: 'rec_restore_app',
        sessionId: 'session_prev',
        documentId: 'doc_app',
        resourceUri: fileUri,
        isUntitled: false,
        documentRevision: 4,
        recoveryGeneration: 1,
        content: 'console.log("recovered content");',
        encoding: 'utf-8',
        lineEnding: 'lf',
        checksum: StorageSerializer.computeChecksum(
          'console.log("recovered content");'
        ),
        createdAt: Date.now() - 1000,
      };
      await repository.saveSnapshot(snapshot);

      const result = await coordinator.restoreCandidate(snapshot.recoveryId);

      expect(result.status).toBe('restored');
      expect(result.isDirty).toBe(true);
      expect(result.isUntitled).toBe(false);

      const doc = documentEngine.getByResource(fileUri);
      expect(doc).toBeDefined();
      expect(doc?.content).toBe('console.log("recovered content");');
      expect(doc?.savedBaselineContent).toBe('console.log("disk content");');
      expect(doc?.isDirty).toBe(true);

      // Snapshot discarded after safe restore
      expect(await repository.getSnapshot(snapshot.recoveryId)).toBeNull();
    });

    it('restores untitled document safely without creating fake filesystem path', async () => {
      await coordinator.initialize('session_restore_untitled');

      const snapshot: RecoverySnapshotDTO = {
        version: 1,
        recoveryId: 'rec_restore_untitled',
        sessionId: 'session_prev',
        documentId: 'doc_untitled',
        isUntitled: true,
        documentRevision: 2,
        recoveryGeneration: 1,
        content: 'Draft notes in untitled',
        encoding: 'utf-8',
        lineEnding: 'lf',
        checksum: StorageSerializer.computeChecksum('Draft notes in untitled'),
        createdAt: Date.now() - 2000,
      };
      await repository.saveSnapshot(snapshot);

      const result = await coordinator.restoreCandidate(snapshot.recoveryId);

      expect(result.status).toBe('restored');
      expect(result.isUntitled).toBe(true);
      expect(result.isDirty).toBe(true);

      const restoredDoc = documentEngine.getDocument(result.documentId!);
      expect(restoredDoc).toBeDefined();
      expect(restoredDoc?.content).toBe('Draft notes in untitled');
      expect(restoredDoc?.resource.scheme).toBe('untitled');
      expect(restoredDoc?.resourceUri.startsWith('untitled:')).toBe(true);
      expect(restoredDoc?.filePath).toBeUndefined();
    });

    it('discards recovery candidate without touching disk', async () => {
      const snapshot: RecoverySnapshotDTO = {
        version: 1,
        recoveryId: 'rec_discard_me',
        sessionId: 'session_prev',
        documentId: 'doc_discard',
        isUntitled: true,
        documentRevision: 1,
        recoveryGeneration: 1,
        content: 'To be thrown away',
        encoding: 'utf-8',
        lineEnding: 'lf',
        checksum: StorageSerializer.computeChecksum('To be thrown away'),
        createdAt: Date.now(),
      };
      await repository.saveSnapshot(snapshot);

      const manifest: RecoveryManifestDTO = {
        version: 1,
        sessionId: 'session_prev',
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        state: 'active',
        documents: [
          {
            recoveryId: snapshot.recoveryId,
            sessionId: 'session_prev',
            documentId: 'doc_discard',
            isUntitled: true,
            documentTitle: 'Discard',
            documentRevision: 1,
            recoveryGeneration: 1,
            dirty: true,
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.createdAt,
          },
        ],
      };
      await repository.saveManifest(manifest);

      const discarded = await coordinator.discardCandidate('rec_discard_me');
      expect(discarded).toBe(true);
      expect(await repository.getSnapshot('rec_discard_me')).toBeNull();

      const updatedManifest = await repository.getManifest('session_prev');
      expect(updatedManifest?.documents.length).toBe(0);
    });
  });

  // ===========================================================================
  // 6. Workspace Isolation
  // ===========================================================================

  describe('6. Workspace Isolation', () => {
    it('isolates recovery candidates between workspaces', async () => {
      const snapshotA: RecoverySnapshotDTO = {
        version: 1,
        recoveryId: 'rec_ws_A',
        sessionId: 'session_ws_A',
        documentId: 'docA',
        resourceUri: 'file:///wsA/file.ts',
        isUntitled: false,
        documentRevision: 1,
        recoveryGeneration: 1,
        content: 'code A',
        encoding: 'utf-8',
        lineEnding: 'lf',
        checksum: StorageSerializer.computeChecksum('code A'),
        createdAt: 1000,
      };
      await repository.saveSnapshot(snapshotA);

      const manifestA: RecoveryManifestDTO = {
        version: 1,
        sessionId: 'session_ws_A',
        workspaceId: 'workspace_A',
        startedAt: 1000,
        lastUpdatedAt: 1000,
        state: 'active',
        documents: [
          {
            recoveryId: 'rec_ws_A',
            sessionId: 'session_ws_A',
            workspaceId: 'workspace_A',
            documentId: 'docA',
            resourceUri: 'file:///wsA/file.ts',
            isUntitled: false,
            documentTitle: 'file.ts',
            documentRevision: 1,
            recoveryGeneration: 1,
            dirty: true,
            createdAt: 1000,
            updatedAt: 1000,
          },
        ],
      };
      await repository.saveManifest(manifestA);

      // Query for workspace_B
      const discoveryB = await coordinator.discoverCandidates('workspace_B');
      expect(discoveryB.candidates.length).toBe(0);

      // Query for workspace_A
      const discoveryA = await coordinator.discoverCandidates('workspace_A');
      expect(discoveryA.candidates.length).toBe(1);
      expect(discoveryA.candidates[0].candidate.workspaceId).toBe('workspace_A');
    });
  });

  // ===========================================================================
  // 7. Storage Failure & Resilience
  // ===========================================================================

  describe('7. Storage Failure Resilience', () => {
    it('remains operational and leaves editor unaffected if recovery write fails', async () => {
      await coordinator.initialize('session_failure_test');

      // Mock repository to throw an error on saveSnapshot
      vi.spyOn(repository, 'saveSnapshot').mockRejectedValueOnce(
        new Error('Disk write I/O error')
      );

      const doc = await documentEngine.createUntitled({
        title: 'Untitled-Fail',
        content: 'initial',
      });

      await documentEngine.updateText(doc.id, 'modified text', 'user');

      // Wait for autosave attempt
      await new Promise((resolve) => setTimeout(resolve, 80));

      const health = coordinator.getHealth();
      expect(health.state).toBe('degraded');
      expect(health.issues.length).toBeGreaterThan(0);

      // Verify DocumentEngine is completely unbroken!
      expect(doc.isDirty).toBe(true);
      await documentEngine.updateText(doc.id, 'further editing works', 'user');
      expect(doc.content).toBe('further editing works');
    });
  });
});
