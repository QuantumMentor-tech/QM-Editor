/**
 * QM Editor Canonical Document History & Undo/Redo Service
 * Phase 04, Step 33 — Core Document Lifecycle Subsystem
 */

import { DocumentModel } from '../../types';
import { CommittedEditTransaction } from '../edit/EditTypes';
import { globalEditTransactionManager } from '../edit';
import { DocumentHistoryStack } from './DocumentHistoryStack';
import {
  HistoryEventKey,
  HistoryEventMap,
  HistoryEventListener,
  DocumentHistorySnapshot,
  isEditGroup,
  DocumentHistoryOptions,
} from './HistoryTypes';
import {
  NothingToUndoError,
  NothingToRedoError,
} from './HistoryErrors';
import { createForwardTransactionFromEntry } from './HistoryInversion';
import { logger } from '../../utils/logger';

export class DocumentHistoryService {
  private stacks = new Map<string, DocumentHistoryStack>();
  private listeners = new Map<HistoryEventKey, Set<HistoryEventListener<any>>>();
  private defaultOptions: DocumentHistoryOptions;
  private unsubscribeTxManager?: () => void;

  constructor(options: DocumentHistoryOptions = {}) {
    this.defaultOptions = options;

    // Automatically bind to EditTransactionManager committed events
    this.unsubscribeTxManager = globalEditTransactionManager.on(
      'document.transactionApplied',
      (payload) => {
        this.handleTransactionApplied(payload.transaction);
      }
    );
  }

  // ---------------------------------------------------------------------------
  // 1. Stack Registry
  // ---------------------------------------------------------------------------

  public getOrCreateStack(documentId: string): DocumentHistoryStack {
    let stack = this.stacks.get(documentId);
    if (!stack) {
      stack = new DocumentHistoryStack(documentId, this.defaultOptions);
      this.stacks.set(documentId, stack);
    }
    return stack;
  }

  public getStack(documentId: string): DocumentHistoryStack | undefined {
    return this.stacks.get(documentId);
  }

  private handleTransactionApplied(transaction: CommittedEditTransaction): void {
    // Only capture forward modifications; undo and redo manage stack placement explicitly
    if (transaction.origin === 'undo' || transaction.origin === 'redo') {
      return;
    }

    const stack = this.getOrCreateStack(transaction.documentId);
    const entry = stack.push(transaction);

    this.emit('history.entryAdded', {
      documentId: transaction.documentId,
      entryId: entry.id,
      groupId: entry.groupId,
      canUndo: stack.canUndo(),
      canRedo: stack.canRedo(),
    }).catch(() => {});
  }

  // ---------------------------------------------------------------------------
  // 2. Undo / Redo Operations
  // ---------------------------------------------------------------------------

  /**
   * Undoes the last edit or edit group for the target document.
   */
  public async undo(
    document: DocumentModel
  ): Promise<{ document: DocumentModel; transaction: CommittedEditTransaction }> {
    const stack = this.getOrCreateStack(document.id);
    if (!stack.canUndo()) {
      throw new NothingToUndoError(document.id);
    }

    const item = stack.popUndo()!;

    if (!isEditGroup(item)) {
      // Single HistoryEntry undo
      try {
        const result = await globalEditTransactionManager.applyTransaction(
          document,
          item.inverseTransaction,
          { strictRevision: false }
        );

        stack.pushRedo(item);

        this.emit('history.undone', {
          documentId: document.id,
          undoneRevision: item.targetRevision,
          newRevision: result.document.contentRevision,
          canUndo: stack.canUndo(),
          canRedo: stack.canRedo(),
        }).catch(() => {});

        logger.info('DocumentHistoryService: undo applied', {
          documentId: document.id,
          undoneRevision: item.targetRevision,
          restoredRevision: result.document.contentRevision,
          isDirty: result.document.isDirty,
        });

        return result;
      } catch (err) {
        // Roll back pop if application failed
        stack.pushUndo(item);
        throw err;
      }
    } else {
      // EditGroup undo: apply inverse transactions in reverse chronological order
      let currentDoc = document;
      let lastResult: { document: DocumentModel; transaction: CommittedEditTransaction } | null = null;
      const appliedEntries: typeof item.entries = [];

      try {
        for (let i = item.entries.length - 1; i >= 0; i--) {
          const entry = item.entries[i];
          const result = await globalEditTransactionManager.applyTransaction(
            currentDoc,
            entry.inverseTransaction,
            { strictRevision: false }
          );
          currentDoc = result.document;
          lastResult = result;
          appliedEntries.push(entry);
        }

        stack.pushRedo(item);

        this.emit('history.undone', {
          documentId: document.id,
          undoneRevision: item.entries[item.entries.length - 1].targetRevision,
          newRevision: currentDoc.contentRevision,
          canUndo: stack.canUndo(),
          canRedo: stack.canRedo(),
        }).catch(() => {});

        logger.info('DocumentHistoryService: edit group undo applied', {
          documentId: document.id,
          groupLabel: item.label,
          entriesCount: item.entries.length,
          restoredRevision: currentDoc.contentRevision,
          isDirty: currentDoc.isDirty,
        });

        return lastResult!;
      } catch (err) {
        stack.pushUndo(item);
        throw err;
      }
    }
  }

