# QM Editor — Resource Lifecycle & Storage Boundaries
**Phase 04, Step 36: Core Application Engine Subsystem**

## 1. Resource Identity Architecture

Resources represent underlying physical or virtual storage entities accessed by QM Editor. All resources are normalized to platform-independent URIs through `ResourceIdentity.ts`:

- `file:///C:/projects/app/main.ts`: Standard physical filesystem paths.
- `browser-fs://main.ts`: W3C File System Access API handles.
- `untitled:1`: In-memory untitled resources awaiting initial disk binding.
- `virtual://output`: Generated or read-only virtual buffers.

---

## 2. Resource Capabilities & Read-Only Policies

Every resource exposes explicit capabilities:
- `canWrite`: Whether file writes are allowed based on filesystem permissions, handles, or read-only modes.
- `canSaveAs`: Whether resource can be persisted to a new path.
- `canReload`: Whether underlying storage can be refreshed.
- `canClose`: Whether resource can be closed safely.

If a resource is marked read-only, `readOnlyReason` specifies the origin:
- `'filesystem'`: Operating system file attributes mark it non-writable.
- `'permission'`: Browser sandbox denied write permission.
- `'policy'`: Workspace trust or workspace lock prevents modification.
- `'virtual'`: Read-only virtual stream.
- `'userMode'`: Explicit user-triggered lock.

---

## 3. Resource Reassignment (Save As & Rename)

When an untitled document is saved or a file is renamed:
1. Physical storage writes to the new target.
2. The Document Engine updates the document's resource model (`doc.resource`).
3. The registry re-indexes `resourceUri -> documentId` mapping so subsequent lookups resolve instantly.
4. Downstream language intelligence (`LanguageRegistry`) re-evaluates language syntax highlighting if the file extension changed.
5. In-memory history and active document identity (`documentId`) are preserved without reloading the editor tab.

---

## 4. External Modifications & Missing Resource Handling

When underlying storage changes independently:
- **Deletion:** Resource state changes to `exists = false`, `missingResource = true`. The document is not closed; editor contents remain fully editable and can be saved to disk.
- **Reappearance:** If a missing file is recreated on disk, the Document Engine detects presence, updates `exists = true`, and evaluates content differences before reconciling.
