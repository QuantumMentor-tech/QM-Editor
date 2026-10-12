/**
 * QM Editor Filesystem Watcher & External Change Reconciliation Service
 * Phase 04, Step 32 — Core Engine Subsystem
 */

import {
  CoalescedFileSystemEvent,
  RawFileSystemEvent,
  WatcherSubscription,
  WatcherSubscriptionOptions,
  ReconciledDocumentResult,
  WatcherEventKey,
  WatcherEventMap,
  WatcherEventListener,
} from './WatcherTypes';
import { WatcherDisposedError } from './WatcherErrors';
import { EventCoalescer } from './EventCoalescer';
import { globalWorkspaceEngine } from '../workspace';
import { normalizeWorkspacePath, isResourceInRoot } from '../workspace/WorkspaceResourceBoundary';
import { DocumentModel } from '../../types';
import { logger } from '../../utils/logger';

export interface WatcherServiceOptions {
  coalesceWindowMs?: number;
  writeSuppressionMs?: number;
}

export class FileSystemWatcherService {
  private coalescer: EventCoalescer;
  private subscriptions = new Map<string, WatcherSubscription>();
  private isDisposed: boolean = false;
  private subCounter = 0;

  private listeners = new Map<WatcherEventKey, Set<WatcherEventListener<any>>>();

  // Registered document provider hook for auto-reconciliation
  private getOpenDocumentsHook?: () => DocumentModel[];
  private reloadDocumentHook?: (documentId: string, newContent: string) => void;

  constructor(options: WatcherServiceOptions = {}) {
    this.coalescer = new EventCoalescer({
      windowMs: options.coalesceWindowMs,
      writeSuppressionMs: options.writeSuppressionMs,
      onFlush: (events) => this.dispatchCoalescedEvents(events),
    });

    // Automatically bind to workspace lifecycle to clean up stale watchers
    globalWorkspaceEngine.on('workspace.closed', (payload) => {
      this.cleanupWorkspaceSubscriptions(payload.generation);
    });

    globalWorkspaceEngine.on('workspace.changed', (payload) => {
      this.cleanupWorkspaceSubscriptions(payload.generation);
    });
  }

  // ---------------------------------------------------------------------------
  // 1. Subscription Management & Ownership
  // ---------------------------------------------------------------------------

  /**
   * Registers a watcher subscription on a target folder or file URI.
   */
  public watch(
    rawTargetUri: string,
    onEvents: (events: CoalescedFileSystemEvent[]) => void,
    options: WatcherSubscriptionOptions = {}
  ): () => void {
    if (this.isDisposed) {
      throw new WatcherDisposedError('watch');
    }

    const targetUri = normalizeWorkspacePath(rawTargetUri);
    const id = options.id || `sub-${++this.subCounter}-${Date.now()}`;
    const recursive = options.recursive ?? true;
    const workspaceGeneration =
      options.workspaceGeneration ?? globalWorkspaceEngine.getGeneration();

    const sub: WatcherSubscription = {
      id,
      targetUri,
      recursive,
      workspaceGeneration,
      excludes: options.excludes || [],
      onEvents,
      disposed: false,
    };

    this.subscriptions.set(id, sub);

    logger.info('FileSystemWatcherService: subscription added', { id, targetUri, recursive });
    this.emit('watcher.subscriptionAdded', {
      subscriptionId: id,
      targetUri,
      recursive,
    }).catch(() => {});

    return () => {
      this.unwatch(id);
    };
  }

  public unwatch(subscriptionId: string): void {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub || sub.disposed) return;

    sub.disposed = true;
    this.subscriptions.delete(subscriptionId);

