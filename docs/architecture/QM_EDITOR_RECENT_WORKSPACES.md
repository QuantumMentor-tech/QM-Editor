# QM Editor — Recent Workspaces Architecture

## Phase 05 — Data & Storage Architecture (Step 47)

### 1. Overview & Data Model

The recent workspaces subsystem provides durable, bounded tracking of recently opened projects in QM Editor. Recent workspaces are stored in the application-scoped `recent_workspaces` partition through `WorkspaceStateRepository`.

```typescript
export interface RecentWorkspaceDTO {
  path: string;       // Normalized workspace root path/URI
  name: string;       // Display name derived or assigned
  lastOpened: number; // Unix timestamp in milliseconds
}
```

### 2. Deduplication & MRU Ordering Policy

- **Path-Based Deduplication:** Deduplication is strictly performed against normalized canonical paths (`normalizeWorkspacePath(uri)`). Case variants on Windows (`C:/project` vs `c:\project\`) collapse into a single entry.
- **Most Recently Used (MRU) Ordering:** Opening a previously accessed workspace updates its timestamp and moves it to the top of the list (`index 0`). Duplicate entries are never created.
- **Bounded Retention Limit:** History length is strictly bounded (default maximum `10` entries, configurable via `WorkspacePersistenceConfig.maxRecentWorkspaces`). Excess older entries are automatically pruned from storage.

### 3. Missing & Inaccessible Workspaces

- Stored recent entries represent historical user intent. If a physical folder is temporarily unmounted (such as a disconnected network share or external drive), the entry is retained rather than deleted immediately upon startup.
- During interactive reopening, if validation indicates that the root directory is missing or inaccessible, the application presents a graceful degraded-mode notification offering the user an option to remove the stale entry or retry.

### 4. Legacy Migration

Upon initial application startup with Phase 05 active, `WorkspacePersistenceCoordinator.migrateLegacyStorage()` checks for legacy `localStorage` keys (`qm_editor_recent_workspaces_v1`). If detected and Phase 05 repository is empty, legacy entries are converted, validated, committed to `WorkspaceStateRepository`, and old storage keys safely unlinked.
