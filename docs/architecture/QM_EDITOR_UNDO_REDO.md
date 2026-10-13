# QM Editor — Undo/Redo Coordination & History Architecture

**Phase 04 — Core Application Engine**  
**Step 39 Specification — Undo/Redo Coordination, Edit History Integrity & Transaction Safety**

---

## 1. System Overview & Core Architecture Rule

The **Undo/Redo Coordination and Edit History Integrity Layer** establishes canonical coordination between the visual Editor Engine (`CodeMirror 6`), the Core `DocumentEngine`, the `EditorCoordinationService`, the `EditTransactionManager`, and external resource synchronization.

### Authoritative Ownership Rule
There is **one authoritative undo/redo implementation for the actual text model**: the Editor Engine (`CodeMirror 6`). QM Editor **does not** maintain a duplicate application-level text snapshot stack (`previousContents[]`, `nextContents[]`). 

The architectural flow is strictly maintained:

```text
User Input / Command / Programmatic Feature
                    ↓
        Edit Transaction System
                    ↓
              Editor Model
                    ↓
        Editor Native Undo History (CodeMirror 6)
                    ↓
          Document Synchronization
                    ↓
            Document Revision
                    ↓
             Saved Baseline
                    ↓
              Dirty State
                    ↓
            Save / Event Systems
```

The application layer coordinates history, enforces lifecycle boundaries, and synchronizes document revisions and dirty state, rather than duplicating or replacing native text history.

---

## 2. Ownership Model

| Component | Authoritative Responsibilities |
| :--- | :--- |
| **Editor Engine (`CodeMirror 6`)** | Owns native text buffer undo/redo history, inversion deltas, cursor/selection restoration, and edit stacking. |
| **Edit Transaction System (`EditorCoordinationService`)** | Owns edit validation, non-overlapping range checks, revision validation, transaction boundaries, and programmatic edit routing. |
| **Document Engine (`DocumentEngine`)** | Owns document identity, monotonic document revisions (`contentRevision`), saved baselines (`savedBaselineContent`), dirty state (`isDirty`), and resource lifecycle. |
| **Command System (`CommandRegistry`)** | Owns command discoverability, dynamic enablement (`canUndo`, `canRedo`), keyboard shortcuts (`Mod+Z`, `Mod+Y`), and context isolation. |
| **Resource Synchronization (`ResourceSynchronizationService`)** | Owns filesystem change detection, internal save correlation, clean reload history invalidation, and conflict isolation. |

---

## 3. Document Revision vs. Saved Baseline vs. Dirty State

### Conceptual Distinctions
The system strictly enforces the conceptual differences between these dimensions:
- **Editor Model Version / Undo Depth**: Native reversible steps in the CodeMirror editor state (`undoDepth`, `redoDepth`).
- **Document Revision (`contentRevision`)**: Monotonically increasing integer representing application-level mutation events. A mutation always increments the revision ($N \to N+1$). Undoing an edit advances the mutation revision because a new state transition took place.
- **Saved Baseline (`savedBaselineContent`)**: The exact text snapshot persisted during the last successful save or initial file open.
- **Dirty State (`isDirty`)**: Authoritative derivation based on whether `currentContent !== savedBaselineContent`.

### State Transition Matrix

| Action | Current Content vs Saved Baseline | `isDirty` | Content Revision | History Effect |
| :--- | :--- | :--- | :--- | :--- |
| **Open File** | Identical | `false` | $0$ | Native history empty (`undoDepth = 0`) |
| **Typing / Edit A** | Differs | `true` | $1$ | Edit pushed to native undo stack (`undoDepth = 1`) |
| **Undo A** | Identical | `false` | $2$ | Operation reversed; returns to saved baseline; clean! |
| **Redo A** | Differs | `true` | $3$ | Edit re-applied; differs from saved baseline |
| **Save** | Identical (`baseline = content`) | `false` | $3$ | **No history entry created**; baseline updated |
| **Edit B** | Differs | `true` | $4$ | Edit pushed to native undo stack |
| **Undo B** | Identical to post-Save content | `false` | $5$ | Matches saved baseline; returns clean |
| **Undo A (Past Save)** | Differs from post-Save content | `true` | $6$ | Differs from post-Save baseline; becomes dirty |
| **Failed Save** | Differs | `true` | Unchanged | Baseline unchanged; undo history intact |

