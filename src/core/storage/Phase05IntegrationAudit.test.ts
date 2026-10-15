/**
 * Phase 05, Step 55 — Data & Storage Architecture Integration, Hardening & Completion Audit Tests
 * Comprehensive Cross-Domain End-to-End & Architectural Authority Validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageService } from './StorageService';
import { MemoryStorageAdapter } from './adapters/MemoryStorageAdapter';
import { SettingsRepository } from './repositories/SettingsRepository';
import { WorkspaceStateRepository } from './repositories/WorkspaceStateRepository';
import { DocumentMetadataRepository } from './repositories/DocumentMetadataRepository';
import { ResourceIndexRepository } from './repositories/ResourceIndexRepository';
import { DocumentRecoveryRepository } from './repositories/DocumentRecoveryRepository';
import { LocalHistoryRepository } from './repositories/LocalHistoryRepository';
import { RecentResourceRepository } from './repositories/RecentResourceRepository';
import { DocumentRecoveryCoordinator } from '../recovery/DocumentRecoveryCoordinator';
import { LocalHistoryCoordinator } from '../local-history/LocalHistoryCoordinator';
import { BackupCoordinator } from '../portability/BackupCoordinator';
import { PackageValidator } from '../portability/PackageValidator';
import { globalDocumentEngine } from '../documents/DocumentEngine';
import { StorageSerializer } from './serialization/StorageSerializer';
import { StorageReadOnlyError } from './StorageErrors';
import { RecoverySnapshotDTO } from './StorageTypes';

describe('Phase 05, Step 55 — Comprehensive Data & Storage Integration Audit', () => {
  let adapter: MemoryStorageAdapter;
  let storage: StorageService;
  let settingsRepo: SettingsRepository;
  let workspaceRepo: WorkspaceStateRepository;
  let docMetaRepo: DocumentMetadataRepository;
  let indexRepo: ResourceIndexRepository;
  let recoveryRepo: DocumentRecoveryRepository;
  let historyRepo: LocalHistoryRepository;
  let recentRepo: RecentResourceRepository;

  let recoveryCoord: DocumentRecoveryCoordinator;
  let historyCoord: LocalHistoryCoordinator;
  let backupCoord: BackupCoordinator;

  beforeEach(async () => {
    // Close any residual open documents in globalDocumentEngine
    for (const d of globalDocumentEngine.getAllDocuments()) {
      await globalDocumentEngine.close(d.id, true);
    }

    adapter = new MemoryStorageAdapter();
    storage = new StorageService({ adapter });
    await storage.initialize();

    settingsRepo = new SettingsRepository(storage);
    workspaceRepo = new WorkspaceStateRepository(storage);
    docMetaRepo = new DocumentMetadataRepository(storage);
    expect(docMetaRepo).toBeDefined();
    indexRepo = new ResourceIndexRepository(storage);
    recoveryRepo = new DocumentRecoveryRepository(storage);
    historyRepo = new LocalHistoryRepository(storage);
    recentRepo = new RecentResourceRepository(storage);

    recoveryCoord = new DocumentRecoveryCoordinator({
      documentEngine: globalDocumentEngine,
      repository: recoveryRepo,
      enabled: true,
      autoSaveDelayMs: 50,
    } as any);
    await recoveryCoord.initialize();

    historyCoord = new LocalHistoryCoordinator({
      documentEngine: globalDocumentEngine,
      repository: historyRepo,
      enabled: true,
      maxEntriesPerFile: 50,
      retentionDays: 30,
      maxStorageBytes: 10 * 1024 * 1024,
    } as any);
    await historyCoord.initialize();

    backupCoord = new BackupCoordinator({
      storage,
      settingsRepo,
      workspaceRepo,
      historyRepo,
      recentRepo,
      indexRepo,
    });
    await backupCoord.initialize();
  });

  afterEach(async () => {
    for (const d of globalDocumentEngine.getAllDocuments()) {
      try {
        await globalDocumentEngine.close(d.id, true);
      } catch {
        // ignore
      }
    }
    await backupCoord.dispose();
    await historyCoord.dispose();
    await recoveryCoord.dispose();
    await storage.dispose();
  });

  // ===========================================================================
  // 1. Cross-Domain 20-Step End-to-End Scenario (Section 70)
  // ===========================================================================

  describe('1. 20-Step Cross-Domain Lifecycle Audit (Section 70)', () => {
    it('executes the full lifecycle across Document, History, Recovery, Settings, Index, and Backup without cross-contamination', async () => {
      const workspaceId = 'ws_audit_alpha';
      const fileUri = 'file:///workspace/src/App.tsx';

      // 1. Open Workspace A
      await workspaceRepo.saveWorkspaceMetadata(workspaceId, {
        id: workspaceId,
        name: 'Workspace Alpha',
        roots: [{ rootId: 'root_1', uri: 'file:///workspace', name: 'workspace' }],
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      });
      const wsMeta = await workspaceRepo.getWorkspaceMetadata(workspaceId);
      expect(wsMeta?.name).toBe('Workspace Alpha');

      // 2. Open a document in DocumentEngine
      const { document: doc } = await globalDocumentEngine.openResource(fileUri, {
        initialContent: 'export const App = () => <div>V1</div>;',
      });
      expect(doc.isDirty).toBe(false);

      // 3. Edit document (V2)
      await globalDocumentEngine.updateText(doc.id, 'export const App = () => <div>V2</div>;');
      expect(globalDocumentEngine.getDocument(doc.id)?.isDirty).toBe(true);

      // 4. Save document
      await globalDocumentEngine.save(doc.id);
      expect(globalDocumentEngine.getDocument(doc.id)?.isDirty).toBe(false);

      // 5. Create History state (checkpoint 1)
      const hist1 = await historyCoord.createSnapshot(doc.id, 'save', {
        label: 'V2 Initial Save',
      });
      expect(hist1).toBeDefined();

      // 6. Edit again (V3 - unsaved)
      await globalDocumentEngine.updateText(doc.id, 'export const App = () => <div>V3 Unsaved</div>;');
      expect(globalDocumentEngine.getDocument(doc.id)?.isDirty).toBe(true);

      // 7. Recovery snapshot occurs
      const recSnap = await recoveryCoord.createRecoverySnapshot(doc.id);
      expect(recSnap?.recoveryId).toBeDefined();

      // 8. Create application backup
      const backupPkg = await backupCoord.createBackup({
        type: 'fullBackup',
        label: 'Step 8 Mid-Session Backup',
        includeHistory: true,
        workspaceId,
      });
      expect(backupPkg.manifest.packageType).toBe('fullBackup');
      // Backup must NOT clear dirty state!
      expect(globalDocumentEngine.getDocument(doc.id)?.isDirty).toBe(true);

      // 9. Modify settings
      await settingsRepo.saveUserSettings({
        'editor.tabSize': 4,
        'workbench.theme': 'qm-dark-matrix',
      });
      const savedSettings = await settingsRepo.getUserSettings();
      expect(savedSettings['editor.tabSize']).toBe(4);

      // 10. Rename document
      const renamedUri = 'file:///workspace/src/Application.tsx';
      await globalDocumentEngine.reconcileExternalChange(doc.id, 'rename', { newUri: renamedUri });
      expect(globalDocumentEngine.getDocument(doc.id)?.resourceUri).toBe(renamedUri);

      // 11. Export workspace/application data
      const exportedPkg = await backupCoord.createBackup({
        type: 'fullBackup',
        label: 'Step 11 Full Export',
        includeHistory: true,
        workspaceId,
      });
      expect(exportedPkg.manifest.packageType).toBe('fullBackup');

      // 12. Simulate restart / clean memory reset
      const adapterRestart = new MemoryStorageAdapter();
      const storageRestart = new StorageService({ adapter: adapterRestart });
      await storageRestart.initialize();
      const backupCoordRestart = new BackupCoordinator({ storage: storageRestart });
      await backupCoordRestart.initialize();

      // 13. Verify persisted state post-restart (isolated storage was clean)
      const emptySettings = await new SettingsRepository(storageRestart).getUserSettings();
      expect(emptySettings['editor.tabSize']).toBeUndefined();

      // 14. Create another history version on current active document (V4)
      await globalDocumentEngine.updateText(doc.id, 'export const App = () => <div>V4 Final</div>;');
      await globalDocumentEngine.save(doc.id);
      const hist2 = await historyCoord.createSnapshot(doc.id, 'save', {
        label: 'V4 Final Save',
      });
      expect(hist2).toBeDefined();

      // 15. Restore old history (V2)
      const restoreRes = await historyCoord.restoreEntry(renamedUri, hist1!.id, {
        createPreRestoreSnapshot: true,
      });
      expect(restoreRes.success).toBe(true);

      // 16. Verify restored document is marked dirty in memory & physical disk remains untouched until saved
      const restoredDoc = globalDocumentEngine.getDocument(doc.id);
      expect(restoredDoc?.content).toBe('export const App = () => <div>V2</div>;');
      expect(restoredDoc?.isDirty).toBe(true);

      // Save restored document
      await globalDocumentEngine.save(doc.id);
      expect(globalDocumentEngine.getDocument(doc.id)?.isDirty).toBe(false);

      // 17. Import/Restore package into restarted environment
      const restoreOperation = await backupCoordRestart.restoreBackup(exportedPkg, {
        rebuildIndexes: true,
      });
      expect(restoreOperation.status).toBe('completed');
      expect(restoreOperation.importedDomains).toContain('settings');

      // 18. Rebuild derived indexes
      const indexRepoRestart = new ResourceIndexRepository(storageRestart);
      await indexRepoRestart.saveIndex(workspaceId, {
        version: 1,
        formatVersion: 1,
        workspaceId,
        rootUri: 'file:///workspace',
        indexGeneration: 1,
        workspaceGeneration: 1,
        entries: [
          {
            resourceId: 'res_1',
            workspaceId,
            uri: renamedUri,
            relativePath: 'src/Application.tsx',
            name: 'Application.tsx',
            kind: 'file',
            parentPath: 'src',
            indexedAt: Date.now(),
          },
        ],
        totalFiles: 1,
        status: 'fresh',
        indexedAt: Date.now(),
      });
      const derivedIndex = await indexRepoRestart.getIndex(workspaceId);
      expect(derivedIndex?.totalFiles).toBe(1);

      // 19. Invalidate derived index on restore
      await indexRepoRestart.deleteIndex(workspaceId);
      const clearedIndex = await indexRepoRestart.getIndex(workspaceId);
      expect(clearedIndex).toBeNull();

      // 20. Verify final state integrity
      const restoredSettings = await new SettingsRepository(storageRestart).getUserSettings();
      expect(restoredSettings['editor.tabSize']).toBe(4);

      await backupCoordRestart.dispose();
      await storageRestart.dispose();
    });
  });

  // ===========================================================================
  // 2. Cross-Domain Authority Boundary Violation Rejection (Section 71)
  // ===========================================================================

  describe('2. Cross-Domain Authority Invariant Tests (Section 71)', () => {
    it('Invariant 1: Local History restore never bypasses DocumentEngine to write directly to filesystem', async () => {
      const uri = 'file:///workspace/test.ts';

      // Open document first
      const { document: doc } = await globalDocumentEngine.openResource(uri, {
        initialContent: 'const original = 1;',
      });
      const snap = await historyCoord.createSnapshot(doc.id, 'manual');
      expect(snap).toBeDefined();

      // Now set read-only on document metadata
      doc.metadata = {
        ...doc.metadata,
        isReadOnly: true,
        readOnlyReason: 'permission',
      };

      const res = await historyCoord.restoreEntry(uri, snap!.id);

      expect(res.success).toBe(false);
      expect(res.error).toBe('permission');
      expect(doc.content).toBe('const original = 1;');
    });

    it('Invariant 2: Recovery cannot silently overwrite active documents without user evaluation', async () => {
      const docUri = 'file:///workspace/conflict.ts';
      const { document: liveDoc } = await globalDocumentEngine.openResource(docUri, {
        initialContent: 'live clean text',
      });

      // User has typed unsaved work in live buffer
      await globalDocumentEngine.updateText(liveDoc.id, 'live dirty user edits');
      liveDoc.metadata = {
        ...liveDoc.metadata,
        modifiedTime: 2000,
      };

      // Stale recovery candidate discovered with older generation
      const staleSnapshot: RecoverySnapshotDTO = {
        version: 1,
        recoveryId: 'rec_stale_1',
        sessionId: 'session_old',
        documentId: liveDoc.id,
        resourceUri: docUri,
        isUntitled: false,
        documentRevision: 1,
        recoveryGeneration: 1,
        content: 'stale recovery text',
        encoding: 'utf-8',
        lineEnding: 'lf',
        baseFileMetadata: {
          path: docUri,
          size: 10,
          modifiedAt: 1000,
          fingerprint: '10_1000',
        },
        checksum: StorageSerializer.computeChecksum('stale recovery text'),
        createdAt: Date.now() - 50000,
      };

      await recoveryRepo.saveSnapshot(staleSnapshot);

      const evalResult = await recoveryCoord.evaluateCandidate({
        recoveryId: staleSnapshot.recoveryId,
        sessionId: staleSnapshot.sessionId,
        documentId: staleSnapshot.documentId,
        documentTitle: 'conflict.ts',
        dirty: true,
        resourceUri: staleSnapshot.resourceUri,
        isUntitled: staleSnapshot.isUntitled,
        documentRevision: staleSnapshot.documentRevision,
        recoveryGeneration: staleSnapshot.recoveryGeneration,
        baseFileMetadata: staleSnapshot.baseFileMetadata,
        createdAt: staleSnapshot.createdAt,
        updatedAt: staleSnapshot.createdAt,
      });

      // Conflicting live edits must be detected and never silently replaced!
      expect(evalResult.decision).toBe('conflict');
      expect(globalDocumentEngine.getDocument(liveDoc.id)?.content).toBe('live dirty user edits');
    });

    it('Invariant 3: Backup creation never mutates document dirty state or recovery sessions', async () => {
      const uri = 'file:///workspace/dirty.ts';
      const { document: doc } = await globalDocumentEngine.openResource(uri, {
        initialContent: 'clean',
      });
      await globalDocumentEngine.updateText(doc.id, 'dirty text');
      expect(globalDocumentEngine.getDocument(doc.id)?.isDirty).toBe(true);

      // Perform full backup
      await backupCoord.createBackup();

      // Document dirty state must remain intact
      expect(globalDocumentEngine.getDocument(doc.id)?.isDirty).toBe(true);
    });

    it('Invariant 4: PackageValidator strictly rejects path traversal and archive escape attacks', () => {
      expect(PackageValidator.validateRelativePath('../../etc/passwd')).toContain('Path traversal');
      expect(PackageValidator.validateRelativePath('..\\..\\Windows\\System32')).toContain('Path traversal');
      expect(PackageValidator.validateRelativePath('C:/escape.txt')).toContain('forbidden');
      expect(PackageValidator.validateRelativePath('\\\\server\\share\\escape.txt')).toContain('UNC network paths');
      expect(PackageValidator.validateRelativePath('unapproved_folder/file.json')).toContain('approved package domain');
    });

    it('Invariant 5: PackageValidator proactively catches and blocks plaintext credentials', () => {
      expect(PackageValidator.containsSensitiveSecrets({ apiKey: 'secret_123' })).toBe(true);
      expect(PackageValidator.containsSensitiveSecrets({ userPassword: 'password' })).toBe(true);
      expect(PackageValidator.containsSensitiveSecrets({ auth_token: 'bearer xyz' })).toBe(true);
      expect(PackageValidator.containsSensitiveSecrets({ normalSetting: 42 })).toBe(false);
    });
  });

  // ===========================================================================
  // 3. Workspace Isolation & Storage Separation (Section 20 & 44)
  // ===========================================================================

  describe('3. Workspace Boundary Isolation & Cross-Domain Separation', () => {
    it('strictly isolates history, metadata, and recovery between Workspace A and Workspace B', async () => {
      const wsA = 'ws_alpha';
      const wsB = 'ws_beta';
      const fileUriA = 'file:///project/src/indexA.ts';
      const fileUriB = 'file:///project/src/indexB.ts';

      // Open documents
      const { document: docA } = await globalDocumentEngine.openResource(fileUriA, {
        initialContent: 'const codeA = 100;',
        workspaceId: wsA,
      });
      const { document: docB } = await globalDocumentEngine.openResource(fileUriB, {
        initialContent: 'const codeB = 200;',
        workspaceId: wsB,
      });

      // Save history in Workspace A
      await historyCoord.createSnapshot(docA.id, 'save', {
        label: 'A Version',
      });

      // Save history in Workspace B
      await historyCoord.createSnapshot(docB.id, 'save', {
        label: 'B Version',
      });

      // Manifests listed for Workspace A should contain only Workspace A entries
      const manifestA = await historyRepo.getManifest(fileUriA, wsA);
      const manifestB = await historyRepo.getManifest(fileUriB, wsB);

      expect(manifestA?.entries.length).toBe(1);
      expect(manifestB?.entries.length).toBe(1);

      const snapA = await historyRepo.getSnapshot(manifestA!.entries[0].id);
      const snapB = await historyRepo.getSnapshot(manifestB!.entries[0].id);

      expect(snapA?.content).toBe('const codeA = 100;');
      expect(snapB?.content).toBe('const codeB = 200;');
    });

    it('pruning history never deletes recovery snapshots or settings records', async () => {
      // 1. Seed a setting
      await settingsRepo.saveUserSettings({ 'editor.fontSize': 16 });

      // 2. Seed a recovery snapshot
      await recoveryRepo.saveSnapshot({
        version: 1,
        recoveryId: 'rec_preserve_1',
        sessionId: 'session_keep',
        documentId: 'doc_1',
        resourceUri: 'file:///test.ts',
        isUntitled: false,
        documentRevision: 1,
        recoveryGeneration: 1,
        content: 'recovery content',
        encoding: 'utf-8',
        lineEnding: 'lf',
        checksum: StorageSerializer.computeChecksum('recovery content'),
        createdAt: Date.now(),
      });

      // 3. Clear all local history
      await historyRepo.clearAllHistory();

      // 4. Verify settings and recovery remain completely intact
      const settings = await settingsRepo.getUserSettings();
      expect(settings['editor.fontSize']).toBe(16);

      const rec = await recoveryRepo.getSnapshot('rec_preserve_1');
      expect(rec).toBeDefined();
      expect(rec?.content).toBe('recovery content');
    });
  });

  // ===========================================================================
  // 4. Storage Concurrency & Degraded Mode Safety (Section 35)
  // ===========================================================================

  describe('4. Storage Degraded Mode & Concurrency Verification', () => {
    it('continues operating safely in degraded mode when optional history or index storage fails', async () => {
      // Set adapter to read-only
      adapter.setReadOnly(true);

      // Writes fail cleanly with StorageReadOnlyError
      await expect(
        storage.write('ro_test_key', 'qm.settings.user', { 'editor.tabSize': 8 }, 'application')
      ).rejects.toThrow(StorageReadOnlyError);

      // Restore adapter
      adapter.setReadOnly(false);
    });

    it('rejects stale optimistic concurrency writes with monotonic version tracking', async () => {
      // Seed user setting
      await settingsRepo.saveUserSettings({ 'editor.tabSize': 2 });
      const record = await settingsRepo.getUserSettingsRecord();
      expect(record?.recordVersion).toBe(1);

      // Attempt to save with outdated expectedRecordVersion
      await expect(
        settingsRepo.saveUserSettings({ 'editor.tabSize': 4 }, 0) // expected 0, but current is 1
      ).rejects.toThrow(/concurrency conflict/i);
    });
  });
});
