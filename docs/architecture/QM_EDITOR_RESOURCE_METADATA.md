# QM Editor — Persistent Resource State & Lifecycle Architecture
**Phase 05 — Data & Storage Architecture | Step 48 of 135**

---

## 1. Schema Overview

- **Schema ID:** `qm.resource.state`
- **Current Version:** `1`
- **Scope:** `workspace`
- **Key Pattern:** `ws:${workspaceId}:res:${encodeURIComponent(resourceUri)}`
- **Governance:** Managed and validated by `SchemaRegistry`.

---

## 2. Resource State DTO Specification (`ResourceStateDTO`)

```typescript
export interface ResourceStateDTO {
  /**
   * Version of the resource state DTO schema (currently 1).
   */
  readonly version: number;

  /**
   * Canonical normalized URI of the backing resource.
   */
  readonly resourceUri: string;

  /**
   * Containing workspace context identifier.
   */
  readonly workspaceId: string;

  /**
   * Human-readable file or resource basename (e.g. 'index.ts').
   */
  readonly basename: string;

  /**
   * URI scheme of the resource ('file', 'browser-fs', 'virtual').
   */
  readonly scheme: string;

  /**
   * Whether the resource existed on the backing filesystem at last check.
   */
  readonly exists: boolean;

  /**
   * Last observed modification timestamp on the filesystem.
   */
  readonly lastKnownModifiedTime?: number;

  /**
   * Last observed file size on the filesystem in bytes.
   */
  readonly lastKnownSize?: number;

  /**
   * Epoch timestamp when the resource state was last checked or reconciled.
   */
  readonly lastCheckedAt: number;
}
```

---

## 3. Filesystem Authority Invariant

The backing filesystem remains the ground truth for resource existence and metadata:
- Persisted resource state reflects the application's *last confirmed observation*, **not permission to override filesystem reality**.
- If a stored record claims `exists: true`, but the filesystem reports the file is missing upon access, the live `DocumentRecord` is immediately marked `missingResource: true` and the user is alerted to the external change.
- Stored resource records are updated when `document.externalChanged` events arrive from the filesystem watcher (`globalFileSystemWatcherService`).

---

## 4. Resource Lifecycle Events & State Transitions

1. **Open:** When a resource is opened, `ResourceStateDTO` is written with `exists: true` and current file stats.
2. **Save:** Upon confirmed save, `lastKnownModifiedTime` and `lastKnownSize` are refreshed.
3. **Save As / Rename:** Old resource state is deleted (preventing stale orphaned references); new resource state is persisted under the target URI.
4. **External Delete:** `exists` is marked `false`. Identity and diagnostic metadata are retained until workspace cleanup.
5. **Recreation:** When a previously deleted file is recreated on disk, `exists` is updated to `true`, and file stats are refreshed from the filesystem.
