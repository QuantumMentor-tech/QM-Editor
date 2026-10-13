import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorCoordinationService } from './EditorCoordinationService';
import { EditorViewStateManager } from './EditorViewStateManager';
import {
  DocumentNotAvailableError,
  ReadOnlyEditError,
  ConflictEditError,
  StaleTransactionError,
  InvalidEditRangeError,
} from './EditorErrors';
import { globalDocumentEngine } from '../documents/DocumentEngine';
import { DocumentRecord } from '../documents/DocumentTypes';
import { EditorAdapterInterface } from '../../components/editor/EditorAdapter';

describe('EditorCoordinationService & Text Model Subsystem', () => {
  let service: EditorCoordinationService;
  let mockDoc: DocumentRecord;

  beforeEach(async () => {
    service = new EditorCoordinationService();

    // Reset document engine state
    const openDocs = globalDocumentEngine.getAllDocuments();
    for (const d of openDocs) {
      await globalDocumentEngine.close(d.id, true);
    }

    // Create a canonical test document in DocumentEngine
    mockDoc = await globalDocumentEngine.createUntitled({
      title: 'test.ts',
      content: 'hello world\nsecond line\nthird line',
      languageId: 'typescript',
    });
  });

  // ---------------------------------------------------------------------------
  // 1. TextModel Tests
  // ---------------------------------------------------------------------------
  describe('Canonical TextModel', () => {
    it('returns a TextModel mapped directly to DocumentRecord without cloning buffer', () => {
      const model = service.getTextModel(mockDoc.id);
      expect(model.documentId).toBe(mockDoc.id);
      expect(model.getText()).toBe('hello world\nsecond line\nthird line');
      expect(model.revision).toBe(mockDoc.contentRevision);
      expect(model.isReadOnly).toBe(false);
    });

    it('computes line counts, line contents, and line lengths accurately', () => {
      const model = service.getTextModel(mockDoc.id);
      expect(model.getLineCount()).toBe(3);
      expect(model.getLineContent(1)).toBe('hello world');
      expect(model.getLineContent(2)).toBe('second line');
      expect(model.getLineContent(3)).toBe('third line');
      expect(model.getLineLength(1)).toBe(11);
      expect(model.getLineLength(2)).toBe(11);
      expect(model.getLineLength(3)).toBe(10);
      expect(model.getLineContent(99)).toBe('');
    });

    it('translates coordinates between (line, column) and character offset safely', () => {
      const model = service.getTextModel(mockDoc.id);
      // Line 1, Col 1 => offset 0
      expect(model.positionToOffset({ line: 1, column: 1 })).toBe(0);
      // Line 1, Col 6 => offset 5 ('w')
      expect(model.positionToOffset({ line: 1, column: 6 })).toBe(5);
      // Line 2, Col 1 => offset 12 (after 'hello world\n')
      expect(model.positionToOffset({ line: 2, column: 1 })).toBe(12);

      // Offset 0 => Line 1, Col 1
      expect(model.offsetToPosition(0)).toEqual({ line: 1, column: 1 });
      // Offset 12 => Line 2, Col 1
      expect(model.offsetToPosition(12)).toEqual({ line: 2, column: 1 });
      // Offset 15 => Line 2, Col 4
      expect(model.offsetToPosition(15)).toEqual({ line: 2, column: 4 });
    });

    it('validates offset ranges against document bounds and throws InvalidEditRangeError on violation', () => {
      const model = service.getTextModel(mockDoc.id);
      expect(model.validateOffsetRange({ from: 0, to: 5 })).toEqual({ from: 0, to: 5 });

      expect(() => {
        model.validateOffsetRange({ from: -1, to: 5 });
      }).toThrow(InvalidEditRangeError);

      expect(() => {
        model.validateOffsetRange({ from: 5, to: 999 });
      }).toThrow(InvalidEditRangeError);

      expect(() => {
        model.validateOffsetRange({ from: 10, to: 5 });
      }).toThrow(InvalidEditRangeError);
    });

    it('throws DocumentNotAvailableError if document is not registered in DocumentEngine', () => {
      expect(() => {
        service.getTextModel('non-existent-doc');
      }).toThrow(DocumentNotAvailableError);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Editor Instance Registry & Lifecycle
  // ---------------------------------------------------------------------------
  describe('Editor Instance Registry', () => {
    it('registers, retrieves, and unregisters editor instances cleanly', () => {
      const mockAdapter: EditorAdapterInterface = {
        mount: vi.fn(),
        setContent: vi.fn(),
        getContent: vi.fn(() => 'content'),
        setReadOnly: vi.fn(),
        setTheme: vi.fn(),
        setLanguage: vi.fn(),
        setSettings: vi.fn(),
        foldAll: vi.fn(),
        unfoldAll: vi.fn(),
        getCursorPosition: vi.fn(() => ({ line: 1, column: 1 })),
        goToLine: vi.fn(),
        selectAndRevealRange: vi.fn(),
        highlightMatches: vi.fn(),
        clearSearchHighlights: vi.fn(),
        setDiagnostics: vi.fn(),
        clearDiagnostics: vi.fn(),
        getSelectedText: vi.fn(() => ''),
        focus: vi.fn(),
        dispose: vi.fn(),
      };

      service.registerEditorInstance('inst-1', mockDoc.id, mockAdapter);
      expect(service.getEditorInstance('inst-1')?.documentId).toBe(mockDoc.id);
      expect(service.getEditorInstanceForDocument(mockDoc.id)?.id).toBe('inst-1');
      expect(service.getAllInstances().length).toBe(1);

      service.unregisterEditorInstance('inst-1');
      expect(service.getEditorInstance('inst-1')).toBeUndefined();
      expect(service.getEditorInstanceForDocument(mockDoc.id)).toBeUndefined();
      expect(service.getAllInstances().length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. View State Manager & Clamping
  // ---------------------------------------------------------------------------
  describe('Editor View State Manager', () => {
    it('saves and clamps view state against document line structure and bounds', () => {
      const vsm = new EditorViewStateManager();
      vsm.saveViewState(mockDoc.id, {
        cursorPosition: { line: 10, column: 50 }, // Out of bounds
        selections: [{ anchor: 10, head: 500 }], // Head exceeds length
      });

      const clamped = vsm.getClampedViewState(mockDoc.id, mockDoc.content);
      expect(clamped).toBeDefined();
      expect(clamped!.cursorPosition.line).toBe(3); // clamped to 3 lines
      expect(clamped!.cursorPosition.column).toBe(11); // line 3 length + 1
      expect(clamped!.selections[0].head).toBe(mockDoc.content.length);
    });

    it('clears view state when requested', () => {
      const vsm = new EditorViewStateManager();
      vsm.saveViewState('doc-x', { cursorPosition: { line: 1, column: 1 } });
      expect(vsm.getViewState('doc-x')).toBeDefined();

      vsm.clearViewState('doc-x');
      expect(vsm.getViewState('doc-x')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Programmatic Edit Transactions
  // ---------------------------------------------------------------------------
  describe('Programmatic Edit Transactions', () => {
    it('applies a single edit to a headless document and updates DocumentEngine revision', async () => {
      const initialRev = mockDoc.contentRevision;

      const result = await service.applyTransaction({
        documentId: mockDoc.id,
        expectedRevision: initialRev,
        source: 'programmatic',
        changes: [{ from: 0, to: 5, insertText: 'goodbye' }],
      });

      expect(result.status).toBe('applied');
      expect(result.appliedOperationsCount).toBe(1);
      expect(result.newRevision).toBe(initialRev + 1);

      const updated = globalDocumentEngine.getDocument(mockDoc.id);
      expect(updated?.content.startsWith('goodbye world')).toBe(true);
      expect(updated?.isDirty).toBe(true);
    });

    it('applies atomic multi-edits to a headless document in reverse offset order', async () => {
      // Content: "hello world\nsecond line\nthird line"
      // Change 1: "hello" -> "hi" [0..5]
      // Change 2: "world" -> "earth" [6..11]
      const result = await service.applyTransaction({
        documentId: mockDoc.id,
        changes: [
          { from: 0, to: 5, insertText: 'hi' },
          { from: 6, to: 11, insertText: 'earth' },
        ],
      });

      expect(result.status).toBe('applied');
      expect(result.appliedOperationsCount).toBe(2);

      const updated = globalDocumentEngine.getDocument(mockDoc.id);
      expect(updated?.content.startsWith('hi earth\n')).toBe(true);
    });

    it('dispatches edits to mounted editor adapter applyEdits when instance exists', async () => {
      const applyEditsMock = vi.fn();
      let currentAdapterContent = mockDoc.content;

      const mockAdapter: EditorAdapterInterface = {
        mount: vi.fn(),
        setContent: vi.fn(),
        getContent: vi.fn(() => currentAdapterContent),
        setReadOnly: vi.fn(),
        setTheme: vi.fn(),
        setLanguage: vi.fn(),
        setSettings: vi.fn(),
        foldAll: vi.fn(),
        unfoldAll: vi.fn(),
        getCursorPosition: vi.fn(() => ({ line: 1, column: 1 })),
        goToLine: vi.fn(),
        selectAndRevealRange: vi.fn(),
        highlightMatches: vi.fn(),
        clearSearchHighlights: vi.fn(),
        setDiagnostics: vi.fn(),
        clearDiagnostics: vi.fn(),
        getSelectedText: vi.fn(() => ''),
        applyEdits: applyEditsMock.mockImplementation((_changes) => {
          // Simulate CodeMirror update
          currentAdapterContent = 'updated content';
        }),
        focus: vi.fn(),
        dispose: vi.fn(),
      };

      service.registerEditorInstance('inst-editor', mockDoc.id, mockAdapter);

      const res = await service.applyTransaction({
        documentId: mockDoc.id,
        changes: [{ from: 0, to: 5, insertText: 'updated' }],
      });

      expect(res.status).toBe('applied');
      expect(applyEditsMock).toHaveBeenCalledTimes(1);

      const updated = globalDocumentEngine.getDocument(mockDoc.id);
      expect(updated?.content).toBe('updated content');
    });

    it('rejects stale transactions when expectedRevision mismatches current revision', async () => {
      const res = await service.applyTransaction({
        documentId: mockDoc.id,
        expectedRevision: 999, // Stale!
        changes: [{ from: 0, to: 5, insertText: 'test' }],
      });

      expect(res.status).toBe('stale');
      expect(res.appliedOperationsCount).toBe(0);

      await expect(
        service.applyTransactionStrict({
          documentId: mockDoc.id,
          expectedRevision: 999,
          changes: [{ from: 0, to: 5, insertText: 'test' }],
        })
      ).rejects.toThrow(StaleTransactionError);
    });

    it('rejects transactions on read-only documents', async () => {
      mockDoc.metadata = {
        ...mockDoc.metadata,
        isReadOnly: true,
      };

      const res = await service.applyTransaction({
        documentId: mockDoc.id,
        changes: [{ from: 0, to: 5, insertText: 'test' }],
      });

      expect(res.status).toBe('read_only');

      await expect(
        service.applyTransactionStrict({
          documentId: mockDoc.id,
          changes: [{ from: 0, to: 5, insertText: 'test' }],
        })
      ).rejects.toThrow(ReadOnlyEditError);
    });

    it('rejects transactions on documents with unresolved disk conflicts', async () => {
      mockDoc.metadata = {
        ...mockDoc.metadata,
        hasConflict: true,
      };

      const res = await service.applyTransaction({
        documentId: mockDoc.id,
        changes: [{ from: 0, to: 5, insertText: 'test' }],
      });

      expect(res.status).toBe('conflict');

      await expect(
        service.applyTransactionStrict({
          documentId: mockDoc.id,
          changes: [{ from: 0, to: 5, insertText: 'test' }],
        })
      ).rejects.toThrow(ConflictEditError);
    });

    it('rejects transactions with invalid out-of-bounds ranges', async () => {
      const res = await service.applyTransaction({
        documentId: mockDoc.id,
        changes: [{ from: 0, to: 9999, insertText: 'test' }],
      });

      expect(res.status).toBe('invalid_range');

      await expect(
        service.applyTransactionStrict({
          documentId: mockDoc.id,
          changes: [{ from: 0, to: 9999, insertText: 'test' }],
        })
      ).rejects.toThrow(InvalidEditRangeError);
    });

    it('rejects transactions with overlapping ranges', async () => {
      const res = await service.applyTransaction({
        documentId: mockDoc.id,
        changes: [
          { from: 0, to: 5, insertText: 'a' },
          { from: 3, to: 8, insertText: 'b' }, // overlaps [0..5]
        ],
      });

      expect(res.status).toBe('invalid_range');
      expect(res.error).toContain('Overlapping edit ranges');
    });

    it('emits lifecycle events when transactions are applied or rejected', async () => {
      const onApplied = vi.fn();
      const onRejected = vi.fn();

      service.subscribe('editor.transactionApplied', onApplied);
      service.subscribe('editor.transactionRejected', onRejected);

      await service.applyTransaction({
        documentId: mockDoc.id,
        changes: [{ from: 0, to: 5, insertText: 'applied' }],
      });

      expect(onApplied).toHaveBeenCalledTimes(1);
      expect(onRejected).not.toHaveBeenCalled();

      await service.applyTransaction({
        documentId: mockDoc.id,
        expectedRevision: 999,
        changes: [{ from: 0, to: 5, insertText: 'rejected' }],
      });

      expect(onRejected).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Editor Command Delegation
  // ---------------------------------------------------------------------------
  describe('Editor Command Delegation', () => {
    it('delegates editor commands to mounted adapter instance methods', () => {
      const undoMock = vi.fn(() => true);
      const redoMock = vi.fn(() => true);
      const selectAllMock = vi.fn(() => true);
      const foldAllMock = vi.fn();
      const focusMock = vi.fn();

      const mockAdapter: EditorAdapterInterface = {
        mount: vi.fn(),
        setContent: vi.fn(),
        getContent: vi.fn(() => ''),
        setReadOnly: vi.fn(),
        setTheme: vi.fn(),
        setLanguage: vi.fn(),
        setSettings: vi.fn(),
        foldAll: foldAllMock,
        unfoldAll: vi.fn(),
        getCursorPosition: vi.fn(() => ({ line: 1, column: 1 })),
        goToLine: vi.fn(),
        selectAndRevealRange: vi.fn(),
        highlightMatches: vi.fn(),
        clearSearchHighlights: vi.fn(),
        setDiagnostics: vi.fn(),
        clearDiagnostics: vi.fn(),
        getSelectedText: vi.fn(() => ''),
        undo: undoMock,
        redo: redoMock,
        selectAll: selectAllMock,
        focus: focusMock,
        dispose: vi.fn(),
      };

      service.registerEditorInstance('inst-cmd', mockDoc.id, mockAdapter);

      expect(service.executeEditorCommand(mockDoc.id, 'undo')).toBe(true);
      expect(undoMock).toHaveBeenCalledTimes(1);

      expect(service.executeEditorCommand(mockDoc.id, 'redo')).toBe(true);
      expect(redoMock).toHaveBeenCalledTimes(1);

      expect(service.executeEditorCommand(mockDoc.id, 'selectAll')).toBe(true);
      expect(selectAllMock).toHaveBeenCalledTimes(1);

      expect(service.executeEditorCommand(mockDoc.id, 'foldAll')).toBe(true);
      expect(foldAllMock).toHaveBeenCalledTimes(1);

      expect(service.executeEditorCommand(mockDoc.id, 'focus')).toBe(true);
      expect(focusMock).toHaveBeenCalledTimes(1);

      // Fails gracefully if no editor instance mounted for document
      expect(service.executeEditorCommand('unmounted-doc', 'undo')).toBe(false);
    });
  });
});