  /**
   * Redoes the last undone edit or edit group for the target document.
   */
  public async redo(
    document: DocumentModel
  ): Promise<{ document: DocumentModel; transaction: CommittedEditTransaction }> {
    const stack = this.getOrCreateStack(document.id);
    if (!stack.canRedo()) {
      throw new NothingToRedoError(document.id);
    }

    const item = stack.popRedo()!;

    if (!isEditGroup(item)) {
      // Single HistoryEntry redo
      try {
        const forwardTx = createForwardTransactionFromEntry(item, document.contentRevision);
        const result = await globalEditTransactionManager.applyTransaction(
          document,
          forwardTx,
          { strictRevision: false }
        );

        stack.pushUndo(item);

        this.emit('history.redone', {
          documentId: document.id,
          redoneRevision: item.targetRevision,
          newRevision: result.document.contentRevision,
          canUndo: stack.canUndo(),
          canRedo: stack.canRedo(),
        }).catch(() => {});

        logger.info('DocumentHistoryService: redo applied', {
          documentId: document.id,
          redoneRevision: item.targetRevision,
          restoredRevision: result.document.contentRevision,
          isDirty: result.document.isDirty,
        });

        return result;
      } catch (err) {
        stack.pushRedo(item);
        throw err;
      }
    } else {
      // EditGroup redo: apply forward transactions in chronological order
      let currentDoc = document;
      let lastResult: { document: DocumentModel; transaction: CommittedEditTransaction } | null = null;

      try {
        for (let i = 0; i < item.entries.length; i++) {
          const entry = item.entries[i];
          const forwardTx = createForwardTransactionFromEntry(entry, currentDoc.contentRevision);
          const result = await globalEditTransactionManager.applyTransaction(
            currentDoc,
            forwardTx,
            { strictRevision: false }
          );
          currentDoc = result.document;
          lastResult = result;
        }

        stack.pushUndo(item);

        this.emit('history.redone', {
          documentId: document.id,
          redoneRevision: item.entries[item.entries.length - 1].targetRevision,
          newRevision: currentDoc.contentRevision,
          canUndo: stack.canUndo(),
          canRedo: stack.canRedo(),
        }).catch(() => {});

        logger.info('DocumentHistoryService: edit group redo applied', {
          documentId: document.id,
          groupLabel: item.label,
          entriesCount: item.entries.length,
          restoredRevision: currentDoc.contentRevision,
          isDirty: currentDoc.isDirty,
        });

        return lastResult!;
      } catch (err) {
        stack.pushRedo(item);
        throw err;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Edit Grouping API
  // ---------------------------------------------------------------------------

  public beginGroup(documentId: string, label?: string): string {
    const stack = this.getOrCreateStack(documentId);
    const groupId = stack.beginGroup(label);
    this.emit('history.groupStarted', { documentId, groupId, label }).catch(() => {});
    return groupId;
  }

  public endGroup(documentId: string): void {
    const stack = this.stacks.get(documentId);
    if (!stack) return;
    stack.endGroup();
  }

  public async withGroup<T>(
    documentId: string,
    label: string,
    fn: () => Promise<T> | T
  ): Promise<T> {
    const groupId = this.beginGroup(documentId, label);
    try {
      const result = await fn();
      return result;
    } finally {
      this.endGroup(documentId);
      this.emit('history.groupEnded', { documentId, groupId }).catch(() => {});
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Inspection & State Queries
  // ---------------------------------------------------------------------------

  public canUndo(documentId: string): boolean {
    const stack = this.stacks.get(documentId);
    return stack ? stack.canUndo() : false;
  }

  public canRedo(documentId: string): boolean {
    const stack = this.stacks.get(documentId);
    return stack ? stack.canRedo() : false;
  }

  public getSnapshot(documentId: string): DocumentHistorySnapshot {
    const stack = this.stacks.get(documentId);
    if (!stack) {
      return {
        documentId,
        undoCount: 0,
        redoCount: 0,
        canUndo: false,
        canRedo: false,
      };
    }
    return {
      documentId,
      undoCount: stack.getUndoCount(),
      redoCount: stack.getRedoCount(),
      savedRevision: stack.getSavedRevision(),
      canUndo: stack.canUndo(),
      canRedo: stack.canRedo(),
    };
  }

  public markSaved(documentId: string, savedRevision: number): void {
    const stack = this.getOrCreateStack(documentId);
    stack.markSaved(savedRevision);
    this.emit('history.savedRevisionSet', { documentId, savedRevision }).catch(() => {});
  }

  public clear(documentId: string): void {
    const stack = this.stacks.get(documentId);
    if (stack) {
      stack.clear();
      this.emit('history.cleared', { documentId }).catch(() => {});
    }
  }

  public disposeDocument(documentId: string): void {
    this.stacks.delete(documentId);
  }

  // ---------------------------------------------------------------------------
  // 5. History Events & Lifecycle
  // ---------------------------------------------------------------------------

  public on<K extends HistoryEventKey>(
    event: K,
    listener: HistoryEventListener<K>
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as HistoryEventListener<any>);

    return () => {
      this.listeners.get(event)?.delete(listener as HistoryEventListener<any>);
    };
  }

  private async emit<K extends HistoryEventKey>(
    event: K,
    payload: HistoryEventMap[K]
  ): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    for (const listener of handlers) {
      try {
        await listener(payload);
      } catch (err) {
        logger.error(`DocumentHistoryService: error in listener for "${event}"`, {
          error: (err as Error).message,
        });
      }
    }
  }

  public dispose(): void {
    if (this.unsubscribeTxManager) {
      this.unsubscribeTxManager();
      this.unsubscribeTxManager = undefined;
    }
    this.stacks.clear();
    this.listeners.clear();
  }
}

/**
 * Global singleton DocumentHistoryService instance
 */
export const globalDocumentHistoryService = new DocumentHistoryService();
