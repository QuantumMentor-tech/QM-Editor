/**
 * QM Editor Edit Transaction Manager & Revision Consistency Engine
 * Phase 04, Step 31 — Core Document Lifecycle Subsystem
 */

import { DocumentModel } from '../../types';
import {
  SingleTextEdit,
  EditTransaction,
  CommittedEditTransaction,
  DocumentChangeEventKey,
  DocumentChangeEventMap,
  DocumentChangeEventListener,
  CursorSelection,
} from './EditTypes';
import {
  InvalidEditRangeError,
  OverlappingEditError,
  StaleRevisionError,
  ReadOnlyDocumentError,
} from './EditErrors';
import { logger } from '../../utils/logger';

export interface ApplyTransactionOptions {
  strictRevision?: boolean;
}

export class EditTransactionManager {
  private listeners = new Map<DocumentChangeEventKey, Set<DocumentChangeEventListener<any>>>();
  private activeCompositions = new Set<string>();

  // ---------------------------------------------------------------------------
  // 1. Change Validation & Ordering
  // ---------------------------------------------------------------------------

  /**
   * Validates a batch of text edits against document text length.
   * Ensures edits are within range, sorted, and non-overlapping.
   */
  public validateChanges(content: string, changes: SingleTextEdit[]): SingleTextEdit[] {
    if (!changes || changes.length === 0) {
      return [];
    }

    const contentLength = content.length;

    // Boundary check
    for (const ch of changes) {
      if (ch.from < 0 || ch.to > contentLength || ch.from > ch.to) {
        throw new InvalidEditRangeError(ch.from, ch.to, contentLength);
      }
    }

    // Sort ascending by starting offset
    const sorted = [...changes].sort((a, b) => a.from - b.from || a.to - b.to);

    // Overlap check
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // Overlap occurs if the end of current strictly exceeds the start of next
      if (current.to > next.from) {
        throw new OverlappingEditError(current.from, current.to, next.from, next.to);
      }
    }

