# QM Editor — Index Lifecycle Architecture

## 1. Lifecycle Overview

The Workspace Index transitions through explicit, well-defined lifecycle states:

```text
Uninitialized
    │
    ▼
 Loading  ───────────────► Stale / Invalid / Missing
    │                               │
    ▼ (fresh / validated)           ▼
  Ready ◄─────────────────────  Rebuilding
    │                               ▲
    ├───────► Updating (incremental)│
    │                               │
    ▼                               ▼
 Degraded / Failed ───────────────► Rebuild
    │
    ▼
 Disposed
```

---

## 2. State Descriptions

| Lifecycle State | Description | Consumer Impact |
|---|---|---|
| `uninitialized` | Index coordinator instantiated but not bound to any workspace. | Empty candidate list. |
| `loading` | Persistent index is being deserialized and schema-validated. | UI shows loading indicator if search is triggered. |
| `ready` | Index is validated, fresh, and actively serving Quick Open & Search candidates. | Instant search results (0ms latency). |
| `fresh` | State confirmed to match physical filesystem reality. | Fully reliable candidate set. |
| `stale` | Divergence detected (e.g. sampled files moved or deleted outside editor). | Serves existing candidates while triggering background reconcile. |
| `rebuilding` | Full or partial rescanning of directory handles in progress. | Existing candidates served progressively until new index commits. |
| `partial` | Initial scan of top-level directories complete; deeper subdirectories pending. | Returns candidates discovered so far; clearly marked. |
| `degraded` | Storage read-only or persistent write failed. | Continues in-memory indexing without persistence. |
| `failed` | Catastrophic index build error. | UI falls back to live direct directory scanning. |
| `disposed` | Workspace closed or editor shutting down. | Unsubscribes from watcher; flushes pending writes. |

---

## 3. Generational Safety & Stale Drop

1. **Workspace Generation Guard:**
   - Every indexing operation captures `workspaceGeneration = workspaceEngine.getGeneration()`.
   - Both before and after persistent writes, `workspaceEngine.getGeneration()` is re-verified.
   - If a workspace switch occurred during index building (e.g. user closed Workspace A and opened Workspace B), the result for Workspace A is immediately dropped and cannot corrupt Workspace B.
2. **Index Generation Guard:**
   - Monotonically increasing `indexGeneration` prevents an older async rebuild task from overwriting a newer rebuild result.

---

## 4. Invalidation & Reconciliation

- **Targeted Invalidation:** File deletion or rename mutates only the targeted entry.
- **Full Invalidation:** Triggered when:
  - Schema or format version mismatch.
  - Storage corruption detected.
  - Workspace root changed.
  - Explicit manual cache clearance via `WorkspaceIndexCoordinator.clearIndex()`.
