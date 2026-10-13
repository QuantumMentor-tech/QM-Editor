import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { globalEditorCoordinationService } from './EditorCoordinationService';
import { globalDocumentEngine } from '../documents/DocumentEngine';
import { DocumentRecord } from '../documents/DocumentTypes';
import { CodeMirrorEditorAdapter } from '../../components/editor/EditorAdapter';
import { ResourceSynchronizationService } from '../watcher/ResourceSynchronizationService';
import { defaultCommands } from '../commands/defaultCommands';
import { CommandContext } from '../commands/CommandTypes';
import { fileService } from '../../services/FileService';

describe('Undo/Redo Coordination & Edit History Integrity (Step 39)', () => {
  let containerA: HTMLDivElement;
  let containerB: HTMLDivElement;
  let adapterA: CodeMirrorEditorAdapter;
  let adapterB: CodeMirrorEditorAdapter;
  let docA: DocumentRecord;
  let docB: DocumentRecord;

  beforeEach(async () => {
    // Clean DocumentEngine
    for (const d of globalDocumentEngine.getAllDocuments()) {
      await globalDocumentEngine.close(d.id, true);
    }

    // Unregister any active instances on globalEditorCoordinationService
    for (const inst of globalEditorCoordinationService.getAllInstances()) {
      globalEditorCoordinationService.unregisterEditorInstance(inst.id);
    }

    // Set up containers in DOM
    containerA = document.createElement('div');
    containerB = document.createElement('div');
    document.body.appendChild(containerA);
    document.body.appendChild(containerB);

    adapterA = new CodeMirrorEditorAdapter();
    adapterB = new CodeMirrorEditorAdapter();

    // Create file-backed Document A
    const resA = await globalDocumentEngine.openResource('file:///test/DocA.txt', {
      initialContent: 'Line 1: Alpha\nLine 2: Beta\nLine 3: Gamma',
    });
    docA = resA.document;

    // Create file-backed Document B
    const resB = await globalDocumentEngine.openResource('file:///test/DocB.txt', {
      initialContent: 'Document B initial content',
    });
    docB = resB.document;

    // Mount adapter A
    adapterA.mount(containerA, docA.content, {
      onChange: (newContent) => {
        globalDocumentEngine.updateText(docA.id, newContent, 'user');
      },
    });
    globalEditorCoordinationService.registerEditorInstance(`editor-${docA.id}`, docA.id, adapterA);

    // Mount adapter B
    adapterB.mount(containerB, docB.content, {
      onChange: (newContent) => {
        globalDocumentEngine.updateText(docB.id, newContent, 'user');
      },
    });
    globalEditorCoordinationService.registerEditorInstance(`editor-${docB.id}`, docB.id, adapterB);
  });

  afterEach(() => {
    globalEditorCoordinationService.unregisterEditorInstance(`editor-${docA.id}`);
    globalEditorCoordinationService.unregisterEditorInstance(`editor-${docB.id}`);
    adapterA.dispose();
    adapterB.dispose();
    containerA.remove();
    containerB.remove();
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Test A: Edit -> Undo -> Restores Content & Resets Dirty to False
  // ---------------------------------------------------------------------------
  it('restores content and resets isDirty to false when undo returns to saved baseline', async () => {
    expect(docA.isDirty).toBe(false);
    expect(globalEditorCoordinationService.canUndo(docA.id)).toBe(false);

    // Apply an edit through the transaction system
    await globalEditorCoordinationService.applyTransaction({
      documentId: docA.id,
      source: 'user',
      changes: [{ from: 0, to: 13, insertText: 'Line 1: Modified' }],
    });

    let currentDoc = globalDocumentEngine.getDocument(docA.id)!;
    expect(currentDoc.content).toBe('Line 1: Modified\nLine 2: Beta\nLine 3: Gamma');
    expect(currentDoc.isDirty).toBe(true);
    expect(globalEditorCoordinationService.canUndo(docA.id)).toBe(true);

    // Execute authoritative undo
    const undone = await globalEditorCoordinationService.undo(docA.id);
    expect(undone).toBe(true);

    currentDoc = globalDocumentEngine.getDocument(docA.id)!;
    expect(currentDoc.content).toBe('Line 1: Alpha\nLine 2: Beta\nLine 3: Gamma');
    // Content exactly matches saved baseline -> must return clean!
    expect(currentDoc.isDirty).toBe(false);
    expect(globalEditorCoordinationService.canRedo(docA.id)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Test B: Edit -> Undo -> Redo
  // ---------------------------------------------------------------------------
  it('correctly executes redo after undo restoring mutated content and dirty state', async () => {
    await globalEditorCoordinationService.applyTransaction({
      documentId: docA.id,
      source: 'user',
      changes: [{ from: 0, to: 6, insertText: 'Prefix' }],
    });

    expect(globalEditorCoordinationService.canUndo(docA.id)).toBe(true);
    expect(globalEditorCoordinationService.canRedo(docA.id)).toBe(false);

    // Undo
    await globalEditorCoordinationService.undo(docA.id);
    let currentDoc = globalDocumentEngine.getDocument(docA.id)!;
    expect(currentDoc.content).toBe('Line 1: Alpha\nLine 2: Beta\nLine 3: Gamma');
    expect(globalEditorCoordinationService.canRedo(docA.id)).toBe(true);

    // Redo
    const redone = await globalEditorCoordinationService.redo(docA.id);
    expect(redone).toBe(true);
    currentDoc = globalDocumentEngine.getDocument(docA.id)!;
    expect(currentDoc.content).toBe('Prefix: Alpha\nLine 2: Beta\nLine 3: Gamma');
    expect(currentDoc.isDirty).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Test C: Saved Baseline Tests (Edit A -> Save -> Edit B -> Undo B -> Clean)
  // ---------------------------------------------------------------------------
  it('marks document clean when undoing Edit B back to the saved baseline of Edit A', async () => {
    // Edit A
    await globalEditorCoordinationService.applyTransaction({
      documentId: docA.id,
      source: 'user',
      changes: [{ from: 0, to: 0, insertText: 'Header\n' }],
    });
    expect(globalDocumentEngine.getDocument(docA.id)!.isDirty).toBe(true);

    // Save Edit A
    await globalDocumentEngine.save(docA.id);
    let savedDoc = globalDocumentEngine.getDocument(docA.id)!;
    expect(savedDoc.isDirty).toBe(false);
    expect(savedDoc.savedBaselineContent).toBe(savedDoc.content);

    // Edit B
    await globalEditorCoordinationService.applyTransaction({
      documentId: docA.id,
      source: 'user',
      changes: [{ from: savedDoc.content.length, to: savedDoc.content.length, insertText: '\nFooter' }],
    });
    let afterEditB = globalDocumentEngine.getDocument(docA.id)!;
    expect(afterEditB.isDirty).toBe(true);

    // Undo Edit B
    await globalEditorCoordinationService.undo(docA.id);
    let afterUndoB = globalDocumentEngine.getDocument(docA.id)!;
    expect(afterUndoB.content).toBe(savedDoc.savedBaselineContent);
    // Because content matches saved baseline of Edit A, dirty must be false!
    expect(afterUndoB.isDirty).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Test D: Undo Past Save Point Becomes Dirty Again
  // ---------------------------------------------------------------------------
  it('marks document dirty when undoing past a save point because content differs from baseline', async () => {
    const initialContent = docA.content;
    // Edit
    await globalEditorCoordinationService.applyTransaction({
      documentId: docA.id,
      source: 'user',
      changes: [{ from: 0, to: 6, insertText: 'Version2' }],
    });
    // Save
    await globalDocumentEngine.save(docA.id);
    let savedDoc = globalDocumentEngine.getDocument(docA.id)!;
    expect(savedDoc.isDirty).toBe(false);
    expect(savedDoc.savedBaselineContent).not.toBe(initialContent);

    // Undo past save point
    await globalEditorCoordinationService.undo(docA.id);
    let afterUndo = globalDocumentEngine.getDocument(docA.id)!;
    expect(afterUndo.content).toBe(initialContent);
    expect(afterUndo.content).not.toBe(savedDoc.savedBaselineContent);
    // Now content differs from the newly saved baseline -> must be dirty!
    expect(afterUndo.isDirty).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Test E: Failed Save Does Not Corrupt History or Falsely Mark Clean
  // ---------------------------------------------------------------------------
  it('preserves dirty state and undo history when save fails', async () => {
    await globalEditorCoordinationService.applyTransaction({
      documentId: docA.id,
      source: 'user',
      changes: [{ from: 0, to: 6, insertText: 'Unsaved' }],
    });
    const doc = globalDocumentEngine.getDocument(docA.id)!;
    expect(doc.isDirty).toBe(true);

    // Assign handle to require physical write via fileService
    doc.resource = { ...doc.resource, handle: { kind: 'file', name: 'DocA.txt' } as any };

    // Simulate filesystem failure on writeFile
    vi.spyOn(fileService, 'writeFile').mockRejectedValueOnce(new Error('Disk write error'));

    // Attempt save which fails
    await expect(globalDocumentEngine.save(docA.id)).rejects.toThrow('Disk write error');

    const checkDoc = globalDocumentEngine.getDocument(docA.id)!;
    expect(checkDoc.isDirty).toBe(true);
    expect(globalEditorCoordinationService.canUndo(docA.id)).toBe(true);

    // Undo still works
    await globalEditorCoordinationService.undo(docA.id);
    expect(adapterA.getContent()).toBe(docA.savedBaselineContent);
  });

  // ---------------------------------------------------------------------------
  // Test F: Clean Document External Reload Clears Stale History
  // ---------------------------------------------------------------------------
  it('clears editor undo history when a clean document is reloaded with external content', async () => {
    const syncService = new ResourceSynchronizationService();
    // Edit then Undo to bring it back to clean
    await globalEditorCoordinationService.applyTransaction({
      documentId: docA.id,
      source: 'user',
      changes: [{ from: 0, to: 6, insertText: 'Local' }],
    });
    await globalEditorCoordinationService.undo(docA.id);
    expect(globalDocumentEngine.getDocument(docA.id)!.isDirty).toBe(false);

    // Clean document external reload
    await syncService.synchronizeChange(
      {
        uri: docA.resourceUri,
        type: 'modify',
        classification: 'clean_document_reload',
        documentId: docA.id,
        timestamp: Date.now(),
        workspaceGeneration: 1,
      },
      { diskContent: 'Brand new disk content completely different' }
    );

    const reloadedDoc = globalDocumentEngine.getDocument(docA.id)!;
    expect(reloadedDoc.content).toBe('Brand new disk content completely different');
    expect(reloadedDoc.isDirty).toBe(false);

    // Stale undo must NOT be available
    expect(globalEditorCoordinationService.canUndo(docA.id)).toBe(false);
    expect(await globalEditorCoordinationService.undo(docA.id)).toBe(false);
    // Content remains pristine
    expect(globalDocumentEngine.getDocument(docA.id)!.content).toBe('Brand new disk content completely different');
    syncService.dispose();
  });

  // ---------------------------------------------------------------------------
  // Test G: Dirty Document External Conflict Preserves Local Undo History
  // ---------------------------------------------------------------------------
  it('preserves local edits and local undo history when an external conflict occurs on a dirty document', async () => {
    const syncService = new ResourceSynchronizationService();
    await globalEditorCoordinationService.applyTransaction({
      documentId: docA.id,
      source: 'user',
      changes: [{ from: 0, to: 6, insertText: 'UnsavedLocal' }],
    });
    expect(globalDocumentEngine.getDocument(docA.id)!.isDirty).toBe(true);

    // Conflict event
    await syncService.synchronizeChange({
      uri: docA.resourceUri,
      type: 'modify',
      classification: 'dirty_document_conflict',
      documentId: docA.id,
      timestamp: Date.now(),
      workspaceGeneration: 1,
    });

    const conflictDoc = globalDocumentEngine.getDocument(docA.id)!;
    expect(conflictDoc.metadata.hasConflict).toBe(true);
    expect(conflictDoc.content.startsWith('UnsavedLocal')).toBe(true);

    // Local undo history is still intact and operable
    expect(globalEditorCoordinationService.canUndo(docA.id)).toBe(true);
    await globalEditorCoordinationService.undo(docA.id);
    expect(globalDocumentEngine.getDocument(docA.id)!.content).toBe(docA.savedBaselineContent);
    syncService.dispose();
  });

  // ---------------------------------------------------------------------------
  // Test H: Read-Only Documents Reject Undo and Redo
  // ---------------------------------------------------------------------------
  it('rejects undo and redo on read-only documents without altering content', async () => {
    const readOnlyDoc = (await globalDocumentEngine.openResource('file:///readonly.txt', {
      initialContent: 'Read only text',
      readOnly: true,
    })).document;

    const roAdapter = new CodeMirrorEditorAdapter();
    const roContainer = document.createElement('div');
    document.body.appendChild(roContainer);
    roAdapter.mount(roContainer, readOnlyDoc.content, { readOnly: true });
    globalEditorCoordinationService.registerEditorInstance(`editor-${readOnlyDoc.id}`, readOnlyDoc.id, roAdapter);

    expect(globalEditorCoordinationService.canUndo(readOnlyDoc.id)).toBe(false);
    expect(globalEditorCoordinationService.canRedo(readOnlyDoc.id)).toBe(false);
    expect(await globalEditorCoordinationService.undo(readOnlyDoc.id)).toBe(false);
    expect(await globalEditorCoordinationService.redo(readOnlyDoc.id)).toBe(false);

    globalEditorCoordinationService.unregisterEditorInstance(`editor-${readOnlyDoc.id}`);
    roAdapter.dispose();
    roContainer.remove();
  });

  // ---------------------------------------------------------------------------
  // Test I: Document Isolation (Doc A Undo Never Mutates Doc B)
  // ---------------------------------------------------------------------------
  it('strictly isolates history between documents so undo on A never mutates B', async () => {
    await globalEditorCoordinationService.applyTransaction({
      documentId: docA.id,
      source: 'user',
      changes: [{ from: 0, to: 6, insertText: 'DocA_Edited' }],
    });
    await globalEditorCoordinationService.applyTransaction({
      documentId: docB.id,
      source: 'user',
      changes: [{ from: 0, to: 8, insertText: 'DocB_Edited' }],
    });

    expect(adapterA.getContent().startsWith('DocA_Edited')).toBe(true);
    expect(adapterB.getContent().startsWith('DocB_Edited')).toBe(true);

    // Undo Doc A
    await globalEditorCoordinationService.undo(docA.id);

    // Doc A should be restored
    expect(adapterA.getContent()).toBe(docA.savedBaselineContent);
    // Doc B should be completely unchanged
    expect(adapterB.getContent().startsWith('DocB_Edited')).toBe(true);
    expect(globalEditorCoordinationService.canUndo(docB.id)).toBe(true);

    // Undo Doc B
    await globalEditorCoordinationService.undo(docB.id);
    expect(adapterB.getContent()).toBe(docB.savedBaselineContent);
  });

  // ---------------------------------------------------------------------------
  // Test J: Disposed Models and Stale Operations Safe Handling
  // ---------------------------------------------------------------------------
  it('safely rejects undo/redo on non-existent, unregistered, or disposed documents', async () => {
    expect(globalEditorCoordinationService.canUndo('non-existent-id')).toBe(false);
    expect(globalEditorCoordinationService.canRedo('non-existent-id')).toBe(false);
    expect(await globalEditorCoordinationService.undo('non-existent-id')).toBe(false);
    expect(await globalEditorCoordinationService.redo('non-existent-id')).toBe(false);

    // Unregister docA
    globalEditorCoordinationService.unregisterEditorInstance(`editor-${docA.id}`);
    expect(globalEditorCoordinationService.canUndo(docA.id)).toBe(false);
    expect(await globalEditorCoordinationService.undo(docA.id)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Test K: Atomic Programmatic Multi-Edit Grouping (Replace All)
  // ---------------------------------------------------------------------------
  it('groups multi-change programmatic edits into a single atomic undo step', async () => {
    // Text: "Line 1: Alpha\nLine 2: Beta\nLine 3: Gamma"
    // Replace "Line 1" -> "L1", "Line 2" -> "L2", "Line 3" -> "L3"
    const txResult = await globalEditorCoordinationService.applyTransaction({
      documentId: docA.id,
      source: 'replace',
      changes: [
        { from: 0, to: 6, insertText: 'L1' },
        { from: 14, to: 20, insertText: 'L2' },
        { from: 27, to: 33, insertText: 'L3' },
      ],
    });

    expect(txResult.status).toBe('applied');
    const updated = globalDocumentEngine.getDocument(docA.id)!;
    expect(updated.content).toBe('L1: Alpha\nL2: Beta\nL3: Gamma');

    // History depth should show exactly 1 undo step for all 3 replacements
    const depth = globalEditorCoordinationService.getHistoryDepth(docA.id);
    expect(depth.undoDepth).toBe(1);

    // Single undo reverses the entire multi-edit operation back to original text
    await globalEditorCoordinationService.undo(docA.id);
    const reverted = globalDocumentEngine.getDocument(docA.id)!;
    expect(reverted.content).toBe(docA.savedBaselineContent);
    expect(reverted.isDirty).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Test L: Command System Integration & canExecute Availability
  // ---------------------------------------------------------------------------
  it('correctly evaluates command system canExecute and executes via globalEditorCoordinationService', async () => {
    const undoCmd = defaultCommands.find((c) => c.id === 'editor.undo')!;
    const redoCmd = defaultCommands.find((c) => c.id === 'editor.redo')!;

    expect(undoCmd).toBeDefined();
    expect(redoCmd).toBeDefined();

    const mockContext: CommandContext = {
      activeDoc: {
        id: docA.id,
        title: docA.title,
        content: docA.content,
        language: docA.languageId,
        contentRevision: docA.contentRevision,
        savedRevision: docA.savedRevision,
        isDirty: false,
        lastSavedTimestamp: Date.now(),
      },
      shellState: {} as any,
      workspaceActions: {} as any,
      shellActions: {} as any,
    };

    // Initially canUndo is false
    expect(undoCmd.canExecute!(mockContext)).toBe(false);
    expect(redoCmd.canExecute!(mockContext)).toBe(false);

    // Apply an edit via transaction
    await globalEditorCoordinationService.applyTransaction({
      documentId: docA.id,
      source: 'user',
      changes: [{ from: 0, to: 6, insertText: 'Changed' }],
    });
    expect(undoCmd.canExecute!(mockContext)).toBe(true);

    // Execute undo command
    await undoCmd.execute(mockContext);
    expect(adapterA.getContent()).toBe(docA.savedBaselineContent);
    expect(undoCmd.canExecute!(mockContext)).toBe(false);
    expect(redoCmd.canExecute!(mockContext)).toBe(true);

    // Execute redo command
    await redoCmd.execute(mockContext);
    expect(adapterA.getContent().startsWith('Changed')).toBe(true);
    expect(undoCmd.canExecute!(mockContext)).toBe(true);
    expect(redoCmd.canExecute!(mockContext)).toBe(false);
  });
});
