/**
 * QM Editor Resource Synchronization Service
 * Phase 04, Step 38 — Core Application Engine
 */

import {
  CoalescedFileSystemEvent,
  ClassifiedResourceChange,
  WatcherEventKey,
  WatcherEventMap,
  WatcherEventListener,
} from './WatcherTypes';
import { globalDocumentEngine } from '../documents/DocumentEngine';
import { globalEditorCoordinationService } from '../editor/EditorCoordinationService';
import { globalWorkspaceEngine } from '../workspace';
import { normalizeWorkspacePath, isResourceInRoot } from '../workspace/WorkspaceResourceBoundary';
import { fileService } from '../../services/FileService';
import { globalFeedbackService } from '../feedback/FeedbackService';
import { workspaceIndexService } from '../../services/WorkspaceIndexService';
import { SaveCorrelationManager } from './SaveCorrelationManager';
import { globalDocumentHistoryService } from '../history';
import { logger } from '../../utils/logger';

export class ResourceSynchronizationService {
  private listeners = new Map<WatcherEventKey, Set<WatcherEventListener<any>>>();
  private saveCorrelationManager: SaveCorrelationManager;
  private isDisposed = false;
  private syncSeq = 0;

  constructor(saveCorrelationManager?: SaveCorrelationManager) {
    this.saveCorrelationManager = saveCorrelationManager || new SaveCorrelationManager();
  }

  public getSaveCorrelationManager(): SaveCorrelationManager {
    return this.saveCorrelationManager;
  }

  // ---------------------------------------------------------------------------
  // 1. Change Classification
  // ---------------------------------------------------------------------------

