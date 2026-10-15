# QM Editor — Bounded User Activity State Architecture

## 1. Overview & Objective

User Activity State in QM Editor defines the durable, bounded representation of user actions across sessions. Its purpose is to maintain helpful continuity (e.g. knowing what files were recently opened, and restoring the user's navigation path) without building an invasive activity log or unlimited historical archive.

---

## 2. Activity Data Classification

### What IS Stored:
1. **Recent Resources:**
   - Resource canonical URI and display name.
   - Resource type (`file` | `folder`).
   - `lastOpened` timestamp (UTC milliseconds).
   - `accessCount` (integer).
   - Associated `workspaceId` (when workspace-scoped).
2. **Navigation History:**
   - Ordered back and forward navigation stack locations.
   - Resource URI, line number, and column number.
   - Timestamp of navigation event.
   - Associated `workspaceId`.

### What is STRICTLY NOT Stored:
- Document source text or partial buffer contents.
- Content diffs, snapshots, or local version history (reserved for future content recovery architectures).
- Keystroke streams, typing cadence, or selection changes during normal editing.
- Unsaved document content (managed separately by workspace session persistence).
- Search query telemetry or source-code activity analytics.
- Cloud tracking or external analytics payloads.

---

## 3. Storage Lifecycles & Retention Limits

| Subsystem | Storage Key Pattern | Schema Version | Default Retention Limit |
|---|---|---|---|
| Recent Documents (Global) | `app:recent_resources` | `qm.navigation.recent` v1 | 20 entries |
| Recent Documents (Workspace) | `ws:${workspaceId}:recent_resources` | `qm.navigation.recent` v1 | 20 entries |
| Navigation History | `ws:${workspaceId}:navigation_history` | `qm.navigation.history` v1 | 50 back / 50 forward |

Oldest entries are evicted automatically when retention limits are reached (FIFO/LRU).

---

## 4. Privacy, Security & Local Execution

1. **Local Confinement:** All activity records are stored strictly in local storage adapters (e.g. IndexedDB or memory adapter). No data is transmitted across networks or sent to telemetry sinks.
2. **Inert Records:** Persisted records represent static data structures. Under no circumstances can a persisted history or recent resource record trigger shell execution, file deletion, or arbitrary command execution.
3. **Stale Location Resiliency:** If a persisted file path no longer exists on disk upon restoration, the entry is dropped or bypassed safely; it never causes crashes or blocks startup.

---

## 5. Clear History Boundaries

The repository boundaries expose explicit clearing mechanisms:
- `RecentResourceRepository.clearRecentResources(workspaceId?)`
- `NavigationHistoryRepository.clearNavigationHistory(workspaceId?)`
- `RecentDocumentsService.clearRecentDocuments()`
- `NavigationPersistenceCoordinator.clearHistory()`

When executed, these operations:
1. Erase persistent records from storage for the specified scope.
2. Reset runtime caches immediately.
3. Preserve active editor tabs, document metadata, and workspace settings.
