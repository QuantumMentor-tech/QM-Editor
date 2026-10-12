# QM Editor — Workspace & Project Context Engine Architecture
## Phase 04, Step 30 Subsystem Specification

### 1. Executive Summary

The **Workspace & Project Context Engine** (`WorkspaceEngine`) is the authoritative source of truth for the active workspace in QM Editor. Prior to Step 30, individual subsystems (File Explorer, Workspace Search, Quick Open, Git/SCM, Tasks, and Settings) derived or inferred workspace state independently.

Step 30 establishes a centralized, transaction-safe, generation-tracked Workspace Engine residing at:
```text
src/core/workspace/
├── WorkspaceTypes.ts             # WorkspaceModel, WorkspaceRoot, WorkspaceState, Capabilities, Events
├── WorkspaceErrors.ts            # Typed exceptions for traversal, locking, validation, dirty buffers
├── WorkspaceResourceBoundary.ts  # Canonical path normalization, boundary containment, traversal guards
├── WorkspaceEngine.ts            # Authoritative state machine, transition mutex, generation counter
├── WorkspaceTestContainer.ts     # Headless test harness for lifecycle & event verification
└── index.ts                      # Subsystem barrel export
```

---

### 2. Conceptual Hierarchy

```text
Application Runtime (Step 29)
        │
        ▼
Workspace Engine (Step 30)
        │
        ├── Workspace Identity (`id: ws-c__...`, `name: "MyProject"`)
        ├── Workspace Roots (`roots: [ { rootId, uri, name, isAccessible } ]`)
        ├── Resource Boundaries (`isResourceInRoot`, traversal checks)
        ├── Workspace Lifecycle (`none`, `opening`, `ready`, `changing`, `closing`, `closed`, `degraded`)
        ├── Generation Tracking (`generation: 4`, async stale result invalidation)
        ├── Capabilities (`filesystem`, `configuration`, `sourceControl`, `tasks`, `search`)
        └── Canonical Events (`workspace.opening`, `workspace.opened`, `workspace.changed`, etc.)
                │
        ┌───────┼────────┬────────┬────────┬────────┐
        ▼       ▼        ▼        ▼        ▼        ▼
     Explorer Documents Search   Git     Tasks   Settings
```

---

### 3. Core Workspace Model

```typescript
export interface WorkspaceModel {
  id: string;                                // Stable canonical ID
  name: string;                              // Human-friendly display name
  roots: WorkspaceRoot[];                    // Array of authoritative roots
  configuration?: Record<string, unknown>;   // Workspace-specific config
  generation: number;                        // Monotonically increasing generation
  state: WorkspaceState;                     // Current lifecycle state
  capabilities: WorkspaceCapabilities;       // High-level subsystem capabilities
  projectMetadata?: Record<string, unknown>; // Extensible metadata container
  createdAt: number;
  lastActiveAt: number;
}
```

---

### 4. Workspace Identity & Root Normalization

- **Workspace ID**: Generated deterministically from canonical URI representations (e.g. `ws-c__projects_my-app`). It remains stable across restarts and avoids using non-unique display names as keys.
- **Root Normalization**: Backslashes are normalized to forward slashes; Windows drive letter casing is standardized; relative segments (`.` and `..`) are resolved; protocol schemes (`browser-fs://`, `file://`) are preserved.
- **Resource Boundary & Anti-Collision**:
  - `isResourceInRoot(rootUri, resourceUri)` ensures that `C:/project` matches `C:/project/src/index.ts`, but strictly **rejects** similarly-prefixed directories like `C:/project-other` or `C:/project-legacy`.
  - `resolveRelativeResource(rootUri, relPath)` checks for path traversal exploits (`../outside`) and throws `PathTraversalError` when unauthorized boundaries are breached.

---

### 5. Lifecycle State Machine

The Workspace Engine moves through explicit, validated states:
- `none`: No active workspace.
- `opening`: Validating new root and preparing context.
- `ready`: Workspace roots accessible and services initialized.
- `changing`: Transitioning between two workspaces.
- `degraded`: Root drive disconnected or temporarily inaccessible; editor remains functional.
- `closing`: Cleaning up workspace-bound resources and watchers.
- `closed`: Final state after close; previous resources released.
- `failed`: Transition or root validation encountered an unrecoverable error.

#### Transition Locking & Transaction Switch
Transitions (`open`, `switch`, `close`) acquire an internal mutex (`isTransitioning`). Concurrent requests are blocked with `WorkspaceTransitionLockedError`.
When switching from Workspace A to Workspace B:
1. Workspace B's path and availability are verified.
2. If Workspace B is invalid, the transition rolls back cleanly, leaving Workspace A intact in `ready` state.
3. If dirty documents exist, the switch is blocked with `WorkspaceUnsavedChangesError` unless explicitly forced.

---

### 6. Generation Tracking & Async Stale Result Rejection

Every workspace change increments `workspaceGeneration`. Asynchronous subsystems (Search, SCM, Indexing, Tasks) capture `WorkspaceRequestContext`:
```typescript
export interface WorkspaceRequestContext {
  workspaceId: string;
  generation: number;
  rootIds: string[];
}
```
Before committing asynchronous results to application state, services verify:
```typescript
if (!workspaceEngine.isGenerationValid(requestContext.generation)) {
  // Discard stale result safely
  return;
}
```
This guarantees that operations initiated in Workspace A never overwrite or leak into Workspace B.

---

### 7. Canonical Lifecycle Events

| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `workspace.opening` | `{ uri, generation }` | Sent prior to root activation |
| `workspace.opened` | `{ workspaceId, name, roots, generation }` | Sent when workspace is ready |
| `workspace.changeRequested` | `{ fromWorkspaceId, toUri, generation }` | Switch initiation |
| `workspace.changing` | `{ fromWorkspaceId, toWorkspaceId, generation }` | Old services resetting |
| `workspace.changed` | `{ workspaceId, previousWorkspaceId, generation }` | Transition committed |
| `workspace.closeRequested` | `{ workspaceId, generation }` | Close requested |
| `workspace.closing` | `{ workspaceId, generation }` | Services tearing down |
| `workspace.closed` | `{ previousWorkspaceId, generation }` | Workspace closed |
| `workspace.degraded` | `{ workspaceId, reason, generation }` | Root access degraded |
| `workspace.failed` | `{ workspaceId?, error, generation }` | Failure notification |

---

### 8. Subsystem Bindings

1. **Application Runtime**: Hosts `workspaceEngine` as a critical infrastructure service in `ServiceRegistry`.
2. **File Explorer**: Binds root rendering, file activation, and directory enumeration to authoritative engine context.
3. **Workspace Context (Documents)**: Registers dirty buffer checker to protect unsaved work before switches.
4. **Source Control**: Resolves working tree repositories from authoritative roots.
5. **Search & Quick Open**: Bound to authorized workspace boundaries and validates generation tokens to prevent race conditions.
6. **Settings**: Scopes workspace settings to the authoritative `workspaceId`.
