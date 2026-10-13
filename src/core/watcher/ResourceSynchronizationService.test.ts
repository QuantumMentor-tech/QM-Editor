import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResourceSynchronizationService } from './ResourceSynchronizationService';
import { FileSystemWatcherService } from './FileSystemWatcherService';
import { VirtualWatchAdapter } from './FileWatchAdapter';
import { SaveCorrelationManager } from './SaveCorrelationManager';
import {
  WorkspaceBoundaryViolationError,
} from './WatcherErrors';
import { globalDocumentEngine } from '../documents/DocumentEngine';
import { globalWorkspaceEngine } from '../workspace';
import { globalFeedbackService } from '../feedback/FeedbackService';
import { normalizeWorkspacePath } from '../workspace/WorkspaceResourceBoundary';

describe('Step 38: File Watching & Resource Synchronization', () => {
  let syncService: ResourceSynchronizationService;
  let watcherService: FileSystemWatcherService;
  let adapter: VirtualWatchAdapter;
  let saveCorrelation: SaveCorrelationManager;

  const testWorkspaceUri = normalizeWorkspacePath('file:///C:/test-workspace');

  beforeEach(async () => {
    vi.useFakeTimers();

    // Reset & open test workspace
    if (globalWorkspaceEngine.isOpen()) {
      await globalWorkspaceEngine.close({ force: true });
    }
    await globalWorkspaceEngine.open(testWorkspaceUri);

    // Setup services
    adapter = new VirtualWatchAdapter();
    saveCorrelation = new SaveCorrelationManager();
    syncService = new ResourceSynchronizationService(saveCorrelation);
    watcherService = new FileSystemWatcherService({
      adapter,
      enforceWorkspaceBoundary: true,
      coalesceWindowMs: 50,
      writeSuppressionMs: 100,
    });
  });

  afterEach(async () => {
    watcherService.dispose();
    syncService.dispose();
    adapter.dispose();

    // Close all open documents in DocumentEngine
    for (const doc of globalDocumentEngine.getAllDocuments()) {
      await globalDocumentEngine.close(doc.id, true);
    }

    if (globalWorkspaceEngine.isOpen()) {
      await globalWorkspaceEngine.close({ force: true });
    }

    vi.useRealTimers();
  });

  // ===========================================================================
  // 1. Adapter Abstraction & Health Reporting
  // ===========================================================================
  describe('FileWatchAdapter & Health Reporting', () => {
    it('initializes VirtualWatchAdapter and creates valid watch handles', async () => {
      const onRaw = vi.fn();
      const handle = await adapter.watch(testWorkspaceUri, onRaw, { recursive: true });

      expect(handle).toBeDefined();
      expect(handle.rootUri).toBe(testWorkspaceUri);
      expect(adapter.getActiveWatchersCount()).toBe(1);

      // Emit event through adapter
      adapter.emitRawEvent({
        uri: `${testWorkspaceUri}/app.ts`,
        type: 'modify',
        timestamp: Date.now(),
      });

      expect(onRaw).toHaveBeenCalledTimes(1);

      // Stop handle
      await handle.stop();
      expect(adapter.getActiveWatchersCount()).toBe(0);
    });

    it('reports healthy status when active and degraded status when adapter unavailable', () => {
      const health = watcherService.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.adapterName).toBe('VirtualWatchAdapter');

      // Create a degraded adapter
      const degradedAdapter: any = {
        name: 'failing-adapter',
        isAvailable: () => false,
        watch: vi.fn(),
        dispose: vi.fn().mockResolvedValue(undefined),
      };

      watcherService.setAdapter(degradedAdapter);
      expect(watcherService.getHealth().status).toBe('degraded');

      watcherService.dispose();
      expect(watcherService.getHealth().status).toBe('disabled');
    });
  });

  // ===========================================================================
  // 2. Duplicate Watcher Prevention & Reference Counting
  // ===========================================================================
  describe('Duplicate Watcher Prevention', () => {
    it('reuses existing root watcher when watching child path inside watched root', async () => {
      const sub1Callback = vi.fn();
      const sub2Callback = vi.fn();

      // First subscription at root level
      const unwatch1 = watcherService.watch(testWorkspaceUri, sub1Callback, { recursive: true });
      expect(watcherService.getActiveRootCount()).toBe(1);
      expect(watcherService.getActiveSubscriptionCount()).toBe(1);

      // Second subscription targeting a subfolder inside root
      const unwatch2 = watcherService.watch(
        `${testWorkspaceUri}/src/components`,
        sub2Callback,
        { recursive: true }
      );

      // Root count remains 1 due to deduplication, while subscription count is 2
      expect(watcherService.getActiveRootCount()).toBe(1);
      expect(watcherService.getActiveSubscriptionCount()).toBe(2);

      // Unwatching child sub leaves root active
      unwatch2();
      expect(watcherService.getActiveSubscriptionCount()).toBe(1);
      expect(watcherService.getActiveRootCount()).toBe(1);

      // Unwatching root sub releases root handle
      unwatch1();
      expect(watcherService.getActiveSubscriptionCount()).toBe(0);
      expect(watcherService.getActiveRootCount()).toBe(0);
    });
  });

  // ===========================================================================
  // 3. Workspace Boundary Validation & Path Traversal Protection
  // ===========================================================================
  describe('Workspace Boundary Protection', () => {
    it('accepts paths within the active workspace root', () => {
      expect(() => {
        watcherService.watch(`${testWorkspaceUri}/src/main.ts`, vi.fn());
      }).not.toThrow();
    });

    it('rejects paths outside the active workspace boundary', () => {
      expect(() => {
        watcherService.watch('file:///C:/unauthorized-path', vi.fn());
      }).toThrow(WorkspaceBoundaryViolationError);
    });

    it('rejects path traversal attempts escaping the workspace root', () => {
      expect(() => {
        watcherService.watch(`${testWorkspaceUri}/../secret/leak.txt`, vi.fn());
      }).toThrow(WorkspaceBoundaryViolationError);
    });
  });

  // ===========================================================================
  // 4. Save Correlation Manager
  // ===========================================================================
  describe('Internal Save Correlation', () => {
    it('correlates internal save events and consumes tickets', () => {
      const fileUri = `${testWorkspaceUri}/file.ts`;
      const opId = saveCorrelation.registerSave(fileUri, { workspaceId: 'ws-test' });

      expect(opId).toBeDefined();
      expect(saveCorrelation.hasActiveSave(fileUri)).toBe(true);

      const correlated = saveCorrelation.correlateEvent(fileUri);
      expect(correlated).toBeDefined();
      expect(correlated?.operationId).toBe(opId);
      expect(correlated?.resourceUri).toBe(fileUri);

      // Consumed: repeated lookup returns false
      expect(saveCorrelation.hasActiveSave(fileUri)).toBe(false);
    });

    it('classifies internal save event as internal_save without reloading', async () => {
      const fileUri = `${testWorkspaceUri}/file.ts`;
      saveCorrelation.registerSave(fileUri);

      const classified = await syncService.classifyChange({
        uri: fileUri,
        type: 'modify',
        timestamp: Date.now(),
      });

      expect(classified.classification).toBe('internal_save');
    });
  });

  // ===========================================================================
  // 5. Change Classification & Stale Generation Guard
  // ===========================================================================
  describe('Change Classification & Stale Generation Guard', () => {
    it('ignores events from older workspace generations', async () => {
      const fileUri = `${testWorkspaceUri}/old.ts`;
      const currentGen = globalWorkspaceEngine.getGeneration();

      const classified = await syncService.classifyChange({
        uri: fileUri,
        type: 'modify',
        timestamp: Date.now(),
        workspaceGeneration: currentGen - 1,
      });

      expect(classified.classification).toBe('ignored_path');
      expect(classified.conflictReason).toContain('older workspace generation');
    });

    it('classifies unopened file modifications as unopened_resource', async () => {
      const fileUri = `${testWorkspaceUri}/unopened.ts`;

      const classified = await syncService.classifyChange({
        uri: fileUri,
        type: 'modify',
        timestamp: Date.now(),
      });

      expect(classified.classification).toBe('unopened_resource');
    });
  });

  // ===========================================================================
  // 6. Clean Document External Reload & Editor State Preservation
  // ===========================================================================
  describe('Clean Document External Synchronization', () => {
    it('safely reloads clean open document and increments revision', async () => {
      const fileUri = `${testWorkspaceUri}/clean.ts`;
      const { document: doc } = await globalDocumentEngine.openResource(fileUri, {
        initialContent: 'initial content',
      });

      expect(doc.isDirty).toBe(false);
      expect(doc.contentRevision).toBe(0);

      const classified = await syncService.classifyChange({
        uri: fileUri,
        type: 'modify',
        timestamp: Date.now(),
      });

      expect(classified.classification).toBe('clean_document_reload');
      expect(classified.documentId).toBe(doc.id);

      const reloadListener = vi.fn();
      syncService.on('synchronization.documentReloaded', reloadListener);

      await syncService.synchronizeChange(classified, {
        diskContent: 'externally updated content',
      });

      const updated = globalDocumentEngine.getDocument(doc.id);
      expect(updated?.content).toBe('externally updated content');
      expect(updated?.contentRevision).toBe(1);
      expect(updated?.isDirty).toBe(false);

      expect(reloadListener).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: doc.id,
          newRevision: 1,
        })
      );
    });
  });

  // ===========================================================================
  // 7. Dirty Document Conflict Protection (Crucial Safety Boundary)
  // ===========================================================================
  describe('Dirty Document Conflict Protection', () => {
    it('never overwrites unsaved edits on dirty document and surfaces conflict', async () => {
      const fileUri = `${testWorkspaceUri}/dirty.ts`;
      const { document: doc } = await globalDocumentEngine.openResource(fileUri, {
        initialContent: 'clean baseline',
      });

      // Simulate local user edit making the document dirty
      doc.content = 'local unsaved work';
      doc.isDirty = true;
      doc.contentRevision = 2;

      const classified = await syncService.classifyChange({
        uri: fileUri,
        type: 'modify',
        timestamp: Date.now(),
      });

      expect(classified.classification).toBe('dirty_document_conflict');

      const warningSpy = vi.spyOn(globalFeedbackService, 'showWarning');
      const conflictListener = vi.fn();
      syncService.on('synchronization.conflictDetected', conflictListener);

      await syncService.synchronizeChange(classified, {
        diskContent: 'external conflicting disk content',
      });

      // Local edits MUST be preserved
      const preservedDoc = globalDocumentEngine.getDocument(doc.id);
      expect(preservedDoc?.content).toBe('local unsaved work');
      expect(preservedDoc?.isDirty).toBe(true);
      expect(preservedDoc?.metadata.hasConflict).toBe(true);
      expect(preservedDoc?.metadata.externallyModified).toBe(true);

      expect(warningSpy).toHaveBeenCalled();
      expect(conflictListener).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: doc.id,
          localRevision: 2,
        })
      );
    });
  });

  // ===========================================================================
  // 8. External Delete, Rename & Recreation Handling
  // ===========================================================================
  describe('External Delete, Rename & Recreation', () => {
    it('preserves open document content in memory when file is deleted externally', async () => {
      const fileUri = `${testWorkspaceUri}/deleted.ts`;
      const { document: doc } = await globalDocumentEngine.openResource(fileUri, {
        initialContent: 'preserved content',
      });

      const classified = await syncService.classifyChange({
        uri: fileUri,
        type: 'delete',
        timestamp: Date.now(),
      });

      expect(classified.classification).toBe('external_delete');

      const deleteListener = vi.fn();
      syncService.on('synchronization.resourceDeleted', deleteListener);

      await syncService.synchronizeChange(classified);

      const existingDoc = globalDocumentEngine.getDocument(doc.id);
      expect(existingDoc).toBeDefined();
      expect(existingDoc?.content).toBe('preserved content');
      expect(existingDoc?.metadata.missingResource).toBe(true);
      expect(existingDoc?.resource.exists).toBe(false);

      expect(deleteListener).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: doc.id,
        })
      );
    });

    it('updates resource URI when document is renamed externally', async () => {
      const oldUri = `${testWorkspaceUri}/oldName.ts`;
      const newUri = `${testWorkspaceUri}/newName.ts`;

      const { document: doc } = await globalDocumentEngine.openResource(oldUri, {
        initialContent: 'code',
      });

      const classified = await syncService.classifyChange({
        uri: newUri,
        oldUri,
        type: 'rename',
        timestamp: Date.now(),
      });

      expect(classified.classification).toBe('external_rename');

      const renameListener = vi.fn();
      syncService.on('synchronization.resourceRenamed', renameListener);

      await syncService.synchronizeChange(classified);

      const renamedDoc = globalDocumentEngine.getDocument(doc.id);
      expect(renamedDoc?.resourceUri.toLowerCase()).toBe(newUri.toLowerCase().replace('file://', 'file:///'));
      expect(renamedDoc?.id).toBe(doc.id); // Identity preserved!

      expect(renameListener).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: doc.id,
          newResourceUri: newUri,
          oldResourceUri: oldUri,
        })
      );
    });

    it('marks missing resource as restored when deleted file is recreated', async () => {
      const fileUri = `${testWorkspaceUri}/recreated.ts`;
      const { document: doc } = await globalDocumentEngine.openResource(fileUri, {
        initialContent: 'code',
      });

      // First mark as deleted
      await globalDocumentEngine.reconcileExternalChange(doc.id, 'delete');
      expect(doc.metadata.missingResource).toBe(true);

      const classified = await syncService.classifyChange({
        uri: fileUri,
        type: 'create',
        timestamp: Date.now(),
      });

      expect(classified.classification).toBe('external_recreate');

      const recreateListener = vi.fn();
      syncService.on('synchronization.resourceRecreated', recreateListener);

      await syncService.synchronizeChange(classified);

      const restoredDoc = globalDocumentEngine.getDocument(doc.id);
      expect(restoredDoc?.metadata.missingResource).toBe(false);
      expect(restoredDoc?.resource.exists).toBe(true);

      expect(recreateListener).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: doc.id,
        })
      );
    });
  });
});
