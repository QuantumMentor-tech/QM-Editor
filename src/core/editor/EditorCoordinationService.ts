/**
 * QM Editor Engine Coordination Service
 * Phase 04, Step 37 — Core Application Engine
 */

import {
  TextModel,
  EditorViewState,
  ProgrammaticEditTransaction,
  TransactionApplyResult,
  EditorInstanceRecord,
  EditorCoordinationEventMap,
  EditorCoordinationEventKey,
  EditorCoordinationEventListener,
} from './EditorTypes';
import {
  DocumentNotAvailableError,
  ReadOnlyEditError,
  ConflictEditError,
  StaleTransactionError,
  InvalidEditRangeError,
} from './EditorErrors';
import { TextModelImpl } from './TextModelImpl';
import { EditorViewStateManager } from './EditorViewStateManager';
import { EditorAdapterInterface } from '../../components/editor/EditorAdapter';
import { globalDocumentEngine } from '../documents/DocumentEngine';
import { logger } from '../../utils/logger';

export class EditorCoordinationService {
  private instances = new Map<string, EditorInstanceRecord>();
  private viewStateManager = new EditorViewStateManager();
  private listeners = new Map<
    EditorCoordinationEventKey,
    Set<EditorCoordinationEventListener<any>>
  >();
  private isDisposed = false;

  // ---------------------------------------------------------------------------
  // 1. Text Model Access
  // ---------------------------------------------------------------------------

  /**
   * Retrieves the canonical TextModel for an open document.
   */
  public getTextModel(documentId: string): TextModel {
    this.assertNotDisposed('getTextModel');
    const doc = globalDocumentEngine.getDocument(documentId);
    if (!doc) {
      throw new DocumentNotAvailableError(documentId);
    }
    return new TextModelImpl(doc);
  }

  // ---------------------------------------------------------------------------
  // 2. Editor Instance Registry
  // ---------------------------------------------------------------------------

  /**
   * Registers a mounted visual editor instance.
   */
  public registerEditorInstance(
    instanceId: string,
    documentId: string,
    adapter: EditorAdapterInterface
  ): void {
    this.assertNotDisposed('registerEditorInstance');

    const record: EditorInstanceRecord = {
      id: instanceId,
      documentId,
      adapter,
      createdAt: Date.now(),
    };

    this.instances.set(instanceId, record);

    this.emit('editor.instanceRegistered', {
      instanceId,
      documentId,
    }).catch((err) => {
      logger.error('Error emitting editor.instanceRegistered', { error: (err as Error).message });
    });

    logger.info('EditorCoordinationService: registered editor instance', {
      instanceId,
      documentId,
    });
  }

  /**
   * Unregisters a visual editor instance, saving its view state beforehand.
   */
  public unregisterEditorInstance(instanceId: string): void {
    if (this.isDisposed) return;

    const existing = this.instances.get(instanceId);
    if (!existing) return;

    // Save final view state before tearing down
    try {
      this.saveViewStateForInstance(instanceId, existing.documentId);
    } catch {
      // Best-effort during unmount
    }

    this.instances.delete(instanceId);

    this.emit('editor.instanceUnregistered', {
      instanceId,
      documentId: existing.documentId,
    }).catch((err) => {
      logger.error('Error emitting editor.instanceUnregistered', { error: (err as Error).message });
    });

    logger.info('EditorCoordinationService: unregistered editor instance', {
      instanceId,
      documentId: existing.documentId,
    });
  }

  public getEditorInstance(instanceId: string): EditorInstanceRecord | undefined {
    return this.instances.get(instanceId);
  }

  public getEditorInstanceForDocument(documentId: string): EditorInstanceRecord | undefined {
    for (const inst of this.instances.values()) {
      if (inst.documentId === documentId) {
        return inst;
      }
    }
    return undefined;
  }

  public getAllInstances(): EditorInstanceRecord[] {
    return Array.from(this.instances.values());
  }

