# QM Editor — Edit Transactions, Change Events & Revision Consistency Architecture
## Phase 04, Step 31 Subsystem Specification

### 1. Executive Summary

In high-performance desktop editors, document modifications cannot merely be unvalidated whole-string replacements. Text mutations must be transactional, ordered, and monotonically revisioned to support multi-cursor operations, batch search/replace, language refactoring, IME compositions, and atomic undo/redo histories.

Step 31 implements the **Core Edit Transaction & Revision Consistency Subsystem** in:
```text
src/core/edit/
├── EditTypes.ts              # EditTransaction, SingleTextEdit, CommittedEditTransaction, Events
├── EditErrors.ts             # InvalidEditRangeError, OverlappingEditError, StaleRevisionError, ReadOnlyDocumentError
├── EditTransactionManager.ts # Validation, reverse offset application, cursor mapping, IME session tracker
└── index.ts                  # Subsystem barrel export
```

---

### 2. Transaction Model & Core Data Structures

```typescript
export interface SingleTextEdit {
  from: number;          // 0-indexed character offset start
  to: number;            // 0-indexed character offset end (from <= to)
  insertText: string;    // Replacement string
  deletedText?: string;  // Preserved original text slice (for undo/verification)
}

export interface EditTransaction {
  id?: string;
  documentId: string;
  baseRevision: number;
  changes: SingleTextEdit[];
  origin?: TransactionOrigin;
  timestamp?: number;
  isComposition?: boolean;
  selectionsBefore?: CursorSelection[];
  selectionsAfter?: CursorSelection[];
  metadata?: Record<string, unknown>;
}
```

---

### 3. Change Ordering & Boundary Safety

#### Validation
All edits in an `EditTransaction` undergo strict range validation:
1. Bounds check: `0 <= from <= to <= content.length`. Out-of-bounds ranges throw `InvalidEditRangeError`.
2. Overlap check: Edits are sorted ascending by starting offset. If `edit[i].to > edit[i+1].from`, an `OverlappingEditError` is thrown, preventing corrupted interleaved text buffers.

#### Reverse Offset Execution
Edits are executed descending by `from` offset (highest character offset applied first).
```text
Buffer: "const a = 1; const b = 2;"
Edit 1: replace 'a' at [6, 7]
Edit 2: replace 'b' at [19, 20]

Execution order:
1. Replace 'b' at [19, 20] -> [6, 7] offset remains valid!
2. Replace 'a' at [6, 7] -> text is mutated without offset distortion.
```

---

### 4. Revision Invariants & Concurrency

- **Monotonic Revision Increment:** Every non-empty text mutation increments `contentRevision = contentRevision + 1`.
- **Identity No-Op Guard:** An edit transaction that results in identical text does not increment the revision or toggle the dirty flag.
- **Strict Revision Concurrency:** If `strictRevision: true` is passed, `transaction.baseRevision` must match `document.contentRevision`. Stale concurrent transactions are rejected with `StaleRevisionError`.

---

### 5. Undo & Save State Protection

- **Dirty Flag Invariant:** `isDirty = contentRevision !== savedRevision`.
- **Undo Restoration:** When undoing back to the revision where the file was saved (`contentRevision === savedRevision`), `isDirty` cleanly transitions back to `false`.
- **In-Flight Save Race Protection:** If edits occur while an asynchronous disk write is in-flight:
  - Document reaches revision 2.
  - Save completes for revision 1 (`savedRevision: 1`).
  - `isDirty` remains `true` because revision 2 was not persisted.

---

### 6. IME (Input Method Editor) Composition Lifecycle

Complex scripts (Japanese, Chinese, Korean, diacritics) utilize IME composition buffers.
- `EditTransactionManager.startComposition(docId)` tracks active composition state.
- Intermediate keystrokes during composition carry `isComposition: true` and origin `'ime'`.
- `EditTransactionManager.endComposition(docId, committedRevision)` commits the final composition state.
- `CodeMirrorEditorAdapter` passes `isComposition: Boolean(view.composing)` to update listeners.

---

### 7. Change Events & Subsystem Observability

Subsystems subscribe to typed change events without polling:

| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `document.transactionWillApply` | `{ documentId, transaction, currentRevision }` | Pre-application validation hook |
| `document.transactionApplied` | `{ documentId, transaction, previousRevision, newRevision, isDirty }` | Authoritative mutation committed |
| `document.transactionFailed` | `{ documentId, transaction, error }` | Error telemetry and rollback notification |
| `document.dirtyStateChanged` | `{ documentId, isDirty, revision, savedRevision }` | UI tab indicator updates |
| `document.compositionStarted` | `{ documentId, timestamp }` | IME composition start |
| `document.compositionEnded` | `{ documentId, committedRevision, timestamp }` | IME composition commit |
