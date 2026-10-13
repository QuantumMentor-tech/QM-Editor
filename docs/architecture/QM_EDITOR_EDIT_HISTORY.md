# QM Editor — Edit History Semantics & Transaction Safety

**Phase 04 — Core Application Engine**  
**Step 39 Specification — Edit History Semantics, Save Coordination & Extensibility**

---

## 1. Scope & Purpose

This document details the operational semantics of edit history, transaction boundaries, dirty state mechanics, and lifecycle coordination across QM Editor editing operations.

It defines how editing operations maintain mathematical and architectural integrity across:
- Visual Editor Engine (`CodeMirror 6`)
- Edit Transaction System
- Document Engine
- File System & Save System
- External Watcher & Synchronization Services

---

## 2. Core Principles & Non-Negotiable Rules

1. **Native History Authority**: The Editor Engine owns the reversible text history. Application code must not create a competing text undo stack.
2. **Transactional Programmatic Mutations**: Any programmatic edit (Replace, Replace All, Formatter, Refactoring, AI actions) must pass through `EditorCoordinationService.applyTransaction(...)`.
3. **Monotonic Document Revisioning**: Every text alteration produces an unambiguous, strictly monotonic document revision ($N \to N+1$). Revisions are state-mutation counters, not historical file snapshot indices.
4. **Content-Baseline Dirty Derivation**: `isDirty` is authoritative and based on whether the document buffer content equals `savedBaselineContent`. Undoing an edit back to the saved content baseline strictly restores `isDirty = false`.
5. **Save Invariant**: Saving is a persistence event, not a text edit. Saving updates the `savedBaselineContent` and `savedRevision` and resets `isDirty = false`. It does **not** push an entry to the undo stack.
6. **Destructive Reset Isolation**: Destructive model replacements (e.g., clean external file reload) explicitly clear editor native history to prevent corrupting reloaded content.

---

## 3. History Reset Matrix

| Event | History Action | Rationale |
| :--- | :--- | :--- |
| **User Typing / Paste / Delete** | Pushed to native history | Normal reversible user operations. |
| **Composite Edit (Replace All)** | Grouped into 1 native step | Logical user intent represents one atomic change. |
| **Document Save** | History preserved unchanged | Content did not change; only persistence baseline shifted. |
| **Document Save As** | History preserved unchanged | Content remains identical; resource URI & baseline updated. |
| **Failed Save** | History preserved unchanged | Persistence failed; dirty state and undo stack remain intact. |
| **Clean External Reload** | **Cleared (`clearHistory()`)** | Content replaced from disk; prior undo operations would corrupt file. |
| **External Conflict (Dirty doc)** | History preserved in-memory | Local unsaved user work must remain protected and undoable. |
| **Tab Switch** | History preserved in model | Document model remains alive; context evaluates active model history. |
| **Tab Close & Model Dispose** | Model destroyed | Closed documents release memory; reopening starts with fresh history. |
| **Workspace Switch** | All models disposed | Active workspace switch clears instances; prevents cross-workspace pollution. |

---

## 4. Multi-Edit Grouping & Transaction Execution

For composite edits:

```typescript
const result = await globalEditorCoordinationService.applyTransaction({
  documentId: 'doc-123',
  source: 'replace',
  changes: [
    { from: 10, to: 15, insertText: 'apple' },
    { from: 40, to: 48, insertText: 'orange' },
  ],
});
```

Execution guarantees:
1. **Validation**: All ranges are verified against document length and checked for overlaps. Stale expected revisions and read-only states are rejected before mutation.
2. **Single Dispatch**: Dispatched to `CodeMirrorEditorAdapter.applyEdits(...)` as a single `view.dispatch({ changes })` call.
3. **Atomic Undoability**: CodeMirror treats the single dispatch as one reversible transaction. Invoking `undo` restores all ranges simultaneously.
4. **Document Eventing**: `DocumentEngine.updateText` synchronizes once for the composite operation, emitting `editor.transactionApplied` and updating `isDirty`.

---

## 5. Extensibility Boundaries for Future Phases

Future features must respect the boundaries established in Step 39:

### Code Formatting (Step 40+)
- Must pass formatted diffs through `EditorCoordinationService.applyTransaction({ source: 'format', changes })`.
- Multi-line formatting must group into a single undo step.

### Code Actions & Refactorings
- Multi-change refactorings (e.g. rename symbol in file) must use `applyTransaction`.
- The user must be able to undo the entire refactoring in a single step.

### AI-Assisted Edits
- AI code insertions or replacements must generate a `ProgrammaticEditTransaction`.
- Must check `expectedRevision` to avoid overwriting user edits in-flight.
- Must enter the native undo stack so the user can easily reject the AI edit with `Mod+Z`.
