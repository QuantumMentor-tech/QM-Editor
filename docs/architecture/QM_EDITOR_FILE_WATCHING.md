# QM Editor — File Watching & Observation Architecture

**Phase 04 — Core Application Engine**  
**Step 038 Implementation Architecture & Operational Specifications**

---

## 1. Purpose & System Mission

The **File Watching & Observation System** provides QM Editor with a centralized, revision-safe, non-destructive, and resilient mechanism for detecting filesystem mutations outside the application.

Filesystem watching is critical in modern development workflows where external tools (such as compilers, code generators, linters, formatters, version control systems, and package managers) frequently modify workspace files.

The system enforces the following core guarantees:
1. **Single Watcher Authority**: `FileSystemWatcherService` is the sole application-level authority managing active operating system observation handles. No feature or UI component may independently instantiate OS filesystem watchers.
2. **Duplicate Watcher Prevention**: Watch registrations are deduplicated and reference-counted. Opening documents or browsing folders within an already-watched workspace root reuses the existing watcher handle rather than creating redundant native watchers.
3. **Workspace Boundary Protection**: Every watch request and incoming event is strictly validated against the active workspace boundary. Traversal attempts (`../`) and unauthorized external paths are rejected.
4. **Adapter Abstraction**: A strict interface boundary (`FileWatchAdapter`) separates core business logic from OS-level observation implementations.
5. **Generational Stale Event Isolation**: Events tied to older workspace generations (`generation < currentGeneration`) are discarded before reaching synchronization logic.
6. **Internal Save Correlation**: Explicit save tickets correlate QM Editor's own atomic saves to prevent false external echo notifications.
7. **Privacy & Content Safety**: File contents and sensitive paths are never logged or transmitted to telemetry.

---

## 2. Architecture & Pipeline

```text
                     Operating System Filesystem
                                  │
                                  ▼
                        FileWatchAdapter
             (e.g., VirtualWatchAdapter / Native Host)
                                  │ RawFileSystemEvent
                                  ▼
                      FileSystemWatcherService
               - Active Root Registry & Ref-Counting
               - Workspace Boundary Validation
               - Health & Degraded Mode Reporting
                                  │
                                  ▼
                            EventCoalescer
               - Exclusion Filtering (.git, node_modules, dist)
               - Debounce Window (Default: 50ms)
               - State Folding (create + delete, etc.)
                                  │ CoalescedFileSystemEvent
                                  ▼
                    ResourceSynchronizationService
               - SaveCorrelationManager Verification
               - Stale Generation Guard
               - Change Classification
                                  │
               ┌──────────────────┼──────────────────┐
               ▼                  ▼                  ▼
        Document Engine     File Explorer    Workspace Index
     (Clean reload/Conflict)  (UI Refresh)     (Invalidation)
               │
               ▼
      Editor Coordination
    (View-state restoration)
```

---

## 3. Watcher Abstraction (`FileWatchAdapter`)

The subsystem decouples the editor core from platform-specific APIs via the `FileWatchAdapter` interface:

```typescript
export interface WatchHandle {
  id: string;
  rootUri: string;
  recursive: boolean;
  stop: () => Promise<void>;
}

export interface FileWatchAdapter {
  readonly name: string;
  isAvailable(): boolean;
  watch(
    rootUri: string,
    onEvent: (event: RawFileSystemEvent) => void,
    options?: WatcherSubscriptionOptions
  ): Promise<WatchHandle>;
  dispose(): Promise<void>;
}
```

- **`VirtualWatchAdapter`**: Production-ready reference adapter for testing, in-memory simulations, and polyfilled web environments.
- **Pluggability**: Desktop hosts (Electron/Tauri/Node) provide native adapters conforming to `FileWatchAdapter` without altering higher-level synchronization or document behavior.

---

## 4. Lifecycle & Workspace Ownership

Filesystem watchers are strictly workspace-owned:
- **Workspace Open**: Watcher roots are initiated only after the workspace transition completes successfully and a valid primary root exists.
- **Workspace Switching / Closing**: When `globalWorkspaceEngine` emits `workspace.closed` or `workspace.changed`, `FileSystemWatcherService` immediately purges subscriptions tied to the previous workspace generation, stopping root handles.
- **Disposal**: Upon application shutdown or service disposal, all handles and coalescing timers are released.

