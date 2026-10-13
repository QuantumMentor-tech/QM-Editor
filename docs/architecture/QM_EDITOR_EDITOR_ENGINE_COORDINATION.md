# QM Editor — Editor Engine Coordination Architecture
**Phase 04, Step 37 — Core Application Engine**

---

## 1. Executive Summary & Objective

Step 37 establishes the canonical **Editor Engine Coordination Layer** (`EditorCoordinationService`) for QM Editor. It bridges the authoritative **Document Engine** (Step 36) with visual interactive editor adapters (`CodeMirrorEditorAdapter`), text models, view states, native undo stacks, and programmatic editing transactions.

The critical architectural invariant is:
> **The Editor Engine renders and manages interactive editing, while the Editor Coordination Layer provides a controlled application-level editing contract.**

Arbitrary UI components, background search tools, formatters, code actions, and future AI tooling are strictly prohibited from directly mutating editor internals or dispatching ad-hoc edits. All programmatic modifications flow through the normalized transaction boundary.

---

## 2. Conceptual Architecture

```text
                 Document Engine (Authoritative Lifecycle & Content)
                               │
                               ▼
                    Editor Coordination Layer
                    (EditorCoordinationService)
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
      Text Model       Edit Transactions        View State
    (TextModelImpl) (ProgrammaticEditTx)   (EditorViewStateManager)
          │                    │                    │
          ▼                    ▼                    ▼
     Editor Buffer         Undo/Redo         Cursor/Selection
 (CodeMirror DocState) (Native History)     (Clamped Coordinates)
          │
          ▼
    Editor Engine
  (CodeMirrorAdapter)
          │
          ▼
      Editor UI
   (EditorSurface)
```

---

## 3. Core Structural Separation

| Layer / Model | Ownership & Authority | Responsibility |
| :--- | :--- | :--- |
| **Document Record** (`DocumentRecord`) | `DocumentEngine` | Canonical resource identity, dirty state, saved baseline revision, disk synchronization. |
| **Text Model** (`TextModel`) | `EditorCoordinationService` | Normalized in-memory text interface (line counting, line content, offset-to-coordinate mapping). Wraps `DocumentRecord` without buffer duplication. |
| **Editor Instance** (`EditorInstanceRecord`) | `EditorCoordinationService` | Visual rendered editor control (`EditorAdapterInterface`), bound container, active viewport. Multiple instances may exist (split/diff view). |
| **View State** (`EditorViewState`) | `EditorViewStateManager` | Ephemeral UI state (cursor line/col, multi-selection ranges, scroll positions). Decoupled from document data; clamped on restore. |
| **Edit Transaction** (`ProgrammaticEditTransaction`) | `EditorCoordinationService` | Atomic change specification with revision verification, range checks, and undo integration. |

---

## 4. Model Ownership & Lifecycle

1. **Document Opening:**
   - `DocumentEngine` opens or resolves the resource (`DocumentRecord`).
   - `EditorCoordinationService.getTextModel(docId)` creates or retrieves a `TextModelImpl` referencing the canonical document.
   - `EditorSurface` mounts the visual adapter (`CodeMirrorEditorAdapter`).
   - `EditorCoordinationService.registerEditorInstance(instanceId, docId, adapter)` registers the surface.
   - `EditorCoordinationService.restoreViewStateForInstance(instanceId, docId)` loads clamped cursor and scroll state.

2. **Document Tab Switching:**
   - Active view state is captured and persisted in `EditorViewStateManager` before unmounting or switching tabs.
   - Outgoing editor adapter unregisters cleanly.
   - Incoming document binds to the new or reconfigured editor instance.
   - View state for the incoming document is clamped against its current length and restored.

3. **Document Closing:**
   - Editor instances are detached and unregistered.
   - View state may be purged or cached for recent session restoration.
   - `DocumentEngine` handles resource closure safely.

---

## 5. Single Text Model & No Buffer Duplication

QM Editor guarantees that no secondary text buffer is duplicated in JavaScript memory.
- `TextModelImpl` holds a direct reference to `DocumentRecord.content`.
- Line counts and coordinate translations are calculated deterministically on demand.
- CodeMirror's internal state represents the interactive rendering buffer. On change, updates synchronize to `DocumentRecord.content` with revision increments.

---

## 6. Single Undo Stack Authority

- QM Editor **does not introduce a second undo/redo stack**.
- CodeMirror 6's `@codemirror/commands` `history()` extension maintains the native undo/redo history.
- Programmatic edits dispatch atomic change arrays (`changes: [{ from, to, insert }]`) in a single transaction, ensuring they condense into **one undo entry**.
- Undo and Redo operations delegate directly to `adapter.undo()` and `adapter.redo()`.
- When an undo/redo occurs, CodeMirror dispatches doc changes, updating `DocumentRecord.contentRevision`. If `contentRevision === savedRevision`, the document automatically returns to clean (`isDirty: false`).

---

## 7. View State Isolation & Clamping

Ephemeral editor state (cursor line/column, selection anchors/heads, scroll offsets) belongs strictly to **Editor View State**, never the core `DocumentRecord`.
- `EditorViewStateManager` isolates view states per `documentId`.
- **Clamping Invariant:** When restoring view state after external changes, saves, or tab transitions:
  - Line numbers are clamped to `[1, totalLines]`.
  - Column numbers are clamped to `[1, lineText.length + 1]`.
  - Selection offsets are clamped to `[0, doc.length]`.
  - Out-of-bounds crashes are mathematically impossible.

---

## 8. Programmatic Edit Boundary & Safety Invariants

All programmatic modifications (Search & Replace, Multi-File Replace, future formatters, future code actions) must call `EditorCoordinationService.applyTransaction(tx)`.

### Transaction Validation Pipeline
```text
applyTransaction(tx)
  ├── 1. Document Existence: document must be open in DocumentEngine
  ├── 2. Read-Only Protection: reject with 'read_only' if doc.metadata.isReadOnly
  ├── 3. Conflict Protection: reject with 'conflict' if doc has unresolved external disk conflict
  ├── 4. Stale Revision Protection: reject with 'stale' if expectedRevision !== doc.contentRevision
  ├── 5. Range Bounds: all from/to offsets must be within [0, content.length] and from <= to
  ├── 6. Overlapping Edits: ensure no overlapping spans in transaction
  ├── 7. Dispatch:
  │       ├─ If active adapter mounted: dispatch to adapter.applyEdits (1 atomic undo unit)
  │       └─ If headless / unmounted: apply in descending offset order
  └── 8. Synchronize DocumentEngine: updateText increments revision and emits 'document.changed'
```

---

## 9. Privacy & Diagnostic Security

Editor content is strictly confidential:
- Transaction logging records only `documentId`, `newRevision`, `operationsCount`, and `source`.
- **Replacement text, inserted characters, and pasted buffers are NEVER logged or exposed to telemetry**.
- Diagnostic exceptions provide clean, typed error messages (`StaleTransactionError`, `ReadOnlyEditError`, `InvalidEditRangeError`) without leaking user code snippets.