  // ---------------------------------------------------------------------------
  // 3. View State Coordination
  // ---------------------------------------------------------------------------

  public getViewStateManager(): EditorViewStateManager {
    return this.viewStateManager;
  }

  /**
   * Captures and persists view state from a mounted adapter.
   */
  public saveViewStateForInstance(
    instanceId: string,
    documentId: string
  ): EditorViewState | undefined {
    this.assertNotDisposed('saveViewStateForInstance');

    const instance = this.instances.get(instanceId);
    if (!instance) return undefined;

    let cursorPosition = { line: 1, column: 1 };
    let selections: Array<{ anchor: number; head: number }> = [];
    let scrollPosition: { top: number; left: number } | undefined;

    if (instance.adapter.getViewState) {
      const vs = instance.adapter.getViewState();
      cursorPosition = vs.cursorPosition;
      selections = vs.selections;
      scrollPosition = vs.scrollPosition;
    } else {
      cursorPosition = instance.adapter.getCursorPosition();
    }

    const saved = this.viewStateManager.saveViewState(documentId, {
      cursorPosition,
      selections,
      scrollPosition,
    });

    this.emit('editor.viewStateSaved', {
      documentId,
      cursorPosition,
    }).catch(() => {});

    return saved;
  }

  /**
   * Restores clamped view state into a mounted adapter.
   */
  public restoreViewStateForInstance(instanceId: string, documentId: string): boolean {
    this.assertNotDisposed('restoreViewStateForInstance');

    const instance = this.instances.get(instanceId);
    if (!instance) return false;

    const doc = globalDocumentEngine.getDocument(documentId);
    if (!doc) return false;

    const clamped = this.viewStateManager.getClampedViewState(documentId, doc.content);
    if (!clamped) return false;

    if (instance.adapter.restoreViewState) {
      instance.adapter.restoreViewState(clamped);
    } else {
      instance.adapter.goToLine(clamped.cursorPosition.line, clamped.cursorPosition.column);
    }

    this.emit('editor.viewStateRestored', {
      documentId,
      cursorPosition: clamped.cursorPosition,
    }).catch(() => {});

    return true;
  }

  public getViewState(documentId: string): EditorViewState | undefined {
    return this.viewStateManager.getViewState(documentId);
  }

  public clearViewState(documentId: string): void {
    this.viewStateManager.clearViewState(documentId);
  }

  public getCursorPosition(documentId?: string): { line: number; column: number } | undefined {
    const targetId = documentId || globalDocumentEngine.getActiveDocumentId();
    if (!targetId) return undefined;
    return this.viewStateManager.getViewState(targetId)?.cursorPosition;
  }