    logger.info('FileSystemWatcherService: subscription removed', { subscriptionId });
    this.emit('watcher.subscriptionDisposed', {
      subscriptionId,
      targetUri: sub.targetUri,
    }).catch(() => {});
  }

  public getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Cleans up subscriptions tied to old workspace generations.
   */
  public cleanupWorkspaceSubscriptions(currentGeneration: number): void {
    let cleaned = 0;
    for (const [id, sub] of this.subscriptions.entries()) {
      if (sub.workspaceGeneration !== undefined && sub.workspaceGeneration < currentGeneration) {
        sub.disposed = true;
        this.subscriptions.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('FileSystemWatcherService: cleaned stale workspace subscriptions', {
        cleanedCount: cleaned,
        generation: currentGeneration,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Event Ingestion, Write Suppression & Coalescing
  // ---------------------------------------------------------------------------

  /**
   * Ingests a raw filesystem notification (e.g. from FileSystemHandle or platform observer).
   */
  public notifyRawEvent(rawEvent: RawFileSystemEvent): void {
    if (this.isDisposed) return;

    // Attach workspace generation if omitted
    if (rawEvent.workspaceGeneration === undefined) {
      rawEvent.workspaceGeneration = globalWorkspaceEngine.getGeneration();
    }

    this.coalescer.push(rawEvent);
  }

  /**
   * Suppresses notifications for an internal save to prevent echo conflicts.
   */
  public recordInternalWrite(uri: string, windowMs?: number): void {
    this.coalescer.markInternalWrite(uri, windowMs);
  }

  /**
   * Dispatches flushed coalesced events to active matching subscriptions.
   */
  private dispatchCoalescedEvents(events: CoalescedFileSystemEvent[]): void {
    if (this.isDisposed || events.length === 0) return;

    const currentGeneration = globalWorkspaceEngine.getGeneration();

    // 1. Stale-event check per generation
    const validEvents = events.filter((ev) => {
      if (ev.workspaceGeneration !== undefined && ev.workspaceGeneration !== currentGeneration) {
        logger.info('FileSystemWatcherService: discarded stale event from older generation', {
          uri: ev.uri,
          eventGeneration: ev.workspaceGeneration,
          currentGeneration,
        });
        return false;
      }
      return true;
    });

    if (validEvents.length === 0) return;

    this.emit('watcher.eventsCoalesced', {
      events: validEvents,
      batchCount: validEvents.length,
    }).catch(() => {});

    // 2. Dispatch to matching subscriptions
    for (const sub of this.subscriptions.values()) {
      if (sub.disposed) continue;

      const matchingEvents = validEvents.filter((ev) => {
        // Exclude check
        if (sub.excludes.some((exc) => ev.uri.includes(exc))) {
          return false;
        }

        // Exact match or recursive child
        if (ev.uri === sub.targetUri) return true;
        if (sub.recursive && isResourceInRoot(sub.targetUri, ev.uri)) return true;
        if (ev.oldUri && (ev.oldUri === sub.targetUri || (sub.recursive && isResourceInRoot(sub.targetUri, ev.oldUri)))) {
          return true;
        }

        return false;
      });

      if (matchingEvents.length > 0) {
        try {
          sub.onEvents(matchingEvents);
        } catch (err) {
          logger.error('FileSystemWatcherService: error in subscription callback', {
            subscriptionId: sub.id,
            error: (err as Error).message,
          });
        }
      }
    }

    // 3. Reconcile external changes on open documents
    this.reconcileOpenDocuments(validEvents);
  }

  // ---------------------------------------------------------------------------
  // 3. Document Reconciliation & Conflict Protection
  // ---------------------------------------------------------------------------

  public registerDocumentHooks(
    getOpenDocuments: () => DocumentModel[],
    reloadDocument: (documentId: string, newContent: string) => void
  ): () => void {
    this.getOpenDocumentsHook = getOpenDocuments;
    this.reloadDocumentHook = reloadDocument;
    return () => {
      this.getOpenDocumentsHook = undefined;
      this.reloadDocumentHook = undefined;
    };
  }

  private reconcileOpenDocuments(events: CoalescedFileSystemEvent[]): void {
    if (!this.getOpenDocumentsHook) return;

    const openDocs = this.getOpenDocumentsHook();
    if (!openDocs || openDocs.length === 0) return;

    for (const ev of events) {
      for (const doc of openDocs) {
        const docUri = normalizeWorkspacePath(doc.fileResource?.uri || doc.filePath || '');
        if (!docUri) continue;

        if (docUri === ev.uri || (ev.oldUri && docUri === ev.oldUri)) {
          this.reconcileDocument(doc, ev);
        }
      }
    }
  }

  /**
   * Reconciles an external change against an individual DocumentModel.
   * Guarantees that dirty buffers are NEVER overwritten without user resolution.
   */
  public reconcileDocument(
    document: DocumentModel,
    event: CoalescedFileSystemEvent,
    newDiskContent?: string
  ): ReconciledDocumentResult {
    const docUri = normalizeWorkspacePath(document.fileResource?.uri || document.filePath || '');

    // Case 1: Deleted on disk
    if (event.type === 'delete') {
      logger.warn('FileSystemWatcherService: open file deleted externally on disk', {
        documentId: document.id,
        uri: docUri,
      });

      if (document.fileResource) {
        document.fileResource.exists = false;
      } else {
        document.fileResource = {
          uri: docUri,
          name: document.title,
          extension: '',
          readOnly: false,
          exists: false,
        };
      }

      return {
        documentId: document.id,
        uri: docUri,
        status: 'orphaned',
        conflictReason: 'File was deleted externally on disk.',
      };
    }

    // Case 2: Renamed on disk
    if (event.type === 'rename' && event.oldUri && docUri === event.oldUri) {
      logger.info('FileSystemWatcherService: open file renamed externally on disk', {
        documentId: document.id,
        from: event.oldUri,
        to: event.uri,
      });

      const parts = event.uri.split('/');
      const newName = parts[parts.length - 1];

      document.filePath = event.uri;
      document.title = newName;
      if (document.fileResource) {
        document.fileResource.uri = event.uri;
        document.fileResource.name = newName;
      }

      return {
        documentId: document.id,
        uri: event.uri,
        status: 'renamed',
      };
    }

    // Case 3: Modified on disk
    if (event.type === 'modify') {
      if (document.isDirty) {
        // Dirty buffer: NEVER overwrite silently!
        logger.warn('FileSystemWatcherService: external conflict detected on dirty document', {
          documentId: document.id,
          uri: docUri,
          localRevision: document.contentRevision,
        });

        this.emit('watcher.conflictDetected', {
          documentId: document.id,
          uri: docUri,
          localRevision: document.contentRevision,
        }).catch(() => {});

        return {
          documentId: document.id,
          uri: docUri,
          status: 'conflict',
          conflictReason: 'File was modified externally while unsaved local changes exist.',
        };
      }

      // Clean buffer: Auto-reload safe
      if (newDiskContent !== undefined && this.reloadDocumentHook) {
        logger.info('FileSystemWatcherService: clean document reloaded with disk content', {
          documentId: document.id,
          uri: docUri,
        });
        this.reloadDocumentHook(document.id, newDiskContent);
      }

      return {
        documentId: document.id,
        uri: docUri,
        status: 'reloaded',
        newContent: newDiskContent,
      };
    }

    return {
      documentId: document.id,
      uri: docUri,
      status: 'ignored',
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Conflict Resolution
  // ---------------------------------------------------------------------------

  public resolveConflict(
    document: DocumentModel,
    resolution: 'keep_local' | 'revert_disk',
    diskContent?: string
  ): void {
    const uri = normalizeWorkspacePath(document.fileResource?.uri || document.filePath || '');

    if (resolution === 'revert_disk' && diskContent !== undefined && this.reloadDocumentHook) {
      this.reloadDocumentHook(document.id, diskContent);
    }

    logger.info('FileSystemWatcherService: external conflict resolved', {
      documentId: document.id,
      resolution,
      uri,
    });

    this.emit('watcher.conflictResolved', {
      documentId: document.id,
      uri,
      resolution,
    }).catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // 5. Watcher Event Subscriptions
  // ---------------------------------------------------------------------------

  public on<K extends WatcherEventKey>(
    event: K,
    listener: WatcherEventListener<K>
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as WatcherEventListener<any>);

    return () => {
      this.listeners.get(event)?.delete(listener as WatcherEventListener<any>);
    };
  }

  private async emit<K extends WatcherEventKey>(
    event: K,
    payload: WatcherEventMap[K]
  ): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    for (const listener of handlers) {
      try {
        await listener(payload);
      } catch (err) {
        logger.error(`FileSystemWatcherService: error in listener for "${event}"`, {
          error: (err as Error).message,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Cleanup & Lifecycle
  // ---------------------------------------------------------------------------

  public flush(): void {
    this.coalescer.flush();
  }

  public dispose(): void {
    this.isDisposed = true;
    this.coalescer.dispose();
    this.subscriptions.clear();
    this.listeners.clear();
    this.getOpenDocumentsHook = undefined;
    this.reloadDocumentHook = undefined;
    logger.info('FileSystemWatcherService: disposed all watchers and subscriptions');
  }
}

/**
 * Global singleton FileSystemWatcherService instance
 */
export const globalFileSystemWatcherService = new FileSystemWatcherService();
