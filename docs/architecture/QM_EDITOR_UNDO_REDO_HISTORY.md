# QM Editor — Undo/Redo History, Edit Grouping & Transaction Safety Architecture

**Phase 04 — Core Engine, Document Lifecycle, Diagnostics and Application Services**  
**Step 033 Implementation Architecture & Operational Specifications**

---

## 1. Overview & System Mission

The **Document History, Undo/Redo & Edit Grouping Engine** provides QM Editor with resilient, bounded, and transaction-safe state inversion for document editing. In professional code editors, undo and redo must not merely track strings of raw text; they must preserve:
1. **Mathematical Inversion Consistency**: Changes applied across multi-character spans, multi-cursor locations, or batch operations must roll back cleanly to the exact character stream without offset drift or data corruption.
2. **Monotonic & Symmetrical Revisioning**: Undoing back to the exact revision at which a file was saved (`savedRevision`) must restore clean state (`isDirty = false`). Redoing away from the saved revision must re-engage dirty state (`isDirty = true`).
3. **Atomic Edit Grouping**: Multi-keystroke typing bursts or batch macros (e.g. Find & Replace All, block indent, code formatting) must group into atomic history units so that a single undo command reverts the entire semantic action.
4. **Multi-Cursor Selection Restoration**: Both head and anchor coordinates for multiple cursors must be preserved and restored symmetrically across undo and redo.
5. **Bounded Memory & Lifecycle Protection**: History stacks must be capped at bounded depth (`maxDepth`) per document and disposed cleanly when documents close, preventing memory leaks during long-running sessions.

---

## 2. Architectural Components

```
+-----------------------------------------------------------------------------------+
|                            EditTransactionManager                                 |
|            - Applies forward transactions (origin: 'user', 'replace', etc.)       |
|            - Emits document.transactionApplied event                              |
+-----------------------------------------------------------------------------------+
                                          |
                                          v (listens to forward transactions)
+-----------------------------------------------------------------------------------+
|                            DocumentHistoryService                                 |
|  - Per-document stack management (getOrCreateStack(documentId))                   |
|  - Coordinates undo(doc) and redo(doc) via EditTransactionManager                 |
|  - Emits history events: entryAdded, undone, redone, savedRevisionSet             |
|  - Edit Grouping API: beginGroup(), endGroup(), withGroup(label, fn)              |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                            DocumentHistoryStack                                   |
|  - undoStack: (HistoryEntry | EditGroup)[]                                        |
|  - redoStack: (HistoryEntry | EditGroup)[]                                        |
|  - Bounded Capacity (maxDepth = 500)                                              |
|  - Auto-grouping for rapid typing (threshold: 400ms)                              |
|  - Saved revision checkpoint tracking                                             |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                              HistoryInversion                                     |
|  - invertChanges(changes): Inverts forward SingleTextEdit[] to inverse edits      |
|  - createInverseTransaction(committedTx): Generates undo transaction              |
|  - createForwardTransactionFromEntry(entry): Generates redo transaction           |
+-----------------------------------------------------------------------------------+
```

### 2.1 Mathematical Edit Inversion (`src/core/history/HistoryInversion.ts`)
For a sorted list of non-overlapping text edits applied to a document:
- For each change $i$:
  $$\text{newFrom} = \text{change.from} + \text{cumulativeDelta}$$
  $$\text{newTo} = \text{newFrom} + \text{insertLength}$$
  $$\text{inverseEdit} = \{ \text{from}: \text{newFrom}, \text{to}: \text{newTo}, \text{insertText}: \text{deletedText}, \text{deletedText}: \text{insertText} \}$$
  $$\text{cumulativeDelta} \mathrel{+}= \text{insertLength} - \text{deleteLength}$$
When applied in descending offset order, these inverse edits perfectly restore `contentBefore` from `contentAfter`.

### 2.2 Per-Document History Stack (`src/core/history/DocumentHistoryStack.ts`)
- **Discrete Storage**: Maintains isolated `undoStack` and `redoStack` per document ID.
- **Redo Invalidation**: Any fresh forward modification automatically clears the redo stack.
- **Capacity Bounding**: When `undoStack.length > maxDepth` (default 500), oldest entries are shifted out.
- **Auto-Grouping**: Consecutive 1-character typing edits within `autoGroupThresholdMs` (default 400ms) coalesce into an `EditGroup`.

### 2.3 Document History Service (`src/core/history/DocumentHistoryService.ts`)
- **Canonical Lifecycle Service**: Registered in `ApplicationRuntime` (`src/core/runtime/defaultServices.ts`).
- **Transaction Interception**: Listens to `globalEditTransactionManager`'s `document.transactionApplied` events and records entries while ignoring transactions originating from `'undo'` or `'redo'`.
- **Atomic Undo/Redo**:
  - `undo(doc)`: Pops from undo stack, applies inverse transaction, pushes to redo stack.
  - `redo(doc)`: Pops from redo stack, applies forward transaction, pushes to undo stack.
  - Multi-entry `EditGroup` undo applies all inverse edits in reverse chronological order; redo applies in forward chronological order.

### 2.4 Workspace Context Integration (`src/state/WorkspaceContext.tsx`)
- Exposes `undoDoc(documentId)`, `redoDoc(documentId)`, `canUndoDoc(documentId)`, and `canRedoDoc(documentId)` on `WorkspaceContextType`.
- When files are saved (`saveDoc`, `saveDocAs`), `globalDocumentHistoryService.markSaved(docId, targetRev)` updates the saved checkpoint.
- When tabs are closed (`closeDoc`), `globalDocumentHistoryService.disposeDocument(docId)` purges the document stack.

---

## 3. Save / Dirty State Symmetry

A critical invariant of the editor is that undoing to the exact revision that was saved must mark the document as clean:

```
[Rev 0: Saved] -> Edit A -> [Rev 1: Dirty] -> Save -> [Rev 1: Clean, SavedRev=1]
                                                          |
                                                       Edit B
                                                          |
                                                   [Rev 2: Dirty]
                                                          |
                                                       Undo B
                                                          |
                                                   [Rev 1: Clean] <--- Symmetrical!
```

---

## 4. Multi-Cursor & Selection Preservation

Every `HistoryEntry` captures:
- `selectionsBefore`: Exact multi-cursor `[ { anchor, head }, ... ]` array before edits.
- `selectionsAfter`: Exact multi-cursor positions after edits.

When `undo` is executed:
- The inverse transaction outputs `selectionsBefore` as `selectionsAfter`, restoring the cursor positions to their exact pre-edit offsets.
When `redo` is executed:
- The forward transaction outputs `selectionsAfter`, returning all cursors to their post-edit offsets.
