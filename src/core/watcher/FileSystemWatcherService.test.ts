import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileSystemWatcherService } from './FileSystemWatcherService';
import { WatcherDisposedError } from './WatcherErrors';
import { globalWorkspaceEngine } from '../workspace';
import { createNewDocument } from '../document';

describe('FileSystemWatcherService', () => {
  let service: FileSystemWatcherService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new FileSystemWatcherService({ coalesceWindowMs: 50, writeSuppressionMs: 500 });
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });

  describe('Subscription Ownership & Lifecycle', () => {
    it('registers a subscription and returns an unwatch disposable', () => {
      const callback = vi.fn();
      const unwatch = service.watch('file:///workspace/src', callback);

      expect(service.getActiveSubscriptionCount()).toBe(1);

      unwatch();
      expect(service.getActiveSubscriptionCount()).toBe(0);
    });

    it('throws WatcherDisposedError if watching after disposal', () => {
      service.dispose();
      expect(() => {
        service.watch('file:///workspace/src', vi.fn());
      }).toThrow(WatcherDisposedError);
    });

    it('emits lifecycle events when subscriptions are added and removed', async () => {
      const addedListener = vi.fn();
      const removedListener = vi.fn();

      service.on('watcher.subscriptionAdded', addedListener);
      service.on('watcher.subscriptionDisposed', removedListener);

      const unwatch = service.watch('file:///workspace/src', vi.fn(), { id: 'test-sub' });

      // Allow microtask emit to resolve
      await Promise.resolve();
      expect(addedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: 'test-sub',
          targetUri: 'file:///workspace/src',
        })
      );

      unwatch();
      await Promise.resolve();
      expect(removedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionId: 'test-sub',
        })
      );
    });
  });

  describe('Event Routing & Generational Protection', () => {
    it('routes coalesced events to recursive subscriber matching parent folder', () => {
      const onEvents = vi.fn();
      service.watch('file:///workspace/src', onEvents, { recursive: true });

      service.notifyRawEvent({
        uri: 'file:///workspace/src/components/Button.tsx',
        type: 'modify',
        timestamp: Date.now(),
      });

      vi.advanceTimersByTime(60);

      expect(onEvents).toHaveBeenCalledTimes(1);
      const events = onEvents.mock.calls[0][0];
      expect(events[0].uri).toBe('file:///workspace/src/components/Button.tsx');
    });

    it('does not route events outside non-recursive subscription', () => {
      const onEvents = vi.fn();
      service.watch('file:///workspace/src/index.ts', onEvents, { recursive: false });

      service.notifyRawEvent({
        uri: 'file:///workspace/src/other.ts',
        type: 'modify',
        timestamp: Date.now(),
      });

      vi.advanceTimersByTime(60);

      expect(onEvents).not.toHaveBeenCalled();
    });

    it('filters out events matching subscription-level excludes', () => {
      const onEvents = vi.fn();
      service.watch('file:///workspace/src', onEvents, {
        recursive: true,
        excludes: ['temp'],
      });

      service.notifyRawEvent({
        uri: 'file:///workspace/src/temp/scratch.txt',
        type: 'create',
        timestamp: Date.now(),
      });

      vi.advanceTimersByTime(60);

      expect(onEvents).not.toHaveBeenCalled();
    });

    it('discards stale events from older workspace generations', () => {
      const onEvents = vi.fn();
      service.watch('file:///workspace', onEvents);

      const currentGen = globalWorkspaceEngine.getGeneration();

      // Simulate event with an older generation
      service.notifyRawEvent({
        uri: 'file:///workspace/file.ts',
        type: 'modify',
        timestamp: Date.now(),
        workspaceGeneration: currentGen - 1,
      });

      vi.advanceTimersByTime(60);

      expect(onEvents).not.toHaveBeenCalled();
    });

    it('cleans up subscriptions belonging to older workspace generations', () => {
      service.watch('file:///old/workspace', vi.fn(), {
        workspaceGeneration: 1,
      });
      service.watch('file:///new/workspace', vi.fn(), {
        workspaceGeneration: 2,
      });

      expect(service.getActiveSubscriptionCount()).toBe(2);

      service.cleanupWorkspaceSubscriptions(2);

      expect(service.getActiveSubscriptionCount()).toBe(1);
    });
  });

  describe('Document Reconciliation & Conflict Protection', () => {
    it('automatically reloads clean documents when modified on disk', () => {
      const doc = createNewDocument('test.ts', 'Initial content', 'typescript', 'file:///workspace/test.ts');
      doc.isDirty = false;

      const reloadHook = vi.fn();
      service.registerDocumentHooks(() => [doc], reloadHook);

      const result = service.reconcileDocument(
        doc,
        {
          uri: 'file:///workspace/test.ts',
          type: 'modify',
          timestamp: Date.now(),
        },
        'New disk content'
      );

      expect(result.status).toBe('reloaded');
      expect(reloadHook).toHaveBeenCalledWith(doc.id, 'New disk content');
    });

    it('protects dirty documents: detects conflict and does NOT overwrite unsaved text', async () => {
      const doc = createNewDocument('dirty.ts', 'Unsaved user edits', 'typescript', 'file:///workspace/dirty.ts');
      doc.isDirty = true;
      doc.contentRevision = 5;

      const reloadHook = vi.fn();
      service.registerDocumentHooks(() => [doc], reloadHook);

      const conflictListener = vi.fn();
      service.on('watcher.conflictDetected', conflictListener);

      const result = service.reconcileDocument(
        doc,
        {
          uri: 'file:///workspace/dirty.ts',
          type: 'modify',
          timestamp: Date.now(),
        },
        'Conflicting external disk content'
      );

      expect(result.status).toBe('conflict');
      expect(result.conflictReason).toContain('unsaved local changes');
      expect(reloadHook).not.toHaveBeenCalled();

      await Promise.resolve();
      expect(conflictListener).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: doc.id,
          uri: 'file:///workspace/dirty.ts',
          localRevision: 5,
        })
      );
    });

    it('marks file as orphaned when deleted externally on disk', () => {
      const doc = createNewDocument('deleted.ts', 'Some text', 'typescript', 'file:///workspace/deleted.ts');

      const result = service.reconcileDocument(doc, {
        uri: 'file:///workspace/deleted.ts',
        type: 'delete',
        timestamp: Date.now(),
      });

      expect(result.status).toBe('orphaned');
      expect(doc.fileResource?.exists).toBe(false);
    });

    it('updates document filePath and title when renamed externally on disk', () => {
      const doc = createNewDocument('old_name.ts', 'Code', 'typescript', 'file:///workspace/old_name.ts');

      const result = service.reconcileDocument(doc, {
        uri: 'file:///workspace/new_name.ts',
        oldUri: 'file:///workspace/old_name.ts',
        type: 'rename',
        timestamp: Date.now(),
      });

      expect(result.status).toBe('renamed');
      expect(doc.filePath).toBe('file:///workspace/new_name.ts');
      expect(doc.title).toBe('new_name.ts');
    });

    it('resolves conflict with keep_local or revert_disk', () => {
      const doc = createNewDocument('doc.ts', 'Local dirty text', 'typescript', 'file:///workspace/doc.ts');
      doc.isDirty = true;

      const reloadHook = vi.fn();
      service.registerDocumentHooks(() => [doc], reloadHook);

      const conflictResolvedListener = vi.fn();
      service.on('watcher.conflictResolved', conflictResolvedListener);

      // 1. Keep local
      service.resolveConflict(doc, 'keep_local');
      expect(reloadHook).not.toHaveBeenCalled();
      expect(conflictResolvedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: doc.id,
          resolution: 'keep_local',
        })
      );

      // 2. Revert disk
      service.resolveConflict(doc, 'revert_disk', 'Overridden disk text');
      expect(reloadHook).toHaveBeenCalledWith(doc.id, 'Overridden disk text');
      expect(conflictResolvedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: doc.id,
          resolution: 'revert_disk',
        })
      );
    });
  });
});
