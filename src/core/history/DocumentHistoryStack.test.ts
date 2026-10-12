import { describe, it, expect } from 'vitest';
import { DocumentHistoryStack } from './DocumentHistoryStack';
import { CommittedEditTransaction } from '../edit/EditTypes';
import { isEditGroup } from './HistoryTypes';
import { InvalidGroupStateError } from './HistoryErrors';

describe('DocumentHistoryStack', () => {
  const createDummyTx = (
    id: string,
    from: number,
    to: number,
    insertText: string,
    deletedText: string = '',
    timestamp: number = Date.now()
  ): CommittedEditTransaction => ({
    id,
    documentId: 'doc-1',
    baseRevision: 0,
    targetRevision: 1,
    changes: [{ from, to, insertText, deletedText }],
    origin: 'user',
    timestamp,
    appliedAt: timestamp,
    isComposition: false,
    contentBefore: '',
    contentAfter: insertText,
    isDirty: true,
  });

  it('pushes transactions onto the undo stack and tracks canUndo/canRedo', () => {
    const stack = new DocumentHistoryStack('doc-1');
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);

    const tx = createDummyTx('tx-1', 0, 0, 'Hello World');
    stack.push(tx);

    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);
    expect(stack.getUndoCount()).toBe(1);

    const popped = stack.popUndo();
    expect(popped).toBeDefined();
    expect(stack.canUndo()).toBe(false);

    stack.pushRedo(popped!);
    expect(stack.canRedo()).toBe(true);

    const redoPopped = stack.popRedo();
    expect(redoPopped).toBeDefined();
    expect(stack.canRedo()).toBe(false);
  });

  it('clears redo stack when a new forward edit is pushed', () => {
    const stack = new DocumentHistoryStack('doc-1');
    const tx1 = createDummyTx('tx-1', 0, 0, 'First');
    stack.push(tx1);

    const popped = stack.popUndo();
    stack.pushRedo(popped!);
    expect(stack.canRedo()).toBe(true);

    // New edit while redo stack has items
    const tx2 = createDummyTx('tx-2', 0, 0, 'Second');
    stack.push(tx2);

    expect(stack.canRedo()).toBe(false);
    expect(stack.getRedoCount()).toBe(0);
    expect(stack.getUndoCount()).toBe(1);
  });

  it('bounds stack depth to maxDepth to prevent memory leaks', () => {
    const stack = new DocumentHistoryStack('doc-1', { maxDepth: 3 });

    for (let i = 1; i <= 5; i++) {
      stack.push(createDummyTx(`tx-${i}`, 0, 0, `Text ${i}`, '', i * 1000));
    }

    expect(stack.getUndoCount()).toBe(3);
    const top = stack.popUndo();
    expect((top as any).forwardTransaction.id).toBe('tx-5');
  });

  it('auto-groups rapid single-character typing edits within threshold', () => {
    const stack = new DocumentHistoryStack('doc-1', { autoGroupThresholdMs: 200 });
    const baseTime = 1000;

    // Type "a"
    stack.push(createDummyTx('tx-a', 0, 0, 'a', '', baseTime));
    expect(stack.getUndoCount()).toBe(1);

    // Type "b" 50ms later (within 200ms threshold)
    stack.push(createDummyTx('tx-b', 1, 1, 'b', '', baseTime + 50));
    expect(stack.getUndoCount()).toBe(1); // Grouped into 1 EditGroup!

    // Type "c" 50ms later
    stack.push(createDummyTx('tx-c', 2, 2, 'c', '', baseTime + 100));
    expect(stack.getUndoCount()).toBe(1);

    const top = stack.popUndo();
    expect(isEditGroup(top!)).toBe(true);
    if (isEditGroup(top!)) {
      expect(top.entries).toHaveLength(3);
    }
  });

  it('supports explicit beginGroup and endGroup blocks', () => {
    const stack = new DocumentHistoryStack('doc-1');
    const groupId = stack.beginGroup('Format Document');
    expect(stack.isGroupActive()).toBe(true);

    stack.push(createDummyTx('tx-1', 0, 0, 'Tab 1', '', 1000));
    stack.push(createDummyTx('tx-2', 10, 10, 'Tab 2', '', 1001));

    stack.endGroup();
    expect(stack.isGroupActive()).toBe(false);
    expect(stack.getUndoCount()).toBe(1);

    const item = stack.popUndo();
    expect(isEditGroup(item!)).toBe(true);
    if (isEditGroup(item!)) {
      expect(item.id).toBe(groupId);
      expect(item.label).toBe('Format Document');
      expect(item.entries).toHaveLength(2);
    }
  });

  it('throws InvalidGroupStateError on nested beginGroup calls', () => {
    const stack = new DocumentHistoryStack('doc-1');
    stack.beginGroup('First');
    expect(() => {
      stack.beginGroup('Second');
    }).toThrow(InvalidGroupStateError);
  });

  it('tracks and clears saved revision checkpoint', () => {
    const stack = new DocumentHistoryStack('doc-1');
    expect(stack.getSavedRevision()).toBeUndefined();

    stack.markSaved(5);
    expect(stack.getSavedRevision()).toBe(5);

    stack.clear();
    expect(stack.getUndoCount()).toBe(0);
    expect(stack.getRedoCount()).toBe(0);
  });
});
