# QM Editor — External Resource Synchronization & Change Reconciliation

**Phase 04 — Core Application Engine**  
**Step 038 Implementation Architecture & Operational Specifications**

---

## 1. Overview & System Mission

The **Resource Synchronization Service** (`ResourceSynchronizationService`) coordinates external filesystem events with QM Editor's core subsystems:
- **Document Engine** (`DocumentEngine`)
- **Editor Engine Coordination Layer** (`EditorCoordinationService`)
- **File Explorer**
- **Workspace Search & Indexing** (`workspaceIndexService`)
- **Feedback & Notification Service** (`globalFeedbackService`)

Its primary invariant is:
> **External filesystem activity may inform QM Editor about changes, but it must never silently destroy authoritative in-memory user work.**

---

## 2. Change Classification State Model

Incoming coalesced filesystem events are evaluated against active application state and classified into one of the following states:

| Classification | Condition | Synchronization Action |
| :--- | :--- | :--- |
| `internal_save` | Event matches active `SaveCorrelationManager` ticket | Consumes ticket; ignores external notification. |
| `ignored_path` | Event violates workspace boundary or matches older generation | Discards event with diagnostic log. |
| `unopened_resource` | Target file is not currently open in `DocumentEngine` | Invalidates workspace index cache; emits explorer refresh event. |
| `clean_document_reload` | Target file is open, `isDirty === false`, content changed on disk | Automatically reloads disk content into document, increments revision, preserves editor view state. |
| `dirty_document_conflict` | Target file is open, `isDirty === true`, content changed on disk | **NEVER overwrites local edits**. Sets `hasConflict: true`, surfaces feedback warning. |
| `external_delete` | Backing file was deleted on disk | Marks `missingResource: true` and `exists: false`. Preserves local edits in memory. |
| `external_rename` | Backing file was renamed on disk | Updates resource URI and file title while preserving document identity. |
| `external_recreate` | File previously marked missing was recreated on disk | Clears `missingResource` flag and restores `exists: true`. |

---

## 3. Clean vs. Dirty Document Handling

### 3.1 Clean Document Synchronization (`clean_document_reload`)
When an external process updates a file that the user has open with no unsaved changes:
1. `ResourceSynchronizationService` captures the editor view state (cursor position, scroll offsets, selection) via `globalEditorCoordinationService.saveViewStateForInstance()`.
2. The latest file content is fetched via `fileService.readFile()` or provided disk payload.
3. `globalDocumentEngine.reconcileExternalChange(documentId, 'modify', { newContent })` updates the document buffer:
   - Increments `contentRevision` and updates `savedRevision`.
   - Re-detects line endings and updates file size metadata.
   - Preserves document identity and active tab state.
4. `globalEditorCoordinationService.restoreViewStateForInstance()` clamps and restores the cursor and scroll position so the user experiences zero visual jumping.
5. Domain event `synchronization.documentReloaded` is emitted.

### 3.2 Dirty Document Conflict Protection (`dirty_document_conflict`)
When an external process modifies a file that has unsaved user edits in the editor:
1. **Zero Overwrite Rule**: The in-memory buffer is **NEVER** modified or overwritten with disk content.
2. `globalDocumentEngine.reconcileExternalChange(documentId, 'modify')` transitions document metadata:
   - `metadata.hasConflict = true`
   - `metadata.externallyModified = true`
3. `globalFeedbackService.showWarning` displays a non-intrusive alert informing the user that disk content has diverged from editor edits.
4. Emits `synchronization.conflictDetected` containing local revision and conflict reason.
5. The document remains dirty, allowing the user to continue typing or choose resolution.

---

## 4. Deletion, Rename & Recreation Workflows

### 4.1 External Deletion (`external_delete`)
- If a file is deleted on disk by an external process or git command, the document is **not** closed automatically.
- Closing the document would discard unsaved edits or surprise the user.
- The document resource is marked as `exists = false` and `metadata.missingResource = true`.
- Emits `synchronization.resourceDeleted`.

### 4.2 External Rename (`external_rename`)
- When a file is renamed externally and rename detection provides both `oldUri` and `newUri`:
- `DocumentEngine` reassigns the backing resource URI using `registry.reassignResource()` and updates the tab title.
- The `documentId` remains stable, preserving open editor instances, undo/redo history, and view state.
- Emits `synchronization.resourceRenamed`.

### 4.3 External Recreation (`external_recreate`)
- If a file previously marked as missing is recreated on disk, the document's resource status is restored (`exists = true`, `missingResource = false`).
- Emits `synchronization.resourceRecreated`.

---

## 5. Conflict Resolution Semantics

When a conflict is present, `ResourceSynchronizationService.resolveConflict()` or `globalDocumentEngine.resolveConflict()` supports two fundamental resolutions:

1. **`keep_local`**:
   - Clears `hasConflict` and `externallyModified` flags.
   - Retains current in-memory edits.
   - Next save will overwrite disk with local content.
2. **`revert_disk`**:
   - Reads disk content via `fileService` or uses supplied disk payload.
   - Overwrites document buffer with disk content.
   - Resets `isDirty` to `false` and increments `contentRevision`.
   - Clears conflict flags.

---

## 6. Synchronization Order & Execution Flow

To ensure deterministic state transitions and prevent race conditions:

```text
Filesystem Event
       │
       ▼
1. Normalize URI & Workspace Boundary Check
       │
       ▼
2. Generational Check (Discard stale generations)
       │
       ▼
3. Internal Save Correlation (Discard self-echoes)
       │
       ▼
4. Change Classification
       │
       ▼
5. State Reconciliation via DocumentEngine
       │
       ▼
6. View-State Clamping & Restoration
       │
       ▼
7. Central Domain Event Dispatch (synchronization.*)
       │
       ▼
8. Dependent Consumer Refresh (Explorer, Search Index)
```

---

## 7. Future Conflict-Resolution Boundary

Step 038 establishes the **observation and synchronization foundation**.
It intentionally defers:
- Three-way visual merge editors (Base vs Local vs Remote).
- Automatic AST-level merge drivers.
- Remote repository synchronization.

These capabilities will build directly on `ClassifiedResourceChange` and `DocumentEngine.resolveConflict()` in future steps without modifying watcher plumbing.
