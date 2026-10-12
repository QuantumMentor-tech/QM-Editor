# QM EDITOR — SERVICE LIFECYCLE & DEPENDENCY ORCHESTRATION

**Version:** 4.0.0 (Phase 04, Step 29)  
**Status:** Approved Service Contract Specification  
**Last Updated:** October 12, 2026  

---

## 1. Service Definition Contract

All managed services in QM Editor conform to the typed `ServiceDefinition` contract (`src/core/runtime/RuntimeTypes.ts`):

```typescript
export interface ServiceDefinition<T = unknown> {
  id: string;                                                         // Stable internal identifier (e.g. 'settings', 'terminal')
  name: string;                                                       // Human-readable diagnostic label
  dependencies?: string[];                                            // Service IDs required as prerequisites
  scope?: 'application' | 'workspace' | 'session';                   // Lifecycle lifetime boundary
  criticality?: 'critical' | 'optional';                             // Failure impact classification
  instance?: T;                                                       // Eagerly instantiated instance
  factory?: (context: ServiceInitializationContext) => Promise<T> | T;// Lazy factory constructor
  initialize?: (instance: T, context: ServiceInitializationContext) => Promise<void> | void; // Async startup hook
  dispose?: (instance: T) => Promise<void> | void;                   // Teardown / resource release hook
  reset?: (instance: T, context: ServiceInitializationContext) => Promise<void> | void;      // Workspace switch reset hook
}
```

---

## 2. Managed Service Catalog & Scopes

| Service ID | Service Name | Scope | Criticality | Dependencies | Role & Cleanup Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`settings`** | Settings Service | `application` | `critical` | `[]` | Loads configuration; provides defaults to dependents. |
| **`feedback`** | Unified Feedback | `application` | `critical` | `[]` | Manages toasts, dialogs, progress; clears auto-dismiss timers on dispose. |
| **`command`** | Command Registry | `application` | `critical` | `[]` | Dispatches actions; revalidates availability. |
| **`file`** | File Service | `application` | `critical` | `[]` | Native filesystem abstraction with safety guards. |
| **`layout`** | Layout Service | `application` | `critical` | `[]` | Manages panel splitters and density state. |
| **`recentWorkspaces`** | Recent Workspaces | `application` | `critical` | `[]` | Manages bounded workspace MRU history. |
| **`recentDocuments`** | Recent Documents | `application` | `critical` | `[]` | Manages recently opened documents. |
| **`session`** | Session Service | `application` | `critical` | `['settings']` | Coordinates window and tab state persistence. |
| **`workspace`** | Workspace Service | `application` | `critical` | `['file']` | Directory enumeration and workspace folder picker. |
| **`search`** | Search Service | `application` | `critical` | `['settings']` | In-buffer single document search engine. |
| **`terminal`** | Terminal Service | `application` | `optional` | `['settings']` | Manages PTY sessions; terminates all child processes on dispose. |
| **`tasks`** | Tasks Service | `application` | `optional` | `['settings']` | Task runner; cancels running execution sessions on dispose. |
| **`workspaceSearch`** | Workspace Search | `workspace` | `optional` | `['workspace', 'file']` | Full-text workspace scanner; aborts active scan on workspace switch. |
| **`workspaceIndex`** | Workspace Index | `workspace` | `optional` | `['workspace']` | Fast resource metadata index; clears cache on workspace switch. |
| **`sourceControl`** | Source Control (Git) | `workspace` | `optional` | `['workspace']` | Git status watcher; resets repository tree on workspace switch. |

---

## 3. Dependency Graph & Topological Sequencing

The dependency graph is evaluated deterministically at startup using Kahn's algorithm:

```text
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │ settings │      │   file   │      │ command  │
    └────┬─────┘      └────┬─────┘      └──────────┘
         │                 │
    ┌────┴────┬────────────┼─────────────────────────┐
    │         │            │                         │
    ▼         ▼            ▼                         ▼
┌───────┐ ┌────────┐  ┌───────────┐             ┌──────────┐
│session│ │ search │  │ workspace │             │ feedback │
└───────┘ └────────┘  └────┬──────┘             └──────────┘
                           │
                 ┌─────────┼──────────────┐
                 │         │              │
                 ▼         ▼              ▼
       ┌───────────────┐ ┌──────────────┐ ┌───────────────┐
       │workspaceSearch│ │sourceControl │ │workspaceIndex │
       └───────────────┘ └──────────────┘ └───────────────┘
```

Startup Order: Prerequisites initialize strictly before dependents.  
Shutdown Order: Dependents dispose strictly before prerequisites (reverse topological order).

---

## 4. Lifecycle States & Health Semantics

Each service transitions through a predictable state lifecycle:

```text
[uninitialized] ──> [initializing] ──> [ready] ────> [stopping] ──> [disposed]
                          │              │
                          └──(Error)─────┴──> [failed] / [degraded]
```

### Health Categories
- **`healthy`:** Service initialized cleanly and operational.
- **`degraded`:** Service operational with non-fatal limitations.
- **`unavailable`:** Service not yet initialized, unconfigured, or in the process of stopping.
- **`failed`:** Service threw an error during initialization or runtime operations.

---

## 5. Failure Isolation & Fault Tolerance

1. **Critical Failure Policy:** If a `critical` service fails, the runtime aborts startup and rolls back all previously initialized services, protecting against half-initialized state corruption.
2. **Optional Failure Policy:** If an `optional` service fails:
   - The runtime records the error in diagnostics.
   - The runtime marks the service as `failed`.
   - The application transitions to `degraded` health.
   - Core editing and navigation continue without interruption.
3. **Safe Service Restart:**
   The runtime provides `restartService(serviceId)` which disposes the running instance, creates a new instance via factory, runs `initialize()`, and updates health status dynamically without restarting the application window.
