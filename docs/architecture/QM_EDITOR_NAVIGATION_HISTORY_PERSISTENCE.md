# QM Editor — Navigation History Persistence Architecture

## 1. Overview & Objective

The Navigation History Persistence subsystem provides durable, cross-session continuity for navigation paths in QM Editor. It preserves the user's back and forward location journeys across editor restarts without turning history into an unvalidated script or interfering with live project reality.

The runtime authority remains the **Navigation System** (`NavigationCoordinator`, `NavigationService`). The persistence layer is purely the durable serialization of selected, meaningful location changes.

---

## 2. Persisted Location Model

Locations are represented by lightweight, inert DTOs under schema `qm.navigation.history` (version 1):

```typescript
export interface PersistentNavigationLocationDTO {
  uri: string;
  line: number;
  column: number;
  workspaceId?: string;
  documentId?: string;
  selectionRange?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  timestamp: number;
}

export interface NavigationHistoryDTO {
  workspaceId?: string;
  backStack: PersistentNavigationLocationDTO[];
  forwardStack: PersistentNavigationLocationDTO[];
  currentLocation: PersistentNavigationLocationDTO | null;
  updatedAt: number;
  version: number;
}
```

### Invariants:
- Never persists editor models, DOM elements, or runtime buffer references.
- Coordinates are clamped: `line >= 1`, `column >= 1`.
- Historical locations cannot execute code or commands.

---

## 3. Back/Forward Navigation & Restore Rules

### Runtime Invariants:
1. **Back/Forward Stack:** When restoring:
   - The persisted `backStack` and `forwardStack` are deserialized.
   - Each location is checked against the file system (`fileExists`) and active workspace boundaries.
   - Any missing, inaccessible, or deleted files are dropped silently without crashing the rest of the navigation history.
   - Line numbers are clamped safely to positive integers if the file size has shrunk.
2. **Branching History:** When a user performs a new navigation jump (e.g. Go to Definition, symbol jump), the forward stack is cleared according to standard editor navigation behavior.

---

## 4. Scheduling & Write Coalescing

- **Debounced Writes:** Rapid navigations are debounced (300ms) to coalesce writes.
- **Flush on Shutdown:** `NavigationPersistenceCoordinator.flush()` executes during application runtime shutdown to guarantee durable state persistence.
- **Generational Safety:** Asynchronous restore operations verify the active `workspaceGeneration` to guarantee that late I/O completions from previous workspaces are discarded and cannot contaminate the active workspace.

---

## 5. Resource Renames, Deletions & Workspace Isolation

- **Resource Rename:** When a file is renamed, `handleResourceRenamed(oldUri, newUri)` updates all occurrences across `backStack`, `forwardStack`, and `currentLocation`, then persists immediately.
- **Resource Delete:** When a file is deleted, `handleResourceDeleted(uri)` removes all matching entries from both stacks and nullifies `currentLocation` if it matches the deleted file.
- **Workspace Isolation:** Navigation histories are scoped to `ws:${workspaceId}:navigation_history`. Switching workspaces loads the appropriate workspace navigation history and isolates it from other projects.

---

## 6. Retention & Privacy

- **Bounded History:** Stacks are capped to `50` entries maximum to prevent unbounded storage consumption.
- **Privacy Guarantee:** Persisted navigation entries contain only URIs and numeric coordinates. Document source code, search queries, and undo buffers are never persisted in navigation history records. All data remains local.