---

## 5. Normalized Event Model & Deduplication

### 5.1 Normalized Events
Low-level operating system events are normalized into `RawFileSystemEvent` and `CoalescedFileSystemEvent`:
- `uri`: Canonical, normalized resource URI.
- `type`: `'create' | 'modify' | 'delete' | 'rename'`.
- `oldUri`: Original URI for rename operations.
- `timestamp`: Event creation time.
- `workspaceGeneration`: The workspace generation active when the event occurred.

### 5.2 Event Coalescing Strategy
Operating systems often emit multiple events for a single user action (e.g., write followed by metadata change). The `EventCoalescer` applies temporal and state folding:
- **Debounce Window**: Default 50ms window aggregates rapid bursts.
- **State Folding**:
  - `create` + `modify` $\rightarrow$ `create`
  - `create` + `delete` $\rightarrow$ absorbed (cancelled)
  - `delete` + `create` $\rightarrow$ `modify`
  - `modify` + `modify` $\rightarrow$ `modify`
- **Exclusion Rules**: Ignores noisy directories (`.git`, `node_modules`, `dist`, `.cache`, `out`).

---

## 6. Duplicate Watcher Prevention

The `FileSystemWatcherService` maintains an active root registry:
```typescript
private activeWatcherRoots = new Map<
  string,
  { handle: WatchHandle; refCount: number; recursive: boolean }
>();
```

- When `watch(targetUri, ...)` is called:
  - If an existing active root covers `targetUri` (either exact match or parent folder with `recursive: true`), the existing handle is reused and its reference count is incremented.
  - A new native watcher handle is allocated only when no covering root exists.
- When `unwatch()` is invoked:
  - The reference count is decremented.
  - The underlying native watcher handle is stopped only when the reference count reaches zero.

---

## 7. Workspace Boundary Validation

To prevent path traversal and unauthorized filesystem access:
1. All URIs are normalized using `normalizeWorkspacePath()`.
2. Paths containing traversal elements (`../`, `..\\`) are resolved canonically.
3. Every watch subscription is verified against `globalWorkspaceEngine.getPrimaryRoot()`.
4. If a requested path lies outside the primary workspace root and `enforceWorkspaceBoundary` is enabled, `WorkspaceBoundaryViolationError` is thrown.
5. In synchronization workflows, events referencing paths outside the workspace boundary are classified as `ignored_path`.

---

## 8. Internal Save Correlation

When QM Editor performs an internal file save, it notifies `SaveCorrelationManager`:
```typescript
const operationId = saveCorrelationManager.registerSave(resourceUri, {
  expectedRevision,
  ttlMs: 1500,
});
```
- When subsequent OS filesystem change notifications arrive for `resourceUri`, `SaveCorrelationManager` correlates the event with the in-flight save ticket.
- Correlated events are classified as `internal_save` and consumed.
- This prevents false external modify alerts, avoiding unnecessary reloads and false conflict states.
- Tickets automatically expire after TTL to ensure real external changes are not suppressed.

---

## 9. Error Handling & Degraded Mode

- **Adapter Failure**: If an adapter fails to initialize or encounters a native failure, `FileSystemWatcherService` records the failure and transitions to `status: 'degraded'`.
- **Health Reporting**: `service.getHealth()` returns:
  ```typescript
  export interface WatcherHealthReport {
    status: 'healthy' | 'degraded' | 'disabled' | 'error';
    activeWatchersCount: number;
    activeSubscriptionsCount: number;
    adapterName: string;
    lastError?: string;
    uptimeMs?: number;
  }
  ```
- **Application Resilience**: Degraded watcher state never halts editing, manual saving, or navigation. Manual file refresh remains available.

---

## 10. Security & Privacy

1. **Zero Content Telemetry**: File contents are never captured in watcher logs or transmitted to external endpoints.
2. **Safe Logging**: Only metadata (`documentId`, `resourceUri`, `changeType`, `revision`) is recorded in application logs.
3. **Local Isolation**: All observation and synchronization logic runs strictly within the local host environment.
