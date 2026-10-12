import { describe, it, expect } from 'vitest';
import {
  invertChanges,
  createInverseTransaction,
  createForwardTransactionFromEntry,
} from './HistoryInversion';
import { CommittedEditTransaction, SingleTextEdit } from '../edit/EditTypes';
import { HistoryEntry } from './HistoryTypes';

describe('HistoryInversion', () => {
  it('inverts a single text insertion into a deletion', () => {
    // Insert "hello" at offset 5 in original text "12345"
    const forwardEdit: SingleTextEdit = {
      from: 5,
      to: 5,
      insertText: 'hello',
      deletedText: '',
    };

    const inverted = invertChanges([forwardEdit]);
    expect(inverted).toHaveLength(1);
    expect(inverted[0]).toEqual({
      from: 5,
      to: 10, // 5 + 5
      insertText: '',
      deletedText: 'hello',
    });
  });

  it('inverts a single text deletion into an insertion', () => {
    // Delete "world" at offset 6..11
    const forwardEdit: SingleTextEdit = {
      from: 6,
      to: 11,
      insertText: '',
      deletedText: 'world',
    };

    const inverted = invertChanges([forwardEdit]);
    expect(inverted).toHaveLength(1);
    expect(inverted[0]).toEqual({
      from: 6,
      to: 6,
      insertText: 'world',
      deletedText: '',
    });
  });

  it('inverts a text replacement range', () => {
    // Replace "foo" (len 3) with "barbaz" (len 6) at offset 2..5
    const forwardEdit: SingleTextEdit = {
      from: 2,
      to: 5,
      insertText: 'barbaz',
      deletedText: 'foo',
    };

    const inverted = invertChanges([forwardEdit]);
    expect(inverted).toHaveLength(1);
    expect(inverted[0]).toEqual({
      from: 2,
      to: 8, // 2 + 6
      insertText: 'foo',
      deletedText: 'barbaz',
    });
  });

  it('inverts multiple simultaneous edits with cumulative offset shifts', () => {
    // Original: "ABC DEF GHI"
    // Edit 1: replace "ABC" [0, 3] with "1234" (len 4, delta +1)
    // Edit 2: replace "GHI" [8, 11] with "XYZ" (len 3, delta 0)
    const forwardEdits: SingleTextEdit[] = [
      { from: 0, to: 3, insertText: '1234', deletedText: 'ABC' },
      { from: 8, to: 11, insertText: 'XYZ', deletedText: 'GHI' },
    ];

    const inverted = invertChanges(forwardEdits);
    expect(inverted).toHaveLength(2);

    // Inverted 1: in modified string, "1234" is at [0, 4]
    expect(inverted[0]).toEqual({
      from: 0,
      to: 4,
      insertText: 'ABC',
      deletedText: '1234',
    });

    // Inverted 2: "XYZ" is at [8 + 1, 8 + 1 + 3] = [9, 12]
    expect(inverted[1]).toEqual({
      from: 9,
      to: 12,
      insertText: 'GHI',
      deletedText: 'XYZ',
    });
  });

  it('creates an inverse transaction with swapped selections and base/target revisions', () => {
    const committedTx: CommittedEditTransaction = {
      id: 'tx-123',
      documentId: 'doc-1',
      baseRevision: 2,
      targetRevision: 3,
      changes: [{ from: 0, to: 1, insertText: 'B', deletedText: 'A' }],
      origin: 'user',
      timestamp: 1000,
      appliedAt: 1001,
      isComposition: false,
      contentBefore: 'A',
      contentAfter: 'B',
      isDirty: true,
      selectionsBefore: [{ anchor: 1, head: 1 }],
      selectionsAfter: [{ anchor: 2, head: 2 }],
    };

    const inverse = createInverseTransaction(committedTx);
    expect(inverse.id).toBe('undo-tx-123');
    expect(inverse.documentId).toBe('doc-1');
    expect(inverse.baseRevision).toBe(3);
    expect(inverse.targetRevision).toBe(2);
    expect(inverse.origin).toBe('undo');
    expect(inverse.selectionsBefore).toEqual([{ anchor: 2, head: 2 }]);
    expect(inverse.selectionsAfter).toEqual([{ anchor: 1, head: 1 }]);
  });

  it('creates a forward transaction from history entry for redo', () => {
    const entry: HistoryEntry = {
      id: 'entry-1',
      documentId: 'doc-1',
      baseRevision: 0,
      targetRevision: 1,
      forwardTransaction: {
        id: 'tx-1',
        documentId: 'doc-1',
        baseRevision: 0,
        targetRevision: 1,
        changes: [{ from: 0, to: 0, insertText: 'Hello', deletedText: '' }],
        origin: 'user',
        timestamp: 1000,
        appliedAt: 1001,
        isComposition: false,
        contentBefore: '',
        contentAfter: 'Hello',
        isDirty: true,
      },
      inverseTransaction: {
        documentId: 'doc-1',
        baseRevision: 1,
        targetRevision: 0,
        changes: [{ from: 0, to: 5, insertText: '', deletedText: 'Hello' }],
        origin: 'undo',
      },
      timestamp: 1001,
      selectionsBefore: [{ anchor: 0, head: 0 }],
      selectionsAfter: [{ anchor: 5, head: 5 }],
    };

    const forwardTx = createForwardTransactionFromEntry(entry, 0);
    expect(forwardTx.id).toBe('redo-tx-1');
    expect(forwardTx.baseRevision).toBe(0);
    expect(forwardTx.targetRevision).toBe(1);
    expect(forwardTx.origin).toBe('redo');
    expect(forwardTx.changes).toEqual(entry.forwardTransaction.changes);
  });
});
