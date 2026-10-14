# QM Editor Core Engine Integration & Cross-Service Architecture

## 1. Executive Overview

This document defines the integrated runtime architecture of QM Editor established at the completion of **Phase 04 — Core Application Engine**.

It details the service dependency graph, authoritative state ownership, transactional boundaries, event dispatch order, lifecycle management, asynchronous request safety, error categorization, and degraded-mode resilience across all 30 built-in core services.

---

## 2. Integrated System Architecture

```text
                         Application Runtime (Step 29)
                                │
                     ┌──────────┴──────────┐
                     ▼                     ▼
               Service Registry       Runtime Events
                     │
                     ▼
               Workspace Engine (Step 30)
                     │
          ┌──────────┼─────────────────────────┐
          ▼          ▼                         ▼
     File System   Resource Lifecycle   Workspace Context
      Service           │                      │
          │             ▼                      ▼
          ▼       Document Engine (Step 36)    File Watching (Step 32)
     Safe Save          │                      │
                        ▼                      ▼
               Editor Coordination      Resource Synchronization (Step 38)
                   (Step 37)                   │
                        │                      ▼
                        ▼                 Conflict Guard
                Edit Transactions ◄────────────┘
                    (Step 31)
                        │
         ┌──────────────┼──────────────┬──────────────┐
         ▼              ▼              ▼              ▼
     Undo/Redo      Commands      Diagnostics     Language
     (Step 39)      (Step 22)      (Step 40)    Intelligence
                                       │          (Step 42)
                                       ▼              │
                                   Problems     ┌─────┼─────┐
                                       │        ▼     ▼     ▼
                                       │      Comp  Hover  Actions
                                       │      (42)  (43)   (44)
                                       └────────┬─────┴─────┘
                                                ▼
                                      Navigation Coordinator
                                             (Step 41)
                                                │
                                                ▼
                                            Editor UI
```

---

## 3. Authoritative Ownership Matrix

To eliminate duplicate authorities and state synchronization race conditions, every domain is assigned exactly one authoritative owner:

| State Domain | Authoritative Owner | Non-Authoritative Consumers |
| :--- | :--- | :--- |
| **Application Lifecycle** | `ApplicationRuntime` | Shell, Status Bar, Window Controls |
| **Service Dependency & Health** | `ServiceRegistry` / `RuntimeHealth` | Settings, Command Palette |
| **Workspace Identity & Generation** | `WorkspaceEngine` | Watchers, Providers, Documents, Search |
| **Resource Identity & Normalization**| `ResourceIdentity` | FileService, Explorer, QuickOpen |
| **Document State, Revisions & Dirty**| `DocumentEngine` | Tabs, Editor Adapters, SessionService |
| **Visual Models & View States** | `EditorCoordinationService` | CodeMirror View, Mini-Map, Cursor |
| **Text Mutation Authorization** | `EditTransactionManager` | Typing, Paste, Replace, Completion, QuickFix |
| **Undo / Redo Stacks** | `DocumentHistoryService` | Edit Menu, History Shortcuts |
| **Filesystem I/O Operations** | `FileService` | Workspace Index, Save As |
| **Filesystem Change Observation** | `FileSystemWatcherService` | Explorer Tree, Diagnostics Refresh |
| **External Change Reconciliation** | `ResourceSynchronizationService`| Document Reloads, Conflict Dialogs |
| **Issue Lifecycle & Markers** | `DiagnosticService` | Problems Panel, Gutter Badges, QuickFixes |
| **Document Outline & Symbols** | `SymbolService` | Outline Panel, Breadcrumbs |
| **Spatial Jumps & History** | `NavigationCoordinator` | Go to Line, Definition Jumps, Find Next |
| **Language Intelligence Providers** | `LanguageIntelligenceRegistry` | Completion, Hover, Signature, Actions |
| **Command Execution & Bindings** | `CommandRegistry` | Menus, Shortcuts, Palette, Toolbar |
| **User Notifications & Dialogs** | `FeedbackService` | Modals, Banners, Progress Toasts |