    // Snapshot deleted text if omitted
    return sorted.map((ch) => ({
      from: ch.from,
      to: ch.to,
      insertText: ch.insertText,
      deletedText: ch.deletedText !== undefined ? ch.deletedText : content.slice(ch.from, ch.to),
    }));
  }

  /**
   * Applies validated edits to content in reverse offset order (highest offset first).
   * This guarantees offset stability during multi-cursor and batch replacements.
   */
  public applyChanges(content: string, changes: SingleTextEdit[]): string {
    if (!changes || changes.length === 0) {
      return content;
    }

    // Sort descending by starting offset
    const descending = [...changes].sort((a, b) => b.from - a.from || b.to - a.to);

    let result = content;
    for (const ch of descending) {
      const before = result.slice(0, ch.from);
      const after = result.slice(ch.to);
      result = before + ch.insertText + after;
    }

    return result;
  }

  /**
   * Maps a character offset forward through a set of applied edits.
   * Useful for tracking cursor and selection positions after edits.
   */
  public mapOffsetThroughChanges(offset: number, changes: SingleTextEdit[]): number {
    if (!changes || changes.length === 0) return offset;

    const ascending = [...changes].sort((a, b) => a.from - b.from);
    let mapped = offset;
    let cumulativeDelta = 0;

    for (const ch of ascending) {
      if (offset < ch.from) {
        break;
      }
      if (offset <= ch.to) {
        mapped = ch.from + cumulativeDelta + ch.insertText.length;
        break;
      } else {
        const delta = ch.insertText.length - (ch.to - ch.from);
        cumulativeDelta += delta;
        mapped = offset + cumulativeDelta;
      }
    }

    return Math.max(0, mapped);
  }

  /**
   * Maps cursor selections forward through a set of applied edits.
   */
  public mapSelectionsThroughChanges(
    selections: CursorSelection[] | undefined,
    changes: SingleTextEdit[]
  ): CursorSelection[] | undefined {
    if (!selections) return undefined;
    return selections.map((sel) => ({
      anchor: this.mapOffsetThroughChanges(sel.anchor, changes),
      head: this.mapOffsetThroughChanges(sel.head, changes),
    }));
  }

  // ---------------------------------------------------------------------------
  // 2. Transaction Execution & Revision Invariants
  // ---------------------------------------------------------------------------

  /**
   * Executes an atomic EditTransaction against a DocumentModel.
   * Enforces revision monotonicity, dirty-state invariants, and event publishing.
   */
  public async applyTransaction(
    document: DocumentModel,
    transaction: EditTransaction,
    options: ApplyTransactionOptions = {}
  ): Promise<{ document: DocumentModel; transaction: CommittedEditTransaction }> {
    if (document.fileResource?.readOnly) {
      throw new ReadOnlyDocumentError(document.id, document.title);
    }

    if (options.strictRevision && transaction.baseRevision !== document.contentRevision) {
      throw new StaleRevisionError(document.id, transaction.baseRevision, document.contentRevision);
    }

    try {
      // 1. Emit willApply event
      await this.emit('document.transactionWillApply', {
        documentId: document.id,
        transaction,
        currentRevision: document.contentRevision,
      });

      // 2. Validate and snapshot changes
      const validatedChanges = this.validateChanges(document.content, transaction.changes);

      // 3. Apply changes in reverse offset order
      const contentBefore = document.content;
      const contentAfter = this.applyChanges(contentBefore, validatedChanges);

      const hasContentChanged = contentBefore !== contentAfter;
      const nextRevision =
        transaction.targetRevision !== undefined
          ? transaction.targetRevision
          : hasContentChanged
          ? document.contentRevision + 1
          : document.contentRevision;
      const isDirty = nextRevision !== document.savedRevision;
      const dirtyStateToggled = isDirty !== document.isDirty;

      const txId = transaction.id || `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = Date.now();

      const selectionsAfter =
        transaction.selectionsAfter ||
        this.mapSelectionsThroughChanges(transaction.selectionsBefore, validatedChanges);

      const committedTx: CommittedEditTransaction = {
        id: txId,
        documentId: document.id,
        baseRevision: document.contentRevision,
        targetRevision: nextRevision,
        changes: validatedChanges,
        origin: transaction.origin || 'user',
        timestamp: transaction.timestamp || now,
        appliedAt: now,
        isComposition: Boolean(transaction.isComposition),
        contentBefore,
        contentAfter,
        isDirty,
        selectionsBefore: transaction.selectionsBefore,
        selectionsAfter,
        metadata: transaction.metadata,
      };

      const updatedDocument: DocumentModel = {
        ...document,
        content: contentAfter,
        contentRevision: nextRevision,
        isDirty,
      };

      // 4. Emit transactionApplied
      await this.emit('document.transactionApplied', {
        documentId: document.id,
        transaction: committedTx,
        previousRevision: document.contentRevision,
        newRevision: nextRevision,
        isDirty,
      });

      // 5. Emit dirtyStateChanged if toggled
      if (dirtyStateToggled) {
        await this.emit('document.dirtyStateChanged', {
          documentId: document.id,
          isDirty,
          revision: nextRevision,
          savedRevision: document.savedRevision,
        });
      }

      logger.info('EditTransactionManager: transaction applied', {
        documentId: document.id,
        txId,
        origin: committedTx.origin,
        changesCount: validatedChanges.length,
        prevRev: document.contentRevision,
        newRev: nextRevision,
        isDirty,
      });

      return { document: updatedDocument, transaction: committedTx };
    } catch (err) {
      const errorMsg = (err as Error).message || String(err);
      await this.emit('document.transactionFailed', {
        documentId: document.id,
        transaction,
        error: errorMsg,
      });
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. IME Composition Lifecycle
  // ---------------------------------------------------------------------------

  public startComposition(documentId: string): void {
    this.activeCompositions.add(documentId);
    this.emit('document.compositionStarted', {
      documentId,
      timestamp: Date.now(),
    }).catch(() => {});
  }

  public endComposition(documentId: string, committedRevision: number): void {
    this.activeCompositions.delete(documentId);
    this.emit('document.compositionEnded', {
      documentId,
      committedRevision,
      timestamp: Date.now(),
    }).catch(() => {});
  }

  public isComposing(documentId: string): boolean {
    return this.activeCompositions.has(documentId);
  }

  // ---------------------------------------------------------------------------
  // 4. Change Event Subscriptions
  // ---------------------------------------------------------------------------

  public on<K extends DocumentChangeEventKey>(
    event: K,
    listener: DocumentChangeEventListener<K>
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as DocumentChangeEventListener<any>);

    return () => {
      this.listeners.get(event)?.delete(listener as DocumentChangeEventListener<any>);
    };
  }

  private async emit<K extends DocumentChangeEventKey>(
    event: K,
    payload: DocumentChangeEventMap[K]
  ): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    for (const listener of handlers) {
      try {
        await listener(payload);
      } catch (err) {
        logger.error(`EditTransactionManager: error in subscriber for "${event}"`, {
          error: (err as Error).message,
        });
      }
    }
  }
}

/**
 * Global singleton EditTransactionManager instance
 */
export const globalEditTransactionManager = new EditTransactionManager();
