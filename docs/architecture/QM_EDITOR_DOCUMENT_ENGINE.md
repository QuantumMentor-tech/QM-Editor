# QM Editor — Core Document Engine Architecture
**Phase 04, Step 36: Core Application Engine Subsystem**

## 1. Subsystem Overview

The **Document Engine** (`src/core/documents/DocumentEngine.ts`) is the single authoritative coordination layer for the lifecycle of an open document resource inside QM Editor. It sits between the Workspace Context Engine, the visual Editor Surface, and physical storage services:

```text
                 WORKSPACE ENGINE
                        │
                        ▼
                 DOCUMENT ENGINE (`globalDocumentEngine`)
                        │
        ┌───────────────┼────────────────┐
        │               │                │
   Document Model   Resource State   Lifecycle
        │               │                │
        └───────────────┼────────────────┘
                        │
             ┌──────────┼───────────┐
             ▼          ▼           ▼
        Editor View   File I/O   Search / Git / Watchers
             │
             ▼
        Editor Buffer
```

The Document Engine guarantees:
- **Canonical Identity:** Disconnects display titles from underlying document and resource identifiers.
- **Duplicate Open Prevention:** Opening a file from Explorer, Quick Open, Search, Command Palette, or Recent Files resolves to the same active document instance.
- **Revision Safety:** Monotonic `contentRevision` tracking prevents save races from dropping unsaved typing bursts.
- **Conflict Awareness:** Detects external modifications without silently overwriting local unsaved edits or disk files.
- **Resource Reassignment:** Clean transition of untitled documents to disk files and support for Save As workflows.

---

## 2. Document vs Resource Identity

QM Editor enforces a strict architectural distinction between:

### Resource
The external storage entity. Represented by `NormalizedResource` with canonical normalized URI (`file:///C:/path/file.ts`, `browser-fs://file.ts`, or `untitled:1`).
- `scheme`: `'file' | 'browser-fs' | 'untitled' | 'virtual'`
- `uri`: Platform-normalized canonical URI.
- `name`: Resource basename.
- `extension`: Lowercase extension without dot.
- `exists`: Whether the file exists on storage.
- `readOnly`: Whether storage marks it read-only.
- `handle`: File System Access API handle when available.

### Document
The active in-memory representation (`DocumentRecord`).
- `id`: Stable runtime identifier (`doc-1728...-abcde`).
- `resourceUri`: Canonical URI of the bound resource.
- `content`: Authoritative in-memory text buffer.
- `contentRevision`: Monotonically increasing edit counter.
- `savedRevision`: Revision corresponding to confirmed storage state.
- `lifecycleState`: `'created' | 'loading' | 'ready' | 'saving' | 'saveFailed' | 'closing' | 'closed' | 'error'`.
- `contentState`: `'clean' | 'dirty' | 'saving' | 'saveFailed'`.

---

## 3. Duplicate Open Prevention

The central `DocumentRegistry` manages bi-directional mappings:
- `documentId -> DocumentRecord`
- `resourceUri -> documentId`

When opening resources through `openResource(uri)` or `openFileResource(handle)`:
1. Normalizes target path to canonical resource URI via `normalizeResourceUri(path)`.
2. Checks if `registry.getByResource(normalizedUri)` exists.
3. If present: Activates the existing document tab and returns `{ document, alreadyOpen: true }`.
4. If not present: Reads storage or seeds buffer, registers record, and emits `document.opened`.

---

## 4. Revision-Safe Save & Race Protection

Saving operations enforce revision invariants:
```text
Document Revision 10
      ↓
Save begins (persistingRevision = 10)
      ↓
User types edit → Document Revision 11 (isDirty = true)
      ↓
Save of Revision 10 finishes
      ↓
Check: current contentRevision (11) !== persisted savedRevision (10)
      ↓
DOCUMENT REMAINS DIRTY (Revision Race Safe)
```

The document's dirty flag is **NEVER** set to `false` blindly upon write completion. It evaluates:
$$\text{isDirty} = (\text{contentRevision} \neq \text{savedRevision})$$

---

## 5. External Filesystem Changes & Conflict Invariants

The Document Engine consumes normalized filesystem watcher events:
- **Clean Document + Disk Modified:** Safely auto-reloads buffer from disk, increments revision, preserves clean state (`isDirty = false`).
- **Dirty Document + Disk Modified (CONFLICT):** The engine **NEVER** overwrites unsaved editor content. It sets `hasConflict = true`, emits `document.conflictDetected`, and requests explicit user resolution (`keep_local` or `revert_disk`).
- **External Deletion:** The resource is marked `exists = false`, `missingResource = true`, but the document buffer is preserved so unsaved edits are never lost.

---

## 6. Canonical Document Events

The Document Engine publishes strongly typed events across the application:
- `document.created`: Untitled or initial document spawned.
- `document.opening`: Loading begins.
- `document.opened`: Document ready in registry.
- `document.changed`: Buffer content modified by user or transaction.
- `document.dirtyChanged`: Dirty state toggled.
- `document.saving`: Physical write stream initiated.
- `document.saved`: Storage write confirmed.
- `document.saveFailed`: Write failed, buffer preserved.
- `document.externalChanged`: Watcher detected disk change.
- `document.conflictDetected`: Simultaneous disk and memory edits.
- `document.resourceChanged`: Save As or rename changed resource binding.
- `document.readOnlyChanged`: Permission or capability altered.
- `document.closing`: Close requested.
- `document.closed`: Removed from registry and resources disposed.
