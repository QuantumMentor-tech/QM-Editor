# QM Editor — Fold State Lifecycle & Preservation

## Phase 06 — Advanced Features (Step 68 of 135)

---

## 1. Non-Persistent Derived State vs User Visual State

### Invariant Rules
1. **Raw LSP Folding Ranges are Strictly Ephemeral**:
   - Ranges returned by `textDocument/foldingRange` are never written to disk, IndexedDB, local history, backup archives, or document metadata.
2. **User Fold State Belongs to CodeMirror 6**:
   - Whether a section is collapsed or expanded is tracked inside CodeMirror's `foldState` (`DecorationSet`).
3. **Zero Content Mutation**:
   - Collapsing or expanding a fold never mutates document text, changes buffer lengths, advances document revisions, or creates undo/redo transactions.

---

## 2. Document Edit Reconciliation

When the user modifies a document:
1. Active folded ranges in CodeMirror automatically map forward through `tr.changes.mapPos()`.
2. Existing collapsed regions stay collapsed at their updated line offsets.
3. The coordinator receives `document.changed`, debounces the request (`300ms`), and issues fresh `textDocument/foldingRange` queries.
4. Late-arriving responses verify `contentRevision`. If the user edited code while the request was in flight, the stale response is safely discarded without disturbing the editor.

---

## 3. Workspace Switch & Document Close

- **On Document Close**:
  - In-flight cancellation tokens are triggered.
  - Debounce timers are cancelled.
  - Cached ranges are deleted.
- **On Workspace Switch**:
  - All caches across all documents are purged immediately.
  - Server sessions are restarted or closed cleanly.
  - No folding data leaks from one workspace into another.
