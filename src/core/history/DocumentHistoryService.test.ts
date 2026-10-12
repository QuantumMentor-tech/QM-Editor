import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DocumentHistoryService } from './DocumentHistoryService';
import { globalEditTransactionManager } from '../edit';
import { createNewDocument } from '../document';
import { NothingToUndoError, NothingToRedoError } from './HistoryErrors';

describe('DocumentHistoryService Integration', () => {
  let service: DocumentHistoryService;

  beforeEach(() => {
    service = new DocumentHistoryService({ autoGroupThresholdMs: 0 });
  });

  afterEach(() => {
    service.dispose();
  });

  it('captures committed transactions and performs atomic undo and redo', async () => {
    let doc = createNewDocument('test.txt', 'Hello World');
    expect(doc.contentRevision).toBe(0);
    expect(doc.isDirty).toBe(false);

    // 1. User inserts " Beautiful" at offset 5
    const res1 = await globalEditTransactionManager.applyTransaction(doc, {
      documentId: doc.id,
      baseRevision: 0,
      changes: [{ from: 5, to: 5, insertText: ' Beautiful', deletedText: '' }],
      origin: 'user',
    });
    doc = res1.document;
    expect(doc.content).toBe('Hello Beautiful World');
    expect(doc.contentRevision).toBe(1);
    expect(doc.isDirty).toBe(true);
    expect(service.canUndo(doc.id)).toBe(true);
    expect(service.canRedo(doc.id)).toBe(false);

    // 2. Perform Undo
    const undoRes = await service.undo(doc);
    doc = undoRes.document;
    expect(doc.content).toBe('Hello World');
    expect(doc.contentRevision).toBe(0);
    expect(doc.isDirty).toBe(false);
    expect(service.canUndo(doc.id)).toBe(false);
    expect(service.canRedo(doc.id)).toBe(true);

    // 3. Perform Redo
    const redoRes = await service.redo(doc);
    doc = redoRes.document;
    expect(doc.content).toBe('Hello Beautiful World');
    expect(doc.contentRevision).toBe(1);
    expect(doc.isDirty).toBe(true);
    expect(service.canUndo(doc.id)).toBe(true);
    expect(service.canRedo(doc.id)).toBe(false);
  });

  it('throws NothingToUndoError and NothingToRedoError when stacks are empty', async () => {
    const doc = createNewDocument('empty.txt', 'Content');
    await expect(service.undo(doc)).rejects.toThrow(NothingToUndoError);
    await expect(service.redo(doc)).rejects.toThrow(NothingToRedoError);
  });

  it('preserves save/undo symmetry: undoing back to savedRevision clears isDirty', async () => {
    let doc = createNewDocument('save-test.txt', 'Initial');
    // Save at revision 0
    service.markSaved(doc.id, 0);

    // Edit 1: "Initial A"
    const r1 = await globalEditTransactionManager.applyTransaction(doc, {
      documentId: doc.id,
      baseRevision: 0,
      changes: [{ from: 7, to: 7, insertText: ' A', deletedText: '' }],
      origin: 'user',
    });
    doc = r1.document;
    expect(doc.contentRevision).toBe(1);
    expect(doc.isDirty).toBe(true);

    // Save at revision 1!
    doc.savedRevision = 1;
    doc.isDirty = false;
    service.markSaved(doc.id, 1);

    // Edit 2: "Initial A B"
    const r2 = await globalEditTransactionManager.applyTransaction(doc, {
      documentId: doc.id,
      baseRevision: 1,
      changes: [{ from: 9, to: 9, insertText: ' B', deletedText: '' }],
      origin: 'user',
    });
    doc = r2.document;
    expect(doc.contentRevision).toBe(2);
    expect(doc.isDirty).toBe(true);

    // Edit 3: "Initial A B C"
    const r3 = await globalEditTransactionManager.applyTransaction(doc, {
      documentId: doc.id,
      baseRevision: 2,
      changes: [{ from: 11, to: 11, insertText: ' C', deletedText: '' }],
      origin: 'user',
    });
    doc = r3.document;
    expect(doc.contentRevision).toBe(3);
    expect(doc.isDirty).toBe(true);

    // Undo Edit 3 -> revision 2 (still dirty)
    const u1 = await service.undo(doc);
    doc = u1.document;
    expect(doc.content).toBe('Initial A B');
    expect(doc.contentRevision).toBe(2);
    expect(doc.isDirty).toBe(true);

    // Undo Edit 2 -> revision 1 (matches savedRevision!)
    const u2 = await service.undo(doc);
    doc = u2.document;
    expect(doc.content).toBe('Initial A');
    expect(doc.contentRevision).toBe(1);
    expect(doc.isDirty).toBe(false); // Symmetrical clean state restored!

    // Redo Edit 2 -> revision 2 (dirty again)
    const redo1 = await service.redo(doc);
    doc = redo1.document;
    expect(doc.content).toBe('Initial A B');
    expect(doc.contentRevision).toBe(2);
    expect(doc.isDirty).toBe(true);
  });

  it('supports explicit edit grouping via withGroup', async () => {
    let doc = createNewDocument('group-test.txt', '1 2 3');

    // Run multiple distinct transactions inside a named group
    await service.withGroup(doc.id, 'Batch Replace', async () => {
      const r1 = await globalEditTransactionManager.applyTransaction(doc, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [{ from: 0, to: 1, insertText: 'ONE', deletedText: '1' }],
        origin: 'replace',
      });
      doc = r1.document;

      const r2 = await globalEditTransactionManager.applyTransaction(doc, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [{ from: 4, to: 5, insertText: 'TWO', deletedText: '2' }],
        origin: 'replace',
      });
      doc = r2.document;
    });

    expect(doc.content).toBe('ONE TWO 3');
    expect(service.getSnapshot(doc.id).undoCount).toBe(1); // Grouped into 1 item!

    // Single undo rolls back BOTH edits in the group
    const undoRes = await service.undo(doc);
    doc = undoRes.document;
    expect(doc.content).toBe('1 2 3');
    expect(doc.contentRevision).toBe(0);

    // Single redo reapplies BOTH edits
    const redoRes = await service.redo(doc);
    doc = redoRes.document;
    expect(doc.content).toBe('ONE TWO 3');
    expect(doc.contentRevision).toBe(2);
  });

  it('restores multi-cursor selections accurately across undo and redo', async () => {
    let doc = createNewDocument('cursor.txt', 'cat\ncat\ncat');

    const multiSelections = [
      { anchor: 3, head: 3 },
      { anchor: 7, head: 7 },
      { anchor: 11, head: 11 },
    ];

    const res = await globalEditTransactionManager.applyTransaction(doc, {
      documentId: doc.id,
      baseRevision: 0,
      changes: [
        { from: 3, to: 3, insertText: 's', deletedText: '' },
        { from: 7, to: 7, insertText: 's', deletedText: '' },
        { from: 11, to: 11, insertText: 's', deletedText: '' },
      ],
      selectionsBefore: multiSelections,
      origin: 'user',
    });
    doc = res.document;
    expect(doc.content).toBe('cats\ncats\ncats');

    // Undo restores original selectionsBefore
    const undoRes = await service.undo(doc);
    doc = undoRes.document;
    expect(undoRes.transaction.selectionsAfter).toEqual(multiSelections);

    // Redo restores selectionsAfter
    const redoRes = await service.redo(doc);
    expect(redoRes.transaction.selectionsAfter).toEqual([
      { anchor: 4, head: 4 },
      { anchor: 9, head: 9 },
      { anchor: 14, head: 14 },
    ]);
  });

  it('emits lifecycle events for history additions, undo, and redo', async () => {
    const entryAddedListener = vi.fn();
    const undoneListener = vi.fn();
    const redoneListener = vi.fn();

    service.on('history.entryAdded', entryAddedListener);
    service.on('history.undone', undoneListener);
    service.on('history.redone', redoneListener);

    let doc = createNewDocument('events.txt', 'Start');

    const r = await globalEditTransactionManager.applyTransaction(doc, {
      documentId: doc.id,
      baseRevision: 0,
      changes: [{ from: 5, to: 5, insertText: ' End', deletedText: '' }],
      origin: 'user',
    });
    doc = r.document;

    await Promise.resolve();
    expect(entryAddedListener).toHaveBeenCalledTimes(1);
    expect(entryAddedListener).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: doc.id,
        canUndo: true,
        canRedo: false,
      })
    );

    const u = await service.undo(doc);
    doc = u.document;
    await Promise.resolve();
    expect(undoneListener).toHaveBeenCalledTimes(1);

    await service.redo(doc);
    await Promise.resolve();
    expect(redoneListener).toHaveBeenCalledTimes(1);
  });
});
