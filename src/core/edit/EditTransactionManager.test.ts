import { describe, it, expect, beforeEach } from 'vitest';
import { EditTransactionManager } from './EditTransactionManager';
import { createNewDocument, markDocumentSaved } from '../document';
import {
  InvalidEditRangeError,
  OverlappingEditError,
  StaleRevisionError,
  ReadOnlyDocumentError,
} from './EditErrors';
import { EditTransaction } from './EditTypes';

describe('EditTransactionManager Unit Tests', () => {
  let manager: EditTransactionManager;

  beforeEach(() => {
    manager = new EditTransactionManager();
  });

  describe('Single Edit Operations', () => {
    it('applies text insertion at offset', async () => {
      const doc = createNewDocument('test.txt', 'Hello World');
      const tx: EditTransaction = {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [{ from: 5, to: 5, insertText: ' Beautiful' }],
      };

      const result = await manager.applyTransaction(doc, tx);
      expect(result.document.content).toBe('Hello Beautiful World');
      expect(result.document.contentRevision).toBe(1);
      expect(result.document.isDirty).toBe(true);
      expect(result.transaction.changes[0].deletedText).toBe('');
    });

    it('applies text deletion across range', async () => {
      const doc = createNewDocument('test.txt', 'Hello Beautiful World');
      const tx: EditTransaction = {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [{ from: 5, to: 15, insertText: '' }],
      };

      const result = await manager.applyTransaction(doc, tx);
      expect(result.document.content).toBe('Hello World');
      expect(result.transaction.changes[0].deletedText).toBe(' Beautiful');
    });

    it('applies in-place replacement', async () => {
      const doc = createNewDocument('test.txt', 'Hello World');
      const tx: EditTransaction = {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [{ from: 6, to: 11, insertText: 'QM Editor' }],
        origin: 'replace',
      };

      const result = await manager.applyTransaction(doc, tx);
      expect(result.document.content).toBe('Hello QM Editor');
      expect(result.transaction.origin).toBe('replace');
    });

    it('handles boundary edits at offset 0 and document length', async () => {
      const doc = createNewDocument('test.txt', 'Center');

      // Edit at start (0)
      const r1 = await manager.applyTransaction(doc, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [{ from: 0, to: 0, insertText: 'Start ' }],
      });
      expect(r1.document.content).toBe('Start Center');

      // Edit at end
      const r2 = await manager.applyTransaction(r1.document, {
        documentId: doc.id,
        baseRevision: r1.document.contentRevision,
        changes: [{ from: r1.document.content.length, to: r1.document.content.length, insertText: ' End' }],
      });
      expect(r2.document.content).toBe('Start Center End');
    });
  });

  describe('Multi-Cursor & Multi-Edit Ordering', () => {
    it('applies multiple non-overlapping edits atomically in reverse offset order', async () => {
      const doc = createNewDocument('code.ts', 'const a = 1;\nconst b = 2;');
      // Multi-cursor renaming: rename 'a' to 'alpha' and 'b' to 'beta'
      const tx: EditTransaction = {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [
          { from: 6, to: 7, insertText: 'alpha' },   // replaces 'a'
          { from: 19, to: 20, insertText: 'beta' },  // replaces 'b'
        ],
      };

      const result = await manager.applyTransaction(doc, tx);
      expect(result.document.content).toBe('const alpha = 1;\nconst beta = 2;');
      expect(result.document.contentRevision).toBe(1);
    });

    it('maps cursor selection forward accurately through multi-cursor edits', () => {
      const changes = [
        { from: 5, to: 5, insertText: ' Big' },     // +4 chars at index 5
        { from: 15, to: 20, insertText: 'Small' },  // replaces 5 chars with 5 chars (0 delta)
      ];

      // Cursor before first edit
      expect(manager.mapOffsetThroughChanges(2, changes)).toBe(2);

      // Cursor inside first edit (at 5)
      expect(manager.mapOffsetThroughChanges(5, changes)).toBe(9);

      // Cursor between first and second edit (at 10) -> shifted by +4
      expect(manager.mapOffsetThroughChanges(10, changes)).toBe(14);

      // Cursor after second edit (at 25) -> shifted by +4
      expect(manager.mapOffsetThroughChanges(25, changes)).toBe(29);
    });
  });

  describe('Validation & Overlap Prevention', () => {
    it('throws InvalidEditRangeError when range is out of bounds', async () => {
      const doc = createNewDocument('test.txt', 'Short');

      await expect(
        manager.applyTransaction(doc, {
          documentId: doc.id,
          baseRevision: doc.contentRevision,
          changes: [{ from: -1, to: 2, insertText: 'X' }],
        })
      ).rejects.toThrow(InvalidEditRangeError);

      await expect(
        manager.applyTransaction(doc, {
          documentId: doc.id,
          baseRevision: doc.contentRevision,
          changes: [{ from: 2, to: 10, insertText: 'X' }],
        })
      ).rejects.toThrow(InvalidEditRangeError);

      await expect(
        manager.applyTransaction(doc, {
          documentId: doc.id,
          baseRevision: doc.contentRevision,
          changes: [{ from: 4, to: 2, insertText: 'X' }],
        })
      ).rejects.toThrow(InvalidEditRangeError);
    });

    it('throws OverlappingEditError when edits in same transaction overlap', async () => {
      const doc = createNewDocument('test.txt', 'ABCDEFGHIJ');

      // Edit 1: [2, 6], Edit 2: [4, 8] -> Overlaps!
      await expect(
        manager.applyTransaction(doc, {
          documentId: doc.id,
          baseRevision: doc.contentRevision,
          changes: [
            { from: 2, to: 6, insertText: '123' },
            { from: 4, to: 8, insertText: '456' },
          ],
        })
      ).rejects.toThrow(OverlappingEditError);
    });
  });

  describe('Revision Invariants & Concurrency', () => {
    it('enforces monotonic revision counter on each change', async () => {
      let doc = createNewDocument('test.txt', 'V0');
      expect(doc.contentRevision).toBe(0);

      const r1 = await manager.applyTransaction(doc, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [{ from: 1, to: 2, insertText: '1' }],
      });
      expect(r1.document.contentRevision).toBe(1);

      const r2 = await manager.applyTransaction(r1.document, {
        documentId: doc.id,
        baseRevision: r1.document.contentRevision,
        changes: [{ from: 1, to: 2, insertText: '2' }],
      });
      expect(r2.document.contentRevision).toBe(2);
    });

    it('rejects stale transaction when strictRevision is enabled', async () => {
      const doc = createNewDocument('test.txt', 'Base');
      const r1 = await manager.applyTransaction(doc, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [{ from: 4, to: 4, insertText: ' 1' }],
      });

      // Attempt to apply edit with old baseRevision = 0 against doc at revision 1
      await expect(
        manager.applyTransaction(
          r1.document,
          {
            documentId: doc.id,
            baseRevision: 0,
            changes: [{ from: 0, to: 4, insertText: 'New' }],
          },
          { strictRevision: true }
        )
      ).rejects.toThrow(StaleRevisionError);
    });

    it('does not increment revision when edit results in identical content', async () => {
      const doc = createNewDocument('test.txt', 'Same');
      const result = await manager.applyTransaction(doc, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [{ from: 0, to: 4, insertText: 'Same' }],
      });

      expect(result.document.contentRevision).toBe(0);
      expect(result.document.isDirty).toBe(false);
    });
  });

  describe('Undo & Save State Protection', () => {
    it('clears isDirty when revision matches savedRevision', async () => {
      const doc = createNewDocument('test.txt', 'Saved Text');
      const v1 = await manager.applyTransaction(doc, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [{ from: 10, to: 10, insertText: ' Edit' }],
      });
      expect(v1.document.isDirty).toBe(true);

      // Save document
      const savedDoc = markDocumentSaved(v1.document);
      expect(savedDoc.isDirty).toBe(false);
      expect(savedDoc.savedRevision).toBe(1);

      // Next edit
      const v2 = await manager.applyTransaction(savedDoc, {
        documentId: doc.id,
        baseRevision: savedDoc.contentRevision,
        changes: [{ from: 15, to: 15, insertText: ' Again' }],
      });
      expect(v2.document.isDirty).toBe(true);
      expect(v2.document.contentRevision).toBe(2);
    });

    it('protects against in-flight save races', async () => {
      const doc = createNewDocument('test.txt', 'Initial');
      const v1 = await manager.applyTransaction(doc, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [{ from: 7, to: 7, insertText: ' 1' }],
      });
      const inFlightSavedTarget = v1.document.contentRevision; // rev 1

      // User types edit 2 while save 1 is in flight
      const v2 = await manager.applyTransaction(v1.document, {
        documentId: doc.id,
        baseRevision: v1.document.contentRevision,
        changes: [{ from: 9, to: 9, insertText: ' 2' }],
      });
      expect(v2.document.contentRevision).toBe(2);

      // Save 1 finishes
      const afterSave = markDocumentSaved(v2.document, inFlightSavedTarget);
      expect(afterSave.savedRevision).toBe(1);
      expect(afterSave.contentRevision).toBe(2);
      expect(afterSave.isDirty).toBe(true); // Must remain dirty because edit 2 was not persisted!
    });
  });

  describe('IME & Composition Session Handling', () => {
    it('tracks active IME composition state and emits events', () => {
      let compositionStarted = false;
      let compositionEnded = false;

      manager.on('document.compositionStarted', (payload) => {
        if (payload.documentId === 'doc-ime') compositionStarted = true;
      });

      manager.on('document.compositionEnded', (payload) => {
        if (payload.documentId === 'doc-ime') compositionEnded = true;
      });

      expect(manager.isComposing('doc-ime')).toBe(false);

      manager.startComposition('doc-ime');
      expect(manager.isComposing('doc-ime')).toBe(true);
      expect(compositionStarted).toBe(true);

      manager.endComposition('doc-ime', 3);
      expect(manager.isComposing('doc-ime')).toBe(false);
      expect(compositionEnded).toBe(true);
    });

    it('records isComposition flag in committed transaction', async () => {
      const doc = createNewDocument('ime.txt', 'Ni');
      const result = await manager.applyTransaction(doc, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [{ from: 2, to: 2, insertText: 'hao' }],
        isComposition: true,
        origin: 'ime',
      });

      expect(result.transaction.isComposition).toBe(true);
      expect(result.transaction.origin).toBe('ime');
    });
  });

  describe('Change Events & Observability', () => {
    it('emits willApply, transactionApplied, and dirtyStateChanged in deterministic order', async () => {
      const doc = createNewDocument('events.txt', 'Hello');
      const eventLog: string[] = [];

      manager.on('document.transactionWillApply', () => {
        eventLog.push('willApply');
      });

      manager.on('document.transactionApplied', () => {
        eventLog.push('applied');
      });

      manager.on('document.dirtyStateChanged', () => {
        eventLog.push('dirtyStateChanged');
      });

      await manager.applyTransaction(doc, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [{ from: 5, to: 5, insertText: '!' }],
      });

      expect(eventLog).toEqual(['willApply', 'applied', 'dirtyStateChanged']);
    });

    it('isolates subscriber errors so one failure does not break transaction', async () => {
      const doc = createNewDocument('events.txt', 'Hello');

      manager.on('document.transactionApplied', () => {
        throw new Error('Subscriber exploded!');
      });

      const result = await manager.applyTransaction(doc, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [{ from: 5, to: 5, insertText: ' World' }],
      });

      expect(result.document.content).toBe('Hello World');
    });
  });

  describe('Read-Only Document Protection', () => {
    it('rejects transactions targeting read-only documents', async () => {
      const doc = createNewDocument('readonly.txt', 'Locked', 'plaintext', undefined, {
        uri: 'file:///readonly.txt',
        name: 'readonly.txt',
        extension: 'txt',
        readOnly: true,
        exists: true,
      });

      await expect(
        manager.applyTransaction(doc, {
          documentId: doc.id,
          baseRevision: doc.contentRevision,
          changes: [{ from: 0, to: 6, insertText: 'Hacked' }],
        })
      ).rejects.toThrow(ReadOnlyDocumentError);
    });
  });
});
