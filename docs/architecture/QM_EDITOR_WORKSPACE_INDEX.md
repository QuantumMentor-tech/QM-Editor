# QM Editor — Workspace Index Architecture

## 1. Overview & Objective

The Workspace Index in QM Editor provides a durable, rebuildable index of workspace files and metadata. Its primary purpose is to eliminate expensive rescanning of the file system upon application restart, delivering instant candidate search and warm Quick Open (`Ctrl+P`) and Workspace Search (`Ctrl+Shift+F`) capabilities.

### The Fundamental Rule:
> **The index exists to make authoritative data faster to discover, not to become authoritative itself.**
> An index may accelerate access to truth, but it must never become the source of truth.

If the persistent index is deleted, corrupted, or missing, QM Editor remains 100% operational and seamlessly rebuilds the index from the authoritative physical filesystem.

---

## 2. Authority Model & Architecture

The architecture enforces strict separation of responsibilities:

```text
Filesystem
      =
actual physical resource authority

Workspace Engine
      =
workspace lifecycle and boundary authority

Document Engine
      =
live in-memory document & revision authority

File Watch Service
      =
filesystem event observation authority

WorkspaceIndexCoordinator
      =
derived index orchestration & reconciliation

WorkspaceIndexService
      =
in-memory candidate provider for UI (60fps)

ResourceIndexRepository / StorageService
      =
durable persistence mechanism
```

---

## 3. Index Entry & Workspace Index Model

Persisted under the schema `qm.workspace.index` (version 1):

```typescript
export interface ResourceIndexEntryDTO {
  readonly resourceId: string;
  readonly workspaceId: string;
  readonly uri: string;
  readonly relativePath: string;
  readonly name: string;
  readonly kind: 'file' | 'directory';
  readonly parentPath: string;
  readonly size?: number;
  readonly modifiedAt?: number;
  readonly fingerprint?: string;
  readonly isBinary?: boolean;
  readonly indexedAt: number;
}

export interface WorkspaceIndexDTO {
  readonly version: number; // schema version 1
  readonly formatVersion: number; // format version 1
  readonly workspaceId: string;
  readonly rootUri: string;
  readonly indexGeneration: number;
  readonly workspaceGeneration: number;
  readonly entries: ResourceIndexEntryDTO[];
  readonly totalFiles: number;
  readonly status: 'fresh' | 'stale' | 'rebuilding' | 'partial';
  readonly indexedAt: number;
}
```

### Invariants:
- Never persists document source code, buffer snippets, ASTs, or secrets.
- Inert data only; cannot execute scripts or commands.
- Local storage only; no network egress or telemetry.

---

## 4. Freshness & Advisory Fingerprints

- **Fingerprint Calculation:** A lightweight advisory fingerprint `computeResourceFingerprint(size, modifiedAt)` -> `"${size}:${modifiedAt}"` allows quick detection of file changes without full content hashing.
- **Freshness States:**
  - `fresh`: All sampled entries match filesystem existence and timestamps.
  - `partiallyFresh`: Index is usable for immediate candidates; background reconciliation runs.
  - `stale`: Significant sample divergence detected; triggers automatic clean rebuild.
  - `invalid`: Schema or format version mismatch.
  - `missing`: No persisted index available.

---

## 5. Storage Isolation & Workspace Partitioning

- **Workspace Scoped Key:** `ws:${workspaceId}:resource_index`
- **Separation from Authoritative Data:** The index is stored strictly separate from settings (`ws:...:settings`), workspace metadata (`ws:...:workspace_metadata`), and document metadata. Index corruption can never corrupt user settings or documents.
- **Workspace Isolation:** An index built for Workspace A will never satisfy queries or commit state into Workspace B.

---

## 6. Incremental Updates & File Watcher Integration

Rather than rescanning the filesystem on every change, `WorkspaceIndexCoordinator` listens to centralized events from `ResourceSynchronizationService`:
- **Create:** Adds resource entry with calculated fingerprint and schedules debounced persist.
- **Delete:** Removes resource entry from in-memory cache and schedules debounced persist.
- **Rename:** Atomically updates path, name, and relative path.
- **Modify:** Refreshes size, modified time, and fingerprint.
- **Write Coalescing:** Updates are debounced by 300ms so burst operations (e.g. build directories, bulk saves) do not cause disk thrashing.
- **Shutdown Flush:** `WorkspaceIndexCoordinator.flush()` commits all pending writes during application shutdown.