---

## 4. Deterministic Event Flow & Mutation Pipeline

All text transformations obey a strict, directional pipeline:

```text
User Event (Type / Paste / Quick Fix)
             ↓
Applicability & Capability Check (Document is open? !isReadOnly? !hasConflict?)
             ↓
Coordinate & Range Validation (0 <= from <= to <= textLength, no overlaps)
             ↓
EditTransaction Formulation (baseRevision === doc.contentRevision)
             ↓
EditTransactionManager.applyTransaction()
   ├── Validates ranges in reverse offset order
   ├── Snapshots deleted text for undo reversal
   └── Emits 'document.transactionApplied'
             ↓
DocumentHistoryService records undo transaction
             ↓
DocumentEngine.updateText()
   ├── Updates content buffer
   ├── Increments contentRevision
   ├── Evaluates dirty state against savedBaselineContent
   ├── Emits 'document.changed'
   └── Emits 'document.dirtyChanged' (if dirty state flipped)
             ↓
EditorCoordinationService updates visual CodeMirror model
             ↓
Diagnostics & Problems refreshed via document change listener
             ↓
Language coordinators cancel obsolete in-flight queries via CancellationTokenSource
```

---

## 5. Lifecycle Orchestration: Startup, Degraded Mode & Shutdown

### 5.1 Startup Sequence
1. `ApplicationRuntime` instantiates `ServiceRegistry`, `RuntimeEvents`, `RuntimeHealth`, and `LifecycleManager`.
2. `registerDefaultServices()` registers 30 built-in core services with explicit dependency lists.
3. `runtime.start()` executes `DependencyResolver.resolveDependencies()`, constructing a topological sort DAG.
4. Services initialize in strict dependency order:
   - Critical Tier 1: `settings`, `feedback`, `command`, `file`
   - Critical Tier 2: `editTransactionManager`, `documentEngine`, `editorCoordination`, `workspaceEngine`
   - Application Tier 3: `history`, `diagnostics`, `symbols`, `navigation`, `languageIntelligence`
   - Language Tier 4: `completion`, `hover`, `signatureHelp`, `codeActions`
   - Workspace Tier 5: `watcher`, `resourceSynchronization`, `sourceControl`, `tasks`
5. If non-critical services fail during startup, `RuntimeHealth` flags `state: 'degraded'`. If a critical service fails, startup aborts.

### 5.2 Workspace Switching & Reset
1. `runtime.openWorkspace(uri)` or `runtime.closeWorkspace()` increments `workspaceGeneration`.
2. Workspace-scoped services (`watcher`, `workspaceSearch`, `workspaceIndex`, `sourceControl`) invoke `reset()` hooks.
3. In-flight requests carrying older generation tokens are rejected immediately.

### 5.3 Graceful Shutdown
1. `runtime.shutdown()` transitions lifecycle state to `shuttingDown`.
2. Running processes (`terminalService.disposeAll()`, `taskService.cancelAll()`) are terminated safely.
3. Asynchronous queries are canceled via active `CancellationTokenSource`.
4. File watcher adapters unwatch handles.
5. In-memory registries and document buffers are cleared and disposed.
6. Lifecycle state transitions to `terminated`.

---

## 6. Security & Privacy Guardrails

1. **Workspace Boundary Containment:** File paths outside active workspace roots are blocked from automated watcher reloading and filesystem mutation (`isResourceInRoot`).
2. **Untrusted Provider Isolation:** Language providers run within isolated `Promise.allSettled` try/catch boundaries. Provider exceptions cannot crash the application host.
3. **Markdown & HTML Sanitization:** Rich documentation tooltips and hover modals are filtered through `ContentSanitizer`, stripping `<script>`, `<iframe>`, `on*` attributes, and `javascript:` URLs.
4. **No Arbitrary Shell Execution:** Code action providers and language tools have zero access to raw shell or process APIs.
5. **Local-First Privacy:** Document text, proposed code diffs, and project file paths are never logged in production logs or transmitted across networks.
