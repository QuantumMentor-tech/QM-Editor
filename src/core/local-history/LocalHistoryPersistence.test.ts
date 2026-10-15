/**
 * QM Editor Local History, Document Snapshots & Versioned Content Persistence Tests
 * Phase 05, Step 53 — Local History, Document Snapshots & Versioned Content Persistence
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalHistoryCoordinator } from './LocalHistoryCoordinator';
import { LocalHistoryRepository } from '../storage/repositories/LocalHistoryRepository';
import { DocumentRecoveryRepository } from '../storage/repositories/DocumentRecoveryRepository';
import { StorageService } from '../storage/StorageService';
import { MemoryStorageAdapter } from '../storage/adapters/MemoryStorageAdapter';
import { DocumentEngine } from '../documents/DocumentEngine';
import { StorageSerializer } from '../storage/serialization/StorageSerializer';

describe('Phase 05, Step 53 — Local History, Document Snapshots & Versioned Content Persistence', () => {
  let storageAdapter: MemoryStorageAdapter;
  let storageService: StorageService;
  let historyRepository: LocalHistoryRepository;
  let recoveryRepository: DocumentRecoveryRepository;
  let documentEngine: DocumentEngine;
  let coordinator: LocalHistoryCoordinator;

  beforeEach(async () => {
    storageAdapter = new MemoryStorageAdapter();
    storageService = new StorageService({ adapter: storageAdapter });
    await storageService.initialize();

    historyRepository = new LocalHistoryRepository(storageService);
    recoveryRepository = new DocumentRecoveryRepository(storageService);
    documentEngine = new DocumentEngine();

    coordinator = new LocalHistoryCoordinator({
      storageService,
      repository: historyRepository,
      documentEngine,
      enabled: true,
      maxEntriesPerFile: 5, // small limit for testing retention pruning
      retentionDays: 30,
      maxStorageBytes: 10 * 1024 * 1024,
    } as any);
    await coordinator.initialize();
  });

  afterEach(async () => {
    await coordinator.dispose();
    await documentEngine.dispose();
    await storageService.dispose();
  });

  // ===========================================================================
  // 1. Snapshot Creation, Metadata & Serialization
  // ===========================================================================

  describe('1. Snapshot Creation, Metadata & Serialization', () => {
    it('creates a snapshot with accurate metadata, checksum and content', async () => {
      const openRes = await documentEngine.openResource('file:///src/main.ts', {
        initialContent: 'console.log("Hello World");\n',
      });
      const doc = openRes.document;

      const entry = await coordinator.createSnapshot(doc.id, 'manual', {
        label: 'Initial Checkpoint',
      });

      expect(entry).not.toBeNull();
      expect(entry?.documentId).toBe(doc.id);
      expect(entry?.resourceUri).toBe('file:///src/main.ts');
      expect(entry?.source).toBe('manual');
      expect(entry?.label).toBe('Initial Checkpoint');
      expect(entry?.contentSize).toBe(doc.content.length);
      expect(entry?.contentHash).toBe(StorageSerializer.computeChecksum(doc.content));
      expect(entry?.lineEnding).toBe('lf');

      // Verify content stored in repository
      const content = await coordinator.getSnapshotContent(entry!.id);
      expect(content).toBe('console.log("Hello World");\n');
    });

    it('creates snapshots automatically upon document save', async () => {
      const openRes = await documentEngine.openResource('file:///src/app.ts', {
        initialContent: 'const a = 1;',
      });
      const doc = openRes.document;

      // Update text and save
      await documentEngine.updateText(doc.id, 'const a = 2;', 'user');
      await documentEngine.save(doc.id);

      const history = await coordinator.getHistory(doc.id);
      expect(history.length).toBe(1);
      expect(history[0].source).toBe('save');
      expect(history[0].contentHash).toBe(StorageSerializer.computeChecksum('const a = 2;'));

      const content = await coordinator.getSnapshotContent(history[0].id);
      expect(content).toBe('const a = 2;');
    });

    it('coalesces repeated saves with identical content without duplicate snapshots', async () => {
      const openRes = await documentEngine.openResource('file:///src/coalesce.ts', {
        initialContent: 'let state = "idle";',
      });
      const doc = openRes.document;

      // First save
      await documentEngine.save(doc.id);
      let history = await coordinator.getHistory(doc.id);
      expect(history.length).toBe(1);

      // Second save with unchanged content
      await documentEngine.save(doc.id);
      history = await coordinator.getHistory(doc.id);
      expect(history.length).toBe(1); // Not duplicated

      // Third save after modifying content
      await documentEngine.updateText(doc.id, 'let state = "running";', 'user');
      await documentEngine.save(doc.id);
      history = await coordinator.getHistory(doc.id);
      expect(history.length).toBe(2);
      expect(history[0].contentHash).toBe(StorageSerializer.computeChecksum('let state = "running";'));
    });
  });

  // ===========================================================================
  // 2. Restore Safety, Dirty State & Undo/Redo Integration
  // ===========================================================================

  describe('2. Restore Safety, Dirty State & Undo/Redo Integration', () => {
    it('restores historical content into in-memory document, marks dirty, and creates pre-restore snapshot', async () => {
      const openRes = await documentEngine.openResource('file:///src/restore.ts', {
        initialContent: 'version 1',
      });
      const doc = openRes.document;

      // Save version 1
      await documentEngine.save(doc.id);
      const historyV1 = (await coordinator.getHistory(doc.id))[0];

      // Advance to version 2 and save
      await documentEngine.updateText(doc.id, 'version 2', 'user');
      await documentEngine.save(doc.id);

      // Now active content is 'version 2' and isDirty is false
      expect(doc.content).toBe('version 2');
      expect(doc.isDirty).toBe(false);

      // Preview history entry v1
      const preview = await coordinator.previewEntry(doc.id, historyV1.id);
      expect(preview.valid).toBe(true);
      expect(preview.snapshot?.content).toBe('version 1');
      expect(preview.currentContent).toBe('version 2');
      expect(preview.hasDifference).toBe(true);

      // Restore v1
      const restoreResult = await coordinator.restoreEntry(doc.id, historyV1.id);
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.status).toBe('restored');
      expect(restoreResult.preRestoreSnapshotId).toBeDefined();

      // Check current document state
      expect(doc.content).toBe('version 1');
      expect(doc.isDirty).toBe(true); // Must become dirty!
      expect(doc.contentRevision).toBeGreaterThanOrEqual(2);

      // Verify a preRestore snapshot was created to protect the user's current version 2
      const historyAfterRestore = await coordinator.getHistory(doc.id);
      const preRestoreEntry = historyAfterRestore.find((e) => e.source === 'preRestore');
      expect(preRestoreEntry).toBeDefined();
      const preRestoreContent = await coordinator.getSnapshotContent(preRestoreEntry!.id);
      expect(preRestoreContent).toBe('version 2');
    });

    it('integrates seamlessly with native Undo/Redo transactions', async () => {
      const openRes = await documentEngine.openResource('file:///src/undo.ts', {
        initialContent: 'original text',
      });
      const doc = openRes.document;
      await documentEngine.save(doc.id);
      const v1Entry = (await coordinator.getHistory(doc.id))[0];

      await documentEngine.updateText(doc.id, 'modified text', 'user');
      await documentEngine.save(doc.id);

      // Restore v1
      const restoreResult = await coordinator.restoreEntry(doc.id, v1Entry.id);
      expect(restoreResult.success).toBe(true);
      expect(doc.content).toBe('original text');

      // Undo the restore operation using globalDocumentHistoryService
      const { globalDocumentHistoryService } = await import('../history');
      const model = (documentEngine as any).toDocumentModel(doc);
      const undoRes = await globalDocumentHistoryService.undo(model);
      expect(undoRes.document.content).toBe('modified text'); // Reverted back to modified text!

      // Redo the restore operation
      const redoRes = await globalDocumentHistoryService.redo(undoRes.document);
      expect(redoRes.document.content).toBe('original text');
    });

    it('rejects restore if document is marked read-only', async () => {
      const openRes = await documentEngine.openResource('file:///src/readonly.ts', {
        initialContent: 'stable base',
      });
      const doc = openRes.document;
      await documentEngine.save(doc.id);
      const entry = (await coordinator.getHistory(doc.id))[0];

      // Mark document read-only in metadata and capabilities
      (doc.metadata as { isReadOnly: boolean }).isReadOnly = true;
      (doc.capabilities as { canWrite: boolean }).canWrite = false;

      const restoreResult = await coordinator.restoreEntry(doc.id, entry.id);
      expect(restoreResult.success).toBe(false);
      expect(restoreResult.status).toBe('rejected');
      expect(restoreResult.error).toContain('read-only');
      expect(doc.content).toBe('stable base');
    });

    it('rejects restore if history entry or snapshot is not found', async () => {
      const openRes = await documentEngine.openResource('file:///src/missing.ts', {
        initialContent: 'existing',
      });
      const doc = openRes.document;

      const restoreResult = await coordinator.restoreEntry(doc.id, 'nonexistent_history_id');
      expect(restoreResult.success).toBe(false);
      expect(restoreResult.status).toBe('failed');
      expect(restoreResult.error).toContain('not found');
      expect(doc.content).toBe('existing');
    });

    it('rejects preview and restore if snapshot checksum is corrupted', async () => {
      const openRes = await documentEngine.openResource('file:///src/corrupt.ts', {
        initialContent: 'clean content',
      });
      const doc = openRes.document;
      const entry = await coordinator.createSnapshot(doc.id, 'manual');
      expect(entry).not.toBeNull();

      const rawSnapshot = await historyRepository.getSnapshot(entry!.id);
      expect(rawSnapshot).not.toBeNull();

      // Tamper with snapshot in repository directly
      const key = `history:snapshot:${entry!.id}`;
      await storageService.write(
        key,
        LocalHistoryRepository.SNAPSHOT_SCHEMA_ID,
        {
          ...rawSnapshot!,
          content: 'tampered content',
        },
        'application'
      );

      // Preview should report invalid checksum
      const preview = await coordinator.previewEntry(doc.id, entry!.id);
      expect(preview.valid).toBe(false);
      expect(preview.error).toContain('Checksum mismatch');

      // Restore should fail safely without modifying doc
      const restoreResult = await coordinator.restoreEntry(doc.id, entry!.id);
      expect(restoreResult.success).toBe(false);
      expect(restoreResult.status).toBe('failed');
      expect(restoreResult.error).toContain('checksum mismatch');
      expect(doc.content).toBe('clean content');
    });
  });

  // ===========================================================================
  // 3. Retention Policy & Bounded History Pruning
  // ===========================================================================

  describe('3. Retention Policy & Bounded History Pruning', () => {
    it('prunes oldest entries when maxEntriesPerFile limit is exceeded', async () => {
      // Coordinator was configured with maxEntriesPerFile = 5
      const openRes = await documentEngine.openResource('file:///src/retention.ts', {
        initialContent: 'v0',
      });
      const doc = openRes.document;

      // Create 7 snapshots
      for (let i = 1; i <= 7; i++) {
        await documentEngine.updateText(doc.id, `v${i}`, 'user');
        await coordinator.createSnapshot(doc.id, 'manual', { label: `Version ${i}` });
      }

      const history = await coordinator.getHistory(doc.id);
      expect(history.length).toBe(5); // Bound to 5
      // Newest should be v7 down to v3
      expect(history[0].label).toBe('Version 7');
      expect(history[4].label).toBe('Version 3');

      // The pruned snapshots (v1 and v2) should be deleted from storage
      const allSnapshots = await storageService.listKeys('app:history:snapshot:');
      expect(allSnapshots.length).toBe(5);
    });

    it('allows deleting an individual entry', async () => {
      const openRes = await documentEngine.openResource('file:///src/delete.ts', {
        initialContent: 'to be deleted',
      });
      const doc = openRes.document;
      const entry = await coordinator.createSnapshot(doc.id, 'manual');
      expect(entry).not.toBeNull();

      let history = await coordinator.getHistory(doc.id);
      expect(history.length).toBe(1);

      const deleted = await coordinator.deleteEntry(doc.id, entry!.id);
      expect(deleted).toBe(true);

      history = await coordinator.getHistory(doc.id);
      expect(history.length).toBe(0);

      // Verify content is removed from storage
      const snapshot = await historyRepository.getSnapshot(entry!.id);
      expect(snapshot).toBeNull();
    });

    it('allows clearing entire history for a document', async () => {
      const openRes = await documentEngine.openResource('file:///src/clear.ts', {
        initialContent: 'init',
      });
      const doc = openRes.document;
      await coordinator.createSnapshot(doc.id, 'manual');
      await documentEngine.updateText(doc.id, 'init 2', 'user');
      await coordinator.createSnapshot(doc.id, 'manual');

      let history = await coordinator.getHistory(doc.id);
      expect(history.length).toBe(2);

      const cleared = await coordinator.clearHistory(doc.id);
      expect(cleared).toBe(true);

      history = await coordinator.getHistory(doc.id);
      expect(history.length).toBe(0);

      const allSnapshots = await storageService.listKeys('app:history:snapshot:');
      expect(allSnapshots.length).toBe(0);
    });
  });

  // ===========================================================================
  // 4. Workspace Isolation & Namespace Segregation
  // ===========================================================================

  describe('4. Workspace Isolation & Namespace Segregation', () => {
    it('isolates document history between different documents and workspaces', async () => {
      const docA = (await documentEngine.openResource('file:///workspaceA/file.ts', {
        initialContent: 'content A',
      })).document;

      const docB = (await documentEngine.openResource('file:///workspaceB/file.ts', {
        initialContent: 'content B',
      })).document;

      await coordinator.createSnapshot(docA.id, 'manual', { label: 'A1' });
      await coordinator.createSnapshot(docB.id, 'manual', { label: 'B1' });

      const historyA = await coordinator.getHistory(docA.id);
      const historyB = await coordinator.getHistory(docB.id);

      expect(historyA.length).toBe(1);
      expect(historyA[0].label).toBe('A1');
      expect(historyA[0].resourceUri).toBe('file:///workspaceA/file.ts');

      expect(historyB.length).toBe(1);
      expect(historyB[0].label).toBe('B1');
      expect(historyB[0].resourceUri).toBe('file:///workspaceB/file.ts');
    });

    it('maintains strict separation between Recovery Storage (Step 52) and Local History (Step 53)', async () => {
      const doc = (await documentEngine.openResource('file:///src/separation.ts', {
        initialContent: 'shared file',
      })).document;

      // 1. Create a Recovery Snapshot in Recovery namespace
      await recoveryRepository.saveSnapshot({
        version: 1,
        recoveryId: 'rec_sep_1',
        sessionId: 'session_sep',
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        isUntitled: false,
        documentRevision: 1,
        recoveryGeneration: 1,
        content: 'crash recovery snapshot',
        encoding: 'utf-8',
        lineEnding: 'lf',
        checksum: StorageSerializer.computeChecksum('crash recovery snapshot'),
        createdAt: Date.now(),
      });

      // 2. Create a Local History snapshot in History namespace
      const historyEntry = await coordinator.createSnapshot(doc.id, 'manual', {
        label: 'Local History Entry',
      });

      // Verify Recovery list has recovery snapshot
      const allKeys = await storageService.listKeys('app:');
      const recKeys = allKeys.filter((k) => k.includes('recovery:snapshot:'));
      const histKeys = allKeys.filter((k) => k.includes('history:snapshot:'));
      expect(recKeys.length).toBeGreaterThanOrEqual(1);
      expect(histKeys.length).toBeGreaterThanOrEqual(1);

      // Verify Recovery query cannot see History snapshot and vice versa
      const recSnap = await recoveryRepository.getSnapshot('rec_sep_1');
      expect(recSnap?.content).toBe('crash recovery snapshot');

      const histSnap = await historyRepository.getSnapshot(historyEntry!.id);
      expect(histSnap?.content).toBe('shared file');

      // Clear document history
      await coordinator.clearHistory(doc.id);

      // Verify Local History is cleared
      const remainingHistory = (await storageService.listKeys('app:')).filter((k) =>
        k.includes('history:snapshot:')
      );
      expect(remainingHistory.length).toBe(0);

      // Verify Recovery snapshot remains completely untouched!
      const untouchedRecovery = await recoveryRepository.getSnapshot('rec_sep_1');
      expect(untouchedRecovery).not.toBeNull();
      expect(untouchedRecovery?.content).toBe('crash recovery snapshot');
    });
  });

  // ===========================================================================
  // 5. Failure Resilience & Non-Blocking Behavior
  // ===========================================================================

  describe('5. Failure Resilience & Non-Blocking Behavior', () => {
    it('does not block normal document editing or saving if history write fails', async () => {
      const openRes = await documentEngine.openResource('file:///src/fault.ts', {
        initialContent: 'resilient',
      });
      const doc = openRes.document;

      // Simulate storage failure in repository
      vi.spyOn(historyRepository, 'saveSnapshot').mockRejectedValueOnce(
        new Error('Disk I/O failure simulated')
      );

      // Save the document — DocumentEngine save must succeed even if history fails
      await documentEngine.updateText(doc.id, 'resilient edit', 'user');
      const savedDoc = await documentEngine.save(doc.id);

      expect(savedDoc).toBeDefined();
      expect(savedDoc.content).toBe('resilient edit');
      expect(doc.content).toBe('resilient edit');
      expect(doc.isDirty).toBe(false);
    });

    it('reports health and storage statistics correctly', async () => {
      const openRes = await documentEngine.openResource('file:///src/health.ts', {
        initialContent: 'data for health check',
      });
      const doc = openRes.document;
      await coordinator.createSnapshot(doc.id, 'manual');

      const health = await coordinator.getHealth();
      expect(health.enabled).toBe(true);
      expect(health.entryCount).toBeGreaterThanOrEqual(1);
      expect(health.storageBytesUsed).toBeGreaterThan(0);
      expect(health.healthy).toBe(true);
    });
  });
});