  public setCursorPosition(pos: { line: number; column: number }, documentId?: string): void {
    const targetId = documentId || globalDocumentEngine.getActiveDocumentId();
    if (!targetId) return;
    this.viewStateManager.saveViewState(targetId, {
      cursorPosition: pos,
      selections: [],
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Programmatic Edit Transactions
  // ---------------------------------------------------------------------------

  /**
   * Applies an atomic programmatic edit transaction across the editor coordination boundary.
   */
  public async applyTransaction(
    tx: ProgrammaticEditTransaction
  ): Promise<TransactionApplyResult> {
    this.assertNotDisposed('applyTransaction');

    const doc = globalDocumentEngine.getDocument(tx.documentId);
    if (!doc) {
      const err = `Document "${tx.documentId}" is not available in DocumentEngine.`;
      await this.emit('editor.transactionRejected', {
        documentId: tx.documentId,
        reason: err,
        expectedRevision: tx.expectedRevision,
      });
      return {
        status: 'rejected',
        documentId: tx.documentId,
        appliedOperationsCount: 0,
        error: err,
      };
    }

    // 1. Read-only validation
    if (doc.metadata.isReadOnly) {
      const reason = 'Document is marked read-only.';
      await this.emit('editor.transactionRejected', {
        documentId: tx.documentId,
        reason,
        expectedRevision: tx.expectedRevision,
        currentRevision: doc.contentRevision,
      });
      return {
        status: 'read_only',
        documentId: tx.documentId,
        appliedOperationsCount: 0,
        error: reason,
      };
    }

    // 2. Conflict state validation
    if (doc.metadata.hasConflict) {
      const reason = 'Document has an unresolved disk conflict.';
      await this.emit('editor.transactionRejected', {
        documentId: tx.documentId,
        reason,
        expectedRevision: tx.expectedRevision,
        currentRevision: doc.contentRevision,
      });
      return {
        status: 'conflict',
        documentId: tx.documentId,
        appliedOperationsCount: 0,
        error: reason,
      };
    }

    // 3. Stale revision protection
    if (tx.expectedRevision !== undefined && doc.contentRevision !== tx.expectedRevision) {
      const reason = `Stale transaction: expected revision ${tx.expectedRevision}, but document is at revision ${doc.contentRevision}.`;
      await this.emit('editor.transactionRejected', {
        documentId: tx.documentId,
        reason,
        expectedRevision: tx.expectedRevision,
        currentRevision: doc.contentRevision,
      });
      return {
        status: 'stale',
        documentId: tx.documentId,
        appliedOperationsCount: 0,
        error: reason,
      };
    }

    // 4. Validate ranges
    const maxLen = doc.content.length;
    for (const change of tx.changes) {
      if (change.from < 0 || change.to > maxLen || change.from > change.to) {
        const reason = `Invalid edit range [${change.from}, ${change.to}] exceeds document length ${maxLen}.`;
        await this.emit('editor.transactionRejected', {
          documentId: tx.documentId,
          reason,
          expectedRevision: tx.expectedRevision,
          currentRevision: doc.contentRevision,
        });
        return {
          status: 'invalid_range',
          documentId: tx.documentId,
          appliedOperationsCount: 0,
          error: reason,
        };
      }
    }

    // 5. Validate non-overlapping edits
    const sortedAsc = [...tx.changes].sort((a, b) => a.from - b.from);
    for (let i = 0; i < sortedAsc.length - 1; i++) {
      if (sortedAsc[i].to > sortedAsc[i + 1].from) {
        const reason = 'Overlapping edit ranges in transaction are not allowed.';
        await this.emit('editor.transactionRejected', {
          documentId: tx.documentId,
          reason,
          expectedRevision: tx.expectedRevision,
          currentRevision: doc.contentRevision,
        });
        return {
          status: 'invalid_range',
          documentId: tx.documentId,
          appliedOperationsCount: 0,
          error: reason,
        };
      }
    }

    // 6. Apply edits: if an active mounted editor instance exists, dispatch to its adapter
    const instance = this.getEditorInstanceForDocument(tx.documentId);
    let newContent = doc.content;

    if (instance && instance.adapter.applyEdits) {
      instance.adapter.applyEdits(
        tx.changes.map((c) => ({ from: c.from, to: c.to, insert: c.insertText }))
      );
      newContent = instance.adapter.getContent();
    } else {
      // Headless / unmounted document: apply in descending offset order
      const sortedDesc = [...tx.changes].sort((a, b) => b.from - a.from);
      for (const ch of sortedDesc) {
        newContent = newContent.slice(0, ch.from) + ch.insertText + newContent.slice(ch.to);
      }
    }

    // 7. Synchronize canonical DocumentEngine
    const updatedDoc = await globalDocumentEngine.updateText(
      tx.documentId,
      newContent,
      tx.source || 'programmatic'
    );

    const result: TransactionApplyResult = {
      status: 'applied',
      documentId: tx.documentId,
      newRevision: updatedDoc.contentRevision,
      appliedOperationsCount: tx.changes.length,
    };

    await this.emit('editor.transactionApplied', {
      documentId: tx.documentId,
      source: tx.source || 'programmatic',
      newRevision: updatedDoc.contentRevision,
      operationsCount: tx.changes.length,
    });

    logger.info('EditorCoordinationService: transaction applied successfully', {
      documentId: tx.documentId,
      newRevision: updatedDoc.contentRevision,
      operationsCount: tx.changes.length,
      source: tx.source,
    });

    return result;
  }

  /**
   * Applies an edit transaction strictly, throwing typed EditorErrors upon failure.
   */
  public async applyTransactionStrict(
    tx: ProgrammaticEditTransaction
  ): Promise<TransactionApplyResult> {
    const res = await this.applyTransaction(tx);

    if (res.status === 'read_only') {
      throw new ReadOnlyEditError(tx.documentId);
    }
    if (res.status === 'conflict') {
      throw new ConflictEditError(tx.documentId);
    }
    if (res.status === 'stale') {
      const doc = globalDocumentEngine.getDocument(tx.documentId);
      throw new StaleTransactionError(
        tx.documentId,
        tx.expectedRevision ?? 0,
        doc?.contentRevision ?? 0
      );
    }
    if (res.status === 'invalid_range') {
      const first = tx.changes[0];
      const doc = globalDocumentEngine.getDocument(tx.documentId);
      throw new InvalidEditRangeError(
        first?.from ?? 0,
        first?.to ?? 0,
        doc?.content.length ?? 0
      );
    }
    if (res.status !== 'applied') {
      throw new Error(res.error || `Transaction failed with status: ${res.status}`);
    }

    return res;
  }

  // ---------------------------------------------------------------------------
  // 5. Command Execution Delegation
  // ---------------------------------------------------------------------------

  /**
   * Checks whether an undo operation can be performed for the given document.
   */
  public canUndo(documentId: string): boolean {
    if (this.isDisposed) return false;
    const doc = globalDocumentEngine.getDocument(documentId);
    if (!doc || doc.metadata.isReadOnly || doc.resource?.readOnly) {
      return false;
    }
    const instance = this.getEditorInstanceForDocument(documentId);
    if (!instance) return false;
    if (instance.adapter.canUndo) {
      return instance.adapter.canUndo();
    }
    if (instance.adapter.getHistoryDepth) {
      return instance.adapter.getHistoryDepth().undoDepth > 0;
    }
    return Boolean(instance.adapter.undo);
  }

  /**
   * Checks whether a redo operation can be performed for the given document.
   */
  public canRedo(documentId: string): boolean {
    if (this.isDisposed) return false;
    const doc = globalDocumentEngine.getDocument(documentId);
    if (!doc || doc.metadata.isReadOnly || doc.resource?.readOnly) {
      return false;
    }
    const instance = this.getEditorInstanceForDocument(documentId);
    if (!instance) return false;
    if (instance.adapter.canRedo) {
      return instance.adapter.canRedo();
    }
    if (instance.adapter.getHistoryDepth) {
      return instance.adapter.getHistoryDepth().redoDepth > 0;
    }
    return Boolean(instance.adapter.redo);
  }

  /**
   * Returns the current undo and redo history depth for the document.
   */
  public getHistoryDepth(documentId: string): { undoDepth: number; redoDepth: number } {
    if (this.isDisposed) return { undoDepth: 0, redoDepth: 0 };
    const instance = this.getEditorInstanceForDocument(documentId);
    if (!instance || !instance.adapter.getHistoryDepth) {
      return { undoDepth: 0, redoDepth: 0 };
    }
    return instance.adapter.getHistoryDepth();
  }

  /**
   * Performs an authoritative undo against the editor engine for the target document.
   */
  public async undo(documentId: string): Promise<boolean> {
    this.assertNotDisposed('undo');
    const doc = globalDocumentEngine.getDocument(documentId);
    if (!doc || doc.metadata.isReadOnly || doc.resource?.readOnly) {
      return false;
    }
    const instance = this.getEditorInstanceForDocument(documentId);
    if (!instance || !this.canUndo(documentId)) {
      return false;
    }

    const success = instance.adapter.undo ? instance.adapter.undo() : false;
    if (success) {
      const currentDoc = globalDocumentEngine.getDocument(documentId);
      await this.emit('editor.undoExecuted', {
        documentId,
        newRevision: currentDoc?.contentRevision,
        isDirty: currentDoc?.isDirty,
      });
      return true;
    }
    return false;
  }

  /**
   * Performs an authoritative redo against the editor engine for the target document.
   */
  public async redo(documentId: string): Promise<boolean> {
    this.assertNotDisposed('redo');
    const doc = globalDocumentEngine.getDocument(documentId);
    if (!doc || doc.metadata.isReadOnly || doc.resource?.readOnly) {
      return false;
    }
    const instance = this.getEditorInstanceForDocument(documentId);
    if (!instance || !this.canRedo(documentId)) {
      return false;
    }

    const success = instance.adapter.redo ? instance.adapter.redo() : false;
    if (success) {
      const currentDoc = globalDocumentEngine.getDocument(documentId);
      await this.emit('editor.redoExecuted', {
        documentId,
        newRevision: currentDoc?.contentRevision,
        isDirty: currentDoc?.isDirty,
      });
      return true;
    }
    return false;
  }

  /**
   * Clears the editor native undo/redo history for a document (e.g. on external reload).
   */
  public clearHistory(documentId: string): void {
    if (this.isDisposed) return;
    const instance = this.getEditorInstanceForDocument(documentId);
    if (instance && instance.adapter.clearHistory) {
      instance.adapter.clearHistory();
    }
    this.emit('editor.historyCleared', { documentId }).catch(() => {});
  }

  /**
   * Executes standard editor commands against the mounted editor adapter.
   */
  public executeEditorCommand(
    documentId: string,
    command: 'undo' | 'redo' | 'selectAll' | 'foldAll' | 'unfoldAll' | 'focus'
  ): boolean {
    this.assertNotDisposed('executeEditorCommand');

    const instance = this.getEditorInstanceForDocument(documentId);
    if (!instance) return false;

    switch (command) {
      case 'undo':
        return this.canUndo(documentId) ? (instance.adapter.undo ? instance.adapter.undo() : false) : false;
      case 'redo':
        return this.canRedo(documentId) ? (instance.adapter.redo ? instance.adapter.redo() : false) : false;
      case 'selectAll':
        return instance.adapter.selectAll ? instance.adapter.selectAll() : false;
      case 'foldAll':
        instance.adapter.foldAll();
        return true;
      case 'unfoldAll':
        instance.adapter.unfoldAll();
        return true;
      case 'focus':
        instance.adapter.focus();
        return true;
      default:
        return false;
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Event System
  // ---------------------------------------------------------------------------

  public subscribe<K extends EditorCoordinationEventKey>(
    event: K,
    listener: EditorCoordinationEventListener<K>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      const set = this.listeners.get(event);
      if (set) {
        set.delete(listener);
      }
    };
  }

  public async emit<K extends EditorCoordinationEventKey>(
    event: K,
    payload: EditorCoordinationEventMap[K]
  ): Promise<void> {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;

    const promises: Promise<void>[] = [];
    for (const listener of set) {
      try {
        const res = listener(payload);
        if (res instanceof Promise) {
          promises.push(res);
        }
      } catch (err) {
        logger.error(`Error in editor coordination event listener for ${event}`, {
          error: (err as Error).message,
        });
      }
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Disposal
  // ---------------------------------------------------------------------------

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    this.instances.clear();
    this.viewStateManager.clearAll();
    this.listeners.clear();

    logger.info('EditorCoordinationService: disposed');
  }

  public reset(): void {
    this.isDisposed = false;
    this.instances.clear();
    this.viewStateManager.clearAll();
    this.listeners.clear();
  }

  private assertNotDisposed(method: string): void {
    if (this.isDisposed) {
      throw new Error(`Cannot call ${method}(): EditorCoordinationService has been disposed.`);
    }
  }
}

export const globalEditorCoordinationService = new EditorCoordinationService();
