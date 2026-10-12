# QM EDITOR — CORE APPLICATION RUNTIME ARCHITECTURE

**Version:** 4.0.0 (Phase 04, Step 29)  
**Status:** Approved Architectural Standard  
**Last Updated:** October 12, 2026  

---

## 1. Architectural Mission & Philosophy

The **QM Editor Application Runtime** is the central orchestration engine of the application. While Phase 03 established the visual presentation, UI primitives, and design system, Phase 04 establishes the **engine room**: coordinating subsystem initialization, deterministic dependency ordering, health monitoring, graceful shutdown, workspace lifecycle transitions, and fault isolation.

### Core Principles
1. **Separation of Orchestration and Domain Logic:** The runtime coordinates services, resolves dependencies, and manages lifecycle transitions. It does not absorb domain logic (e.g. document text models, file parsing, or git diffs).
2. **Explicit Readiness:** No service is considered ready merely because its JavaScript object or class instance exists. Readiness is published through an explicit lifecycle contract.
3. **Fault Isolation:** An optional subsystem failure (such as Git or Terminal backend unavailability) must never prevent the core code editor from starting and functioning.
4. **Deterministic Dependency Ordering:** Services declare prerequisites explicitly. Topological sorting ensures safe initialization, while reverse topological sorting guarantees safe disposal.
5. **Generational Workspace Isolation:** Workspace-scoped operations validate against an atomic `workspaceGeneration` token to guarantee that stale asynchronous results from a previous workspace cannot overwrite the active workspace.
6. **Zero Arbitrary Execution:** Service registration is strictly internal and application-controlled. Workspace configuration and files cannot dynamically inject runtime services.

---

## 2. Runtime Architecture & Subsystems

```text
                             APPLICATION RUNTIME
                                      │
         ┌──────────────────┬─────────┴─────────┬──────────────────┐
         │                  │                   │                  │
    Lifecycle            Service             Runtime            Shutdown
     Manager            Registry             Health           Coordinator
         │                  │                   │                  │
   State Machine     Typed Lookup        Health Reports       Reverse Order
  Start & Rollback   Scope Partition     Degraded Reasons     Safe Timeouts
         │                  │                   │                  │
         └──────────────────┼───────────────────┴──────────────────┘
                            │
                   Dependency Resolver
                   (Topological Sort & Cycle Detection)
                            │
         ┌──────────────────┼───────────────────┐
         │                  │                   │
   Core Services     Workspace Services   Optional Services
   • Settings        • Workspace Search   • Terminal
   • Command         • Workspace Index    • Tasks
   • Feedback        • Source Control     • Git Diff
   • File & Session
```

### 2.1 Component Breakdown
- **`ApplicationRuntime` (`src/core/runtime/ApplicationRuntime.ts`):** Top-level facade coordinating all runtime subsystems, workspace lifecycles, and context snapshots.
- **`ServiceRegistry` (`src/core/runtime/ServiceRegistry.ts`):** Central metadata repository managing service records, scopes, and typed lookup (`getService`, `tryGetService`).
- **`DependencyResolver` (`src/core/runtime/DependencyResolver.ts`):** Deterministic Kahn's algorithm and DFS cycle detector resolving initialization and shutdown sequences.
- **`LifecycleManager` (`src/core/runtime/LifecycleManager.ts`):** Executes multi-phase startup, isolates optional service failures, and triggers reverse rollback upon critical failure.
- **`ShutdownCoordinator` (`src/core/runtime/ShutdownCoordinator.ts`):** Disposes services in reverse dependency order with configurable timeouts to prevent hanging background processes.
- **`RuntimeHealth` (`src/core/runtime/RuntimeHealth.ts`):** Aggregates point-in-time operational health reports (`healthy`, `degraded`, `unavailable`, `failed`).
- **`RuntimeEvents` (`src/core/runtime/RuntimeEvents.ts`):** Application-level lifecycle event bus with subscriber failure isolation and disposable handles.

---

## 3. Application Lifecycle State Machine

```text
[created] ──> [initializing] ──┬──> [ready] ────┬──> [shuttingDown] ──> [terminated]
                     │         │                │
                     │         └──> [degraded] ─┘
                     │                     ▲
                     └──(Critical Fail)────┴──> [terminated] (Rollback)
```