  /**
   * Classifies an incoming coalesced filesystem event according to active application state.
   */
  public async classifyChange(
    event: CoalescedFileSystemEvent
  ): Promise<ClassifiedResourceChange> {
    const uri = normalizeWorkspacePath(event.uri);
    const oldUri = event.oldUri ? normalizeWorkspacePath(event.oldUri) : undefined;
    const currentGen = globalWorkspaceEngine.getGeneration();
    const eventGen = event.workspaceGeneration ?? currentGen;

    // 1. Stale-generation guard
    if (eventGen !== currentGen) {
      return {
        uri,
        oldUri,
        type: event.type,
        classification: 'ignored_path',
        timestamp: event.timestamp,
        workspaceGeneration: eventGen,
        conflictReason: 'Stale event from older workspace generation.',
      };
    }

    // 2. Workspace boundary validation
    const primaryRoot = globalWorkspaceEngine.getPrimaryRoot();
    const workspaceRoot = primaryRoot ? primaryRoot.uri : undefined;
    if (workspaceRoot && !isResourceInRoot(workspaceRoot, uri)) {
      logger.warn('ResourceSynchronizationService: path outside workspace boundary', {
        uri,
        workspaceRoot,
      });
      return {
        uri,
        oldUri,
        type: event.type,
        classification: 'ignored_path',
        timestamp: event.timestamp,
        workspaceGeneration: eventGen,
        conflictReason: 'Path violates active workspace boundary.',
      };
    }

    // 3. Internal save correlation check
    if (this.saveCorrelationManager.hasActiveSave(uri)) {
      this.saveCorrelationManager.correlateEvent(uri);
      return {
        uri,
        oldUri,
        type: event.type,
        classification: 'internal_save',
        timestamp: event.timestamp,
        workspaceGeneration: eventGen,
      };
    }

    // 4. Find matching open document in DocumentEngine
    const openDocs = globalDocumentEngine.getAllDocuments();
    const matchedDoc = openDocs.find((d) => {
      const docUri = normalizeWorkspacePath(d.resourceUri);
      const docFilePath = d.filePath ? normalizeWorkspacePath(d.filePath) : undefined;
      return docUri === uri || (docFilePath && docFilePath === uri) || (oldUri && (docUri === oldUri || docFilePath === oldUri));
    });

    if (!matchedDoc) {
      // Resource is not open in editor
      return {
        uri,
        oldUri,
        type: event.type,
        classification: 'unopened_resource',
        timestamp: event.timestamp,
        workspaceGeneration: eventGen,
      };
    }

    // 5. Classify open document state
    const docId = matchedDoc.id;

    if (event.type === 'delete') {
      return {
        uri,
        oldUri,
        type: event.type,
        classification: 'external_delete',
        documentId: docId,
        timestamp: event.timestamp,
        workspaceGeneration: eventGen,
      };
    }

    if (event.type === 'rename') {
      return {
        uri,
        oldUri,
        type: event.type,
        classification: 'external_rename',
        documentId: docId,
        timestamp: event.timestamp,
        workspaceGeneration: eventGen,
      };
    }

    if (event.type === 'create' && matchedDoc.metadata.missingResource) {
      return {
        uri,
        oldUri,
        type: event.type,
        classification: 'external_recreate',
        documentId: docId,
        timestamp: event.timestamp,
        workspaceGeneration: eventGen,
      };
    }

    if (event.type === 'modify') {
      if (matchedDoc.isDirty) {
        return {
          uri,
          oldUri,
          type: event.type,
          classification: 'dirty_document_conflict',
          documentId: docId,
          timestamp: event.timestamp,
          workspaceGeneration: eventGen,
          conflictReason: 'File was modified on disk while unsaved local changes exist in editor.',
        };
      }

      return {
        uri,
        oldUri,
        type: event.type,
        classification: 'clean_document_reload',
        documentId: docId,
        timestamp: event.timestamp,
        workspaceGeneration: eventGen,
      };
    }

    return {
      uri,
      oldUri,
      type: event.type,
      classification: 'unopened_resource',
      documentId: docId,
      timestamp: event.timestamp,
      workspaceGeneration: eventGen,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Resource Synchronization Orchestration
  // ---------------------------------------------------------------------------

  /**
   * Applies appropriate synchronization action based on the classified change.
   */
  public async synchronizeChange(
    classified: ClassifiedResourceChange,
    options: { diskContent?: string } = {}
  ): Promise<void> {
    if (this.isDisposed) return;

    const opSeq = ++this.syncSeq;

    await this.emit('synchronization.changeClassified', { change: classified });

    switch (classified.classification) {
      case 'internal_save':
      case 'ignored_path':
        // No external synchronization action needed
        return;

      case 'unopened_resource': {
        // Invalidate / update workspace search & indexing
        workspaceIndexService.clearIndex();

        await this.emit('watcher.externalChangeDetected', {
          uri: classified.uri,
          type: classified.type,
          oldUri: classified.oldUri,
        });
        return;
      }

      case 'clean_document_reload': {
        if (!classified.documentId) return;
        const doc = globalDocumentEngine.getDocument(classified.documentId);
        if (!doc || doc.isDirty) return;

        let contentToReload = options.diskContent;
        if (contentToReload === undefined) {
          try {
            if (doc.resource.handle && doc.resource.handle.kind === 'file') {
              const res = await fileService.readFile(doc.resource.handle as FileSystemFileHandle);
              contentToReload = res.content;
            }
          } catch (err) {
            logger.error('ResourceSynchronizationService: failed to read disk file for reload', {
              documentId: doc.id,
              error: (err as Error).message,
            });
            return;
          }
        }

        if (contentToReload === undefined) return;

        // Async race guard: verify document did not change during read
        if (opSeq < this.syncSeq - 100 || doc.isDirty) return;

        // Preserve view state before reload
        const instance = globalEditorCoordinationService.getEditorInstanceForDocument(doc.id);
        if (instance) {
          globalEditorCoordinationService.saveViewStateForInstance(instance.id, doc.id);
        }

        // Apply external change via DocumentEngine
        await globalDocumentEngine.reconcileExternalChange(doc.id, 'modify', {
          newContent: contentToReload,
        });

        // Step 39: Invalidate and clear editor native and application history
        // to prevent stale undo operations from corrupting externally synchronized content
        globalEditorCoordinationService.clearHistory(doc.id);
        globalDocumentHistoryService.clear(doc.id);

        // Restore view state into editor surface
        if (instance) {
          globalEditorCoordinationService.restoreViewStateForInstance(instance.id, doc.id);
        }

        await this.emit('synchronization.documentReloaded', {
          documentId: doc.id,
          resourceUri: doc.resourceUri,
          newRevision: doc.contentRevision,
        });

        logger.info('ResourceSynchronizationService: clean document safely reloaded', {
          documentId: doc.id,
          resourceUri: doc.resourceUri,
          revision: doc.contentRevision,
        });
        return;
      }

      case 'dirty_document_conflict': {
        if (!classified.documentId) return;
        const doc = globalDocumentEngine.getDocument(classified.documentId);
        if (!doc) return;

        // Mark conflict on DocumentEngine without touching dirty content
        await globalDocumentEngine.reconcileExternalChange(doc.id, 'modify');

        globalFeedbackService.showWarning(
          `File "${doc.title}" has been modified on disk, but has unsaved edits in editor.`,
          {
            source: 'synchronization.conflict',
            scope: 'workspace',
          }
        );

        await this.emit('synchronization.conflictDetected', {
          documentId: doc.id,
          resourceUri: doc.resourceUri,
          localRevision: doc.contentRevision,
          reason: classified.conflictReason || 'Unsaved edits conflict with external disk changes.',
        });

        await this.emit('watcher.conflictDetected', {
          documentId: doc.id,
          uri: doc.resourceUri,
          localRevision: doc.contentRevision,
        });

        logger.warn('ResourceSynchronizationService: external modification conflict surfaced', {
          documentId: doc.id,
          resourceUri: doc.resourceUri,
          revision: doc.contentRevision,
        });
        return;
      }

      case 'external_delete': {
        if (!classified.documentId) return;
        const doc = globalDocumentEngine.getDocument(classified.documentId);
        if (!doc) return;

        await globalDocumentEngine.reconcileExternalChange(doc.id, 'delete');

        globalFeedbackService.showWarning(
          `File "${doc.title}" was deleted externally on disk. Local edits are preserved.`,
          {
            source: 'synchronization.delete',
            scope: 'workspace',
          }
        );

        await this.emit('synchronization.resourceDeleted', {
          documentId: doc.id,
          resourceUri: doc.resourceUri,
        });

        logger.warn('ResourceSynchronizationService: resource deleted on disk', {
          documentId: doc.id,
          resourceUri: doc.resourceUri,
        });
        return;
      }

      case 'external_rename': {
        if (!classified.documentId || !classified.oldUri) return;
        const doc = globalDocumentEngine.getDocument(classified.documentId);
        if (!doc) return;

        await globalDocumentEngine.reconcileExternalChange(doc.id, 'rename', {
          newUri: classified.uri,
        });

        await this.emit('synchronization.resourceRenamed', {
          documentId: doc.id,
          oldResourceUri: classified.oldUri,
          newResourceUri: classified.uri,
        });

        logger.info('ResourceSynchronizationService: resource renamed on disk', {
          documentId: doc.id,
          from: classified.oldUri,
          to: classified.uri,
        });
        return;
      }

      case 'external_recreate': {
        if (!classified.documentId) return;
        const doc = globalDocumentEngine.getDocument(classified.documentId);
        if (!doc) return;

        doc.metadata = {
          ...doc.metadata,
          missingResource: false,
        };
        doc.resource = {
          ...doc.resource,
          exists: true,
        };

        await this.emit('synchronization.resourceRecreated', {
          documentId: doc.id,
          resourceUri: doc.resourceUri,
        });

        logger.info('ResourceSynchronizationService: deleted file recreated on disk', {
          documentId: doc.id,
          resourceUri: doc.resourceUri,
        });
        return;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Conflict Resolution
  // ---------------------------------------------------------------------------

  public async resolveConflict(
    documentId: string,
    resolution: 'keep_local' | 'revert_disk',
    diskContent?: string
  ): Promise<void> {
    await globalDocumentEngine.resolveConflict(documentId, resolution, diskContent);

    const doc = globalDocumentEngine.getDocument(documentId);
    const uri = doc ? doc.resourceUri : '';

    await this.emit('watcher.conflictResolved', {
      documentId,
      uri,
      resolution,
    });

    logger.info('ResourceSynchronizationService: conflict resolved', {
      documentId,
      resolution,
      uri,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Events & Lifecycle
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

  public async emit<K extends WatcherEventKey>(
    event: K,
    payload: WatcherEventMap[K]
  ): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    for (const listener of handlers) {
      try {
        await listener(payload);
      } catch (err) {
        logger.error(`ResourceSynchronizationService: error in listener for "${event}"`, {
          error: (err as Error).message,
        });
      }
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    this.listeners.clear();
    this.saveCorrelationManager.clear();
    logger.info('ResourceSynchronizationService: disposed');
  }
}

export const globalResourceSynchronizationService = new ResourceSynchronizationService();
