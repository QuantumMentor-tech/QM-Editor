# QM Editor — Edit Transaction System
**Phase 04, Step 37 — Core Application Engine**

---

## 1. System Purpose & Core Invariant

The **Edit Transaction System** defines the normalized contract through which text documents in QM Editor are programmatically altered.

> **Rule:** No automation, tool, command, formatter, or extension may directly mutate editor instances or raw text buffers. All programmatic changes must be formulated as a `ProgrammaticEditTransaction` and dispatched through `EditorCoordinationService.applyTransaction()`.

---

## 2. Edit Transaction Model

### `ProgrammaticEditTransaction` Interface
```typescript
export interface ProgrammaticEditTransaction {
  /** Unique ID of target document in DocumentEngine */
  documentId: string;
  /** Ordered list of individual replacements */
  changes: SingleTextEdit[];
  /** Expected contentRevision baseline for concurrency safety */
  expectedRevision?: number;
  /** Logical origin of modification ('replace', 'format', 'user', 'programmatic', etc.) */
  source?: TransactionOrigin;
  /** Human-readable description (e.g. "Replace all matches") */
  description?: string;
  /** Grouping identifier for undo history coalescing */
  undoGroup?: string;
}
```

### `SingleTextEdit` Operation
```typescript
export interface SingleTextEdit {
  /** 0-based character start offset */
  from: number;
  /** 0-based character end offset (from <= to) */
  to: number;
  /** Text to insert in place of [from, to] */
  insertText: string;
}
```

---

## 3. Atomic Multi-Edit Operations

Multiple simultaneous edits (such as Replace All, multi-cursor replacements, or future refactorings) are batched into a single transaction:

1. **Non-Overlapping Verification:** Edits are sorted in ascending offset order. If any edit's `to` exceeds the subsequent edit's `from`, the transaction is rejected with `'invalid_range'` to prevent buffer corruption.
2. **Atomic Dispatch:**
   - In mounted CodeMirror editors, edits are passed directly to `view.dispatch({ changes: [...] })`.
   - CodeMirror computes a single ChangeSet, applies changes simultaneously, and creates **one combined undo entry**.
   - In headless documents, edits are applied in descending offset order (`[...changes].sort((a,b) => b.from - a.from)`), ensuring that earlier character indices remain stable during insertion.

---

## 4. Revision Expectations & Stale Edit Protection

When background services (e.g. search, background linters, or multi-file replace) compute an edit, user interaction may occur before the edit is dispatched.

```text
Time T0: Document at Revision 5
Time T1: Tool calculates edit based on Revision 5
Time T2: User types character -> Document at Revision 6
Time T3: Tool dispatches edit with expectedRevision: 5
Time T4: Transaction REJECTED as 'stale' (Revision mismatch 5 !== 6)
```

- If `expectedRevision !== undefined && doc.contentRevision !== expectedRevision`, the transaction is rejected immediately.
- Result status is `'stale'`.
- An `editor.transactionRejected` event is emitted.
- Outdated modifications cannot overwrite newer user edits.

---

## 5. Read-Only & Conflict Enforcement

- **Read-Only Protection:** If `doc.metadata.isReadOnly === true`, edits are rejected with status `'read_only'`.
- **Conflict Protection:** If `doc.metadata.hasConflict === true` (external disk modification conflict detected), edits are rejected with status `'conflict'` until the conflict is resolved.

---

## 6. Transaction Result Model

`applyTransaction` returns a structured result without throwing unexpected runtime exceptions:

```typescript
export interface TransactionApplyResult {
  status:
    | 'applied'
    | 'stale'
    | 'rejected'
    | 'invalid_range'
    | 'read_only'
    | 'conflict'
    | 'failed';
  documentId: string;
  newRevision?: number;
  appliedOperationsCount: number;
  error?: string;
}
```

For workflows requiring standard try/catch semantics, `applyTransactionStrict(tx)` is provided, which throws:
- `StaleTransactionError`
- `ReadOnlyEditError`
- `ConflictEditError`
- `InvalidEditRangeError`

---

## 7. Audit & Event Lifecycle

| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `editor.transactionApplied` | `{ documentId, source, newRevision, operationsCount }` | Fired when edits are committed to the model and buffer. |
| `editor.transactionRejected` | `{ documentId, reason, expectedRevision, currentRevision }` | Fired when an edit is rejected due to stale revision, read-only state, or invalid range. |
| `editor.viewStateSaved` | `{ documentId, cursorPosition }` | Fired when view state is preserved prior to tab transition. |
| `editor.viewStateRestored` | `{ documentId, cursorPosition }` | Fired when clamped view state is restored to active editor. |

*Note: Document buffers, replacement strings, and user input are strictly excluded from event payloads to protect privacy.*