| Lifecycle State | Description |
| :--- | :--- |
| **`created`** | Runtime constructed; services registered; awaiting `start()`. |
| **`initializing`** | Dependency graph validated; services initializing in topological order. |
| **`ready`** | All critical and optional services initialized cleanly. |
| **`degraded`** | Critical services initialized, but one or more optional services failed or reported degradation. Core editor remains 100% operational. |
| **`shuttingDown`** | Shutdown requested; tasks cancelled, terminal processes terminated, and services disposing in reverse order. |
| **`terminated`** | All resources released, event listeners cleared, and runtime stopped. |

---

## 4. Application vs. Workspace Lifecycle Separation

QM Editor enforces strict separation between application life and workspace life:

| Dimension | Application Lifecycle | Workspace Lifecycle |
| :--- | :--- | :--- |
| **Scope** | Global process lifetime (`start`, `ready`, `shutdown`). | Project directory lifetime (`open`, `change`, `close`). |
| **Persistence** | Global settings, session metadata, command registry. | Workspace settings, working tree git status, index cache. |
| **Services Affected**| Application-scoped services (`settings`, `command`, `feedback`, `terminal`, `tasks`). | Workspace-scoped services (`workspaceSearch`, `workspaceIndex`, `sourceControl`). |
| **Trigger** | Window load, application launch, window close. | Open Folder, Close Workspace, Recent Workspace switch. |

### Generational Protection
When a workspace is opened or closed, the runtime atomically increments `workspaceGeneration`:
```typescript
const newGeneration = ++this.workspaceGeneration;
```
Asynchronous operations (such as workspace directory scanning or git status inspection) capture the current generation ID and must verify `runtime.isCurrentGeneration(requestGeneration)` before applying state. Stale responses are discarded without mutating current state.

---

## 5. Startup Sequencing & Rollback Guarantees

Startup executes in strict topological dependency order:
1. **Dependency Resolution:** `DependencyResolver.assertValid(servicesMap)` verifies that all prerequisites exist and no dependency cycles exist.
2. **Phase 1: Infrastructure & Core Settings:** `settings`, `feedback`, `command`, `file` initialize first.
3. **Phase 2: Domain Services:** `session`, `workspace`, `search` initialize.
4. **Phase 3: Optional Subsystems:** `terminal`, `tasks`, `sourceControl`, `workspaceSearch`, `workspaceIndex` initialize.

### Rollback on Critical Failure
If a service marked `criticality: 'critical'` throws during startup:
1. Further initialization halts immediately.
2. The runtime iterates over all previously initialized services in **reverse order** and executes their `dispose()` hooks.
3. The runtime state transitions to `terminated`.
4. A structured `ServiceInitializationError` is thrown, preventing the application from entering a false "ready" state.

### Optional Service Isolation
If a service marked `criticality: 'optional'` throws during startup:
1. The exception is caught and logged.
2. The service's state is set to `'failed'`.
3. The runtime emits `'service.failed'` and `'application.degraded'`.
4. The application state transitions to `'degraded'` upon completion, allowing the user to continue coding without interruption.

---

## 6. Shutdown Sequence & Process Cleanup

When `runtime.shutdown({ timeoutMs })` is invoked:
1. The runtime emits `'application.shutdownRequested'`.
2. Running tasks in `TaskService` are sent cancellation signals.
3. Running terminal sessions in `TerminalService` are terminated via PTY disposal.
4. Services are disposed in **reverse topological dependency order**.
5. Timeout Protection: If a hanging background service does not finish within `timeoutMs` (default: 5000ms), the coordinator forces completion, logs diagnostic warnings, and transitions to `terminated`.
6. The runtime emits `'application.shutdown'`.

---

## 7. Security, Privacy & Integrity

1. **Local-Only Infrastructure:** No remote services, network registries, or external telemetries are required or contacted.
2. **Untrusted Workspace Isolation:** Workspace files cannot dynamically register or inject executable services.
3. **Data Sanitization:** Runtime events carry metadata (service IDs, durations, generation IDs, error summaries). Document buffer contents and user passwords are never placed in runtime event payloads.
