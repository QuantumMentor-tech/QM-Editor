# QM Editor — Filesystem Watchers & External Change Reconciliation Architecture

**Phase 04 — Core Engine, Document Lifecycle, Diagnostics and Application Services**  
**Step 032 Implementation Architecture & Operational Specifications**

---

## 1. Overview & System Mission

The **Filesystem Watcher & External Change Reconciliation Engine** provides QM Editor with resilient, low-latency, and safe observation of external filesystem modifications. In desktop development environments, files and folders may be added, edited, removed, or renamed outside the application by external processes (compilers, git commands, formatters, external text editors, or filesystem tooling).

The subsystem addresses critical synchronization challenges:
1. **Event Floods & Rapid Churn**: Build tools and version control operations generate rapid bursts of filesystem events. The engine debounces and coalesces events to eliminate redundant reloads and UI freezes.
2. **Self-Write Echo Suppression**: When QM Editor saves a document or writes to disk, the operating system triggers a change notification. Without suppression, the editor would misinterpret its own writes as external modifications, triggering redundant reloads or false conflicts.
3. **Buffer Safety & Conflict Invariants**: Dirty documents (containing unsaved user edits) must **NEVER** be overwritten silently. External disk modifications to dirty files are surfaced as non-destructive conflicts.
4. **Workspace Boundary & Generational Protection**: Watchers are scoped to the active workspace. When workspaces switch or close, stale asynchronous notifications from previous workspaces are strictly discarded and subscriptions are disposed.

---

## 2. Architectural Components

```
+-----------------------------------------------------------------------------------+
|                           Operating System / FS Handles                           |
+-----------------------------------------------------------------------------------+
                                          | RawFileSystemEvent
                                          v
+-----------------------------------------------------------------------------------+
|                                 EventCoalescer                                    |
|  - Write Suppression Window (Suppresses self-writes via recordInternalWrite)     |
|  - Debounce Window (Default: 50ms)                                                |
|  - Exclusion Filtering (.git, node_modules, dist, .cache, etc.)                   |
|  - State Folding:                                                                 |
|      * create + modify -> create                                                  |
|      * create + delete -> absorbed (cancelled)                                    |
|      * delete + create -> modify                                                  |
|      * modify + modify -> modify                                                  |
+-----------------------------------------------------------------------------------+
                                          | CoalescedFileSystemEvent[]
                                          v
+-----------------------------------------------------------------------------------+
|                           FileSystemWatcherService                                |
|  - Subscriptions: watch(uri, onEvents, { recursive, excludes, generation })       |
|  - Generational Stale-Event Protection (event.gen === workspace.gen)             |
|  - Workspace Lifecycle Binding: auto-cleanup on workspace.closed / changed        |
|  - Document Reconciliation Engine:                                                |
|      * Clean buffer modified -> auto-reload via reloadDocumentHook                |
|      * Dirty buffer modified -> conflictDetected event (zero overwrite)           |
|      * Deleted on disk       -> document.fileResource.exists = false (orphaned)   |
|      * Renamed on disk       -> document.filePath updated (renamed)               |
+-----------------------------------------------------------------------------------+
       |                                      |                               |
       v                                      v                               v
[WorkspaceContext]                 [FeedbackService]                 [File Explorer / SCM]
```

### 2.1 FileSystemWatcherService (`src/core/watcher/FileSystemWatcherService.ts`)
- **Canonical Owner**: Single source of truth for filesystem observation and external change reconciliation.
- **Lifecycle Integration**: Registered as a workspace-scoped service in `ApplicationRuntime` (`src/core/runtime/defaultServices.ts`). Listens to `globalWorkspaceEngine` lifecycle events (`workspace.closed`, `workspace.changed`) to automatically purge stale subscriptions.
- **Subscriptions API**: Exposes `watch(targetUri, onEvents, options)` returning an unsubscribe disposable function.

### 2.2 EventCoalescer (`src/core/watcher/EventCoalescer.ts`)
- Debounces events using a configurable micro-window (default 50ms).
- Folds intermediate events into canonical net outcomes (`create`, `modify`, `delete`, `rename`).
- Filters out universal ignore patterns (`.git`, `node_modules`, `.DS_Store`, `dist`, `.cache`, `coverage`).
- Maintains an internal write suppression registry keyed by normalized URI to ignore echo events within a 1000ms window.

### 2.3 Document Reconciliation Engine
- Connects directly to open buffers via `registerDocumentHooks(getOpenDocuments, reloadDocument)`.
- Enforces strict reconciliation rules:
  | File State on Disk | Document Buffer State | Engine Outcome |
  | :--- | :--- | :--- |
  | Modified | Clean (`isDirty: false`) | Auto-reloads new disk text; updates content revision. |
  | Modified | Dirty (`isDirty: true`) | Preserves dirty buffer; emits `watcher.conflictDetected`; notifies user via `FeedbackService`. |
  | Deleted | Any | Flags resource as `exists = false` (`orphaned`); preserves buffer. |
  | Renamed | Any | Updates document `filePath` and `title` (`renamed`). |

### 2.4 Conflict Resolution Workflow
When a conflict occurs on a dirty buffer, the user can resolve the conflict with two non-destructive options:
- **`keep_local`**: Keeps the unsaved editor content as the authoritative state; emits `watcher.conflictResolved`.
- **`revert_disk`**: Overwrites the editor content with current disk text, resets dirty flag to `false`, and updates the saved revision.

---

## 3. Generational Stale-Event Protection

When a user switches workspaces, files in the previous workspace may still have pending I/O operations or debounced watcher events in flight.

To prevent cross-workspace contamination:
1. Every raw event is stamped with `workspaceGeneration = globalWorkspaceEngine.getGeneration()`.
2. When flushing events, `FileSystemWatcherService` compares `event.workspaceGeneration` with the current generation.
3. Any event originating from an older generation is silently discarded with an audit log.
4. Calling `cleanupWorkspaceSubscriptions(currentGeneration)` immediately disposes any watcher whose subscription generation is strictly less than the current workspace generation.

---

## 4. Integration Points

1. **`FileService` (`src/services/FileService.ts`)**:
   - `writeFile` calls `globalFileSystemWatcherService.recordInternalWrite(targetUri)` prior to streaming bytes to storage.
   - Prevents self-inflicted modification notifications.

2. **`WorkspaceContext` (`src/state/WorkspaceContext.tsx`)**:
   - Registers live document hooks to allow seamless clean document auto-reloads.
   - Listens to `watcher.conflictDetected` and surfaces warnings via `globalFeedbackService`.
   - Exposes `resolveConflict(documentId, 'keep_local' | 'revert_disk')`.

3. **`ApplicationRuntime` (`src/core/runtime/defaultServices.ts`)**:
   - Manages service initialization, flushing on workspace reset, and disposal on shutdown.

---

## 5. Failure and Edge Cases Handled

- **Watch Call After Disposal**: Throws `WatcherDisposedError`.
- **Ephemeral Files**: Rapid create followed by delete is absorbed and emitted as no-op.
- **External Delete While Buffer Open**: Buffer is preserved; document marked as orphaned without crashing editor.
- **Unsaved Changes Under External Modify**: Unsaved changes are never lost or silently overwritten.
- **Uncaught Listener Exceptions**: Callback errors in subscriptions are trapped and logged without crashing the event dispatcher.