---

## 4. Programmatic Edits & Logical Transaction Grouping

All programmatic edits (Search/Replace, Replace All, future formatting, refactoring, and AI operations) must enter the editor text model through `EditorCoordinationService.applyTransaction(...)`:

1. **Validation**: Document existence, read-only status, conflict status, expected revision, and non-overlapping range bounds are strictly verified before dispatch.
2. **Atomic Dispatch**: Composite multi-edit operations (such as Replace All across a document) are passed to the mounted adapter via `instance.adapter.applyEdits(changes)` as a single transaction dispatch.
3. **History Grouping**: CodeMirror 6 groups all changes in a single dispatch into a single undo step. A single user undo operation cleanly reverts all edits of the composite operation.
4. **Document Synchronization**: Canonical `DocumentEngine.updateText(...)` is updated with the resulting content and metadata (`source: 'replace'`, `'format'`, etc.).

---

## 5. Multi-Document Isolation & Tab Switching

- **Zero Cross-Document Leakage**: History belongs strictly to the individual document's editor model. Undoing in Document A never mutates Document B.
- **Dynamic Context Refresh**: The `CommandRegistry` evaluates `canUndo` and `canRedo` dynamically against the active document (`globalEditorCoordinationService.canUndo(activeDoc.id)`). Tab switching instantly reflects the newly active document's history availability without caching stale booleans.

---

## 6. Model Lifecycle & Stale Operation Protection

1. **Model Disposal**: When a document tab is closed or unmounted, `globalEditorCoordinationService.unregisterEditorInstance(instanceId)` saves view state and removes the adapter reference.
2. **Stale Operation Rejection**: If an undo/redo command or late async callback targets a closed or unmounted document ID, the service safely rejects the operation and returns `false`, preventing memory corruption or cross-document mutation.
3. **Fresh History on Reopen**: Reopening a previously closed document creates a fresh editor model instance with empty history (`undoDepth = 0`), preventing phantom edits from past editing sessions.

---

## 7. External Synchronization & History Invalidation

Step 38 introduced external filesystem watching. Step 39 hardens its interaction with undo/redo:

### Scenario 1: Clean Document External Reload
When an unmodified document is reloaded due to an external file change on disk:
- `ResourceSynchronizationService` applies the new disk content to `DocumentEngine`.
- `globalEditorCoordinationService.clearHistory(doc.id)` reconfigures the CodeMirror `historyCompartment`, resetting native history depth to $0$.
- `globalDocumentHistoryService.clear(doc.id)` clears application history entries.
- **Guarantee**: Stale pre-reload undo operations cannot be executed to corrupt or revert externally loaded content.

### Scenario 2: Dirty Document External Conflict
When an externally modified file has local unsaved edits in the editor:
- `DocumentEngine` marks `hasConflict = true`.
- The local buffer content and local undo history remain completely protected in memory.
- The user can continue local editing or undo local edits normally.

---

## 8. Command System & Accessibility Integration

- **Centralized Commands**: `editor.undo` (`Mod+Z`, alias `edit.undo`) and `editor.redo` (`Mod+Y`, alias `edit.redo`) are centrally registered in `defaultCommands.ts`.
- **Authoritative Enablement**: `canExecute` derives directly from `globalEditorCoordinationService.canUndo / canRedo`.
- **Universal Access**: Keyboard shortcuts, the Command Palette, menus, and context menus execute through the same authoritative command boundary.
- **Read-Only Enforcement**: Read-only documents strictly return `canExecute: false` and reject undo/redo at the coordination service boundary.
