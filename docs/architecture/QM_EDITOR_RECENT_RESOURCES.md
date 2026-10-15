# QM Editor — Recent Resources Architecture

## 1. Overview & Objective

The Recent Resources subsystem in QM Editor provides durable tracking of accessed resources (files and folders) across restarts. It powers UI surfaces such as Quick Open (`Ctrl+P`) and the Start Center without turning activity history into an unlimited database or coupling storage directly to UI components.

Recent resources represent **historical access metadata** and must never be confused with:
- **Open Session Resources:** Tabs currently restored across workspace restarts.
- **Navigation Locations:** Specific cursor/range positions within resources.
- **Local History / Content Snapshots:** Historical file versioning (strictly out of scope).

---

## 2. Resource Identity Model

Recent resources use canonical resource identity:
- **Workspace-Scoped Resources:** Identified by `workspaceId` + `canonical URI` / `resourceId`.
- **Application-Wide Resources:** Identified by normalized file/folder `URI`.
- Multiple workspaces containing identically named files (e.g. `src/index.ts`) remain isolated through workspace partitioning.

---

## 3. Data Transfer Object (DTO) Schema

Persisted under the schema `qm.navigation.recent` (version 1):

```typescript
export interface RecentResourceDTO {
  uri: string;
  name: string;
  workspaceId?: string;
  lastOpened: number; // UTC millisecond timestamp
  kind?: 'file' | 'folder';
  accessCount?: number;
}
```

### Invariants:
- Never stores source code, ASTs, selections, or DOM state.
- Inert data only; cannot execute scripts or commands.
- Local storage only; no network transmission or telemetry.

---

## 4. Ordering & Deduplication

- **Deduplication:** Accessing the same resource repeatedly updates `lastOpened` to the current timestamp and increments `accessCount`. It never generates multiple entries for the same URI within the same scope.
- **Deterministic Ordering:** Entries are ranked primarily by `lastOpened` descending (Most Recently Used). Ties are broken deterministically by alphabetical order of URI.

---

## 5. Retention & History Limits

- **Bounded Retention:** Recent documents list is capped by default to `MAX_RECENT_DOCUMENTS = 20` (configurable via settings).
- **Eviction:** When a new resource is accessed and the capacity is exceeded, the oldest entry (`lastOpened` minimum) is trimmed.
- **Storage:** Persisted under record keys:
  - Global: `app:recent_resources`
  - Workspace: `ws:${workspaceId}:recent_resources`

---

## 6. Workspace Scoping vs. Global Scoping

1. **Global Recent Resources:** Maintained across all workspaces for global discovery (e.g. Start Center welcome screen).
2. **Workspace-Scoped Recent Resources:** Partitioned by active `workspaceId` so project-specific files remain isolated when switching projects.
3. Accessing a resource in a workspace updates both the workspace-specific history and the global MRU list.

---

## 7. Lifecycle & Failure Handling

- **Dual-Layer Architecture:**
  - Fast in-memory synchronous cache for smooth 60fps UI rendering.
  - Asynchronous persistence via `RecentResourceRepository` and `StorageService`.
- **Resource Renames:** Renaming a file updates its URI and title in both in-memory cache and persistent storage via `updateResourceUri(oldUri, newUri)`.
- **Resource Deletions:** Deleting a file removes its entries via `removeRecentDocument(uri)`.
- **Storage Read-Only Mode:** If storage enters read-only mode or encounters errors, the in-memory cache remains completely functional; no crashes occur.
- **Legacy Migration:** Automatically imports legacy `localStorage` entries (`qm_recent_documents`) on first initialization with a persistent repository.
