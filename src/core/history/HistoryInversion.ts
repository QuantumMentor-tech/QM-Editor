/**
 * QM Editor Undo/Redo Edit Inversion Engine
 * Phase 04, Step 33 — Core Document Lifecycle Subsystem
 */

import {
  SingleTextEdit,
  CommittedEditTransaction,
  EditTransaction,
} from '../edit/EditTypes';
import { HistoryEntry } from './HistoryTypes';

/**
 * Inverts a batch of non-overlapping text edits applied to a document.
 * The input edits MUST be sorted ascending by their starting offset.
 */
export function invertChanges(changes: SingleTextEdit[]): SingleTextEdit[] {
  if (!changes || changes.length === 0) {
    return [];
  }

  // Sort ascending by starting offset
  const sorted = [...changes].sort((a, b) => a.from - b.from || a.to - b.to);

  let cumulativeDelta = 0;
  const inverted: SingleTextEdit[] = [];

  for (const ch of sorted) {
    const deletedText = ch.deletedText !== undefined ? ch.deletedText : '';
    const insertLength = ch.insertText.length;
    const deleteLength = ch.to - ch.from;

    const newFrom = ch.from + cumulativeDelta;
    const newTo = newFrom + insertLength;

    inverted.push({
      from: newFrom,
      to: newTo,
      insertText: deletedText,
      deletedText: ch.insertText,
    });

    cumulativeDelta += insertLength - deleteLength;
  }

  // Return inverted edits sorted ascending by starting offset
  return inverted.sort((a, b) => a.from - b.from || a.to - b.to);
}

/**
 * Creates an atomic inverse transaction from a committed forward transaction.
 * When applied, the inverse transaction rolls back the document to its contentBefore.
 */
export function createInverseTransaction(
  committedTx: CommittedEditTransaction
): EditTransaction {
  const invertedChanges = invertChanges(committedTx.changes);

  return {
    id: `undo-${committedTx.id}`,
    documentId: committedTx.documentId,
    baseRevision: committedTx.targetRevision,
    targetRevision: committedTx.baseRevision,
    changes: invertedChanges,
    origin: 'undo',
    timestamp: Date.now(),
    isComposition: committedTx.isComposition,
    selectionsBefore: committedTx.selectionsAfter,
    selectionsAfter: committedTx.selectionsBefore,
    metadata: {
      ...committedTx.metadata,
      undoneTransactionId: committedTx.id,
    },
  };
}

/**
 * Creates a forward transaction from a history entry for redoing.
 */
export function createForwardTransactionFromEntry(
  entry: HistoryEntry,
  currentRevision: number
): EditTransaction {
  return {
    id: `redo-${entry.forwardTransaction.id}`,
    documentId: entry.documentId,
    baseRevision: currentRevision,
    targetRevision: entry.targetRevision,
    changes: entry.forwardTransaction.changes,
    origin: 'redo',
    timestamp: Date.now(),
    isComposition: entry.forwardTransaction.isComposition,
    selectionsBefore: entry.selectionsBefore,
    selectionsAfter: entry.selectionsAfter,
    metadata: {
      ...entry.forwardTransaction.metadata,
      redoneTransactionId: entry.forwardTransaction.id,
    },
  };
}
