# QM Editor (QuantumMentor Editor)

<p align="center">
  <img src="public/QM Editor Logo.png" alt="QM Editor Logo" width="120" />
</p>

<p align="center">
  <strong>A Next-Generation, High-Performance Developer Code Editor</strong><br />
  Built with React, TypeScript, CodeMirror 6, and Vite.
</p>

---

## 🚀 Project Overview

**QM Editor** is a modern, lightweight, keyboard-first desktop-class code editor designed for maximum responsiveness, security, and developer productivity. Built on top of a modular architecture, QM Editor cleanly separates document content buffers, editor view states, location history, session metadata, and physical filesystem storage.

---

## 🌟 Key Features Completed (Phase 01)

### 🎨 1. Core Shell & UI Layout (Steps 1–5)
- **Glassmorphism Theme System:** Sleek Dark (`dark`) and Light (`light`) theme modes powered by CSS variable design tokens.
- **Flexible Layout Shell:** Header navbar, resizable sidebar Explorer, multi-tab editor workspace, bottom console panel, and status bar footer.
- **Overlay Layer System:** Accessible modal dialog infrastructure supporting overlay stacking and z-index ordering.

### 📝 2. Editor Surface & Engine Integration (Steps 6–8)
- **CodeMirror 6 Adapter (`EditorAdapter.ts`):** Direct abstraction layer isolating the UI from underlying editor engine details.
- **Document Workspace Model:** Multi-tab document management, dirty-state indicators, unsaved changes warnings, and tab switching.
- **Central Command System:** Dot-notated command registry (`src/core/commands/CommandRegistry.ts`) with keyboard shortcut routing (`ShortcutManager.ts`).

### 📁 3. File System & File Explorer (Steps 9–10)
- **File System Access API Integration:** Native OS file reading and safe save mechanisms via browser storage handles (`FileService.ts`).
- **Workspace Tree Explorer:** Folder expansion with lazy loading, deterministic sorting (folders first), and async request token protection.

### 🔍 4. Search & Replace Engine (Step 11)
- **Regex & String Matching:** Case-sensitive, whole-word, and regular expression document matching.
- **Atomic Operations:** Find Next/Previous navigation and reverse-offset atomic Replace All operations.

### 🔤 5. Language System & Editor Preferences (Steps 12–13)
- **Language Intelligence:** Auto-detection by file extension and CodeMirror language extensions (TypeScript, JavaScript, HTML, CSS, JSON, Markdown, Python).
- **Editor Productivity Preferences:** Live presentation configuration for font size zooming (`Ctrl+`/`Ctrl-`), word wrapping (`Alt+Z`), line numbers, whitespace rendering, bracket matching, active line highlighting, and code folding.
- **Zero-Dirty Guarantee:** View preferences update presentation live without modifying document text or marking files dirty.

### 📍 6. Navigation, Location History & Session Continuity (Step 14)
- **Go to Line / Column (`Ctrl+G`):** Modal dialog with input validation and line-clamping safety.
- **Location History Stack:** Bounded back (`Alt+Left`) and forward (`Alt+Right`) navigation history.
- **Recent Documents:** Metadata tracking for recently accessed files (`Ctrl+Shift+R`).
- **Lightweight Session Continuity:** Schema-versioned session persistence (`version: 1`) restoring open file tabs and cursor positions safely upon app restart.

### ⚡ 7. Command Palette & Action Discovery (Step 15)
- **Command Palette (`Ctrl+Shift+P`):** Keyboard-first action discovery dialog consuming the central `CommandRegistry`.
- **Fuzzy Search Engine:** Multi-tier deterministic search scoring matching command labels, categories, descriptions, and aliases with text match highlighting.
- **Runtime Revalidation:** Verifies command `canExecute` availability at the moment of execution.

### 🚀 8. Quick Open & Fast Resource Navigation (Step 16)
- **Quick Open (`Ctrl+P`):** Instant workspace file search dialog filtering filename and relative path metadata.
- **Workspace Resource Indexing:** Async in-memory indexing (`WorkspaceIndexService.ts`) skipping excluded directories (`node_modules`, `.git`, `dist`, etc.) with zero full-text content reading overhead.
- **Existing Tab Reuse:** Automatically activates existing open tabs (`activateDoc`) when selected instead of creating duplicate tabs.
- **Explorer Sync:** Automatically reveals and highlights the selected file node in the File Explorer tree.

### 🔍 9. Workspace Content Search & Safe Multi-File Replace (Step 17)
- **Find in Files (`Ctrl+Shift+F`):** Full workspace text content search (`WorkspaceSearchService.ts`) with match line/column previews, match counts, and collapsible file grouping.
- **Advanced Search Options:** Case sensitivity, whole word matching, regular expression evaluation, and glob inclusion/exclusion patterns (`*.ts`, `dist/**`).
- **Performance & Safety Guardrails:** Non-blocking asynchronous batch file scanning (bounded concurrency), 5MB file size limits, binary NUL-byte detection, and request generation ID cancellation protection.
- **Safe Multi-File Replace (`Ctrl+Shift+H`):** Controlled previewable replacement planning (`WorkspaceReplaceService.ts`) requiring explicit user review (`WorkspaceReplaceModal.tsx`).
- **Dirty Tab & Read-Only Protection:** Open dirty files (`isDirty === true`) and read-only targets are flagged and protected from automated batch overwrite, avoiding data loss.

### 🌿 10. Git Integration & Source Control Foundation (Step 18)
- **Source Control Abstraction:** Provider-agnostic abstraction (`SourceControlProvider`, `SourceControlService`, `GitProvider`) for repository detection and working tree status inspection.
- **Source Control View Panel (`Ctrl+Shift+G`):** Sidebar panel listing working tree changes (`M`, `D`), untracked files (`U`), staged changes (`S`), and conflicts (`C`).
- **File Explorer Status Badges:** Visual status decorations next to tree node names in the File Explorer (`FileExplorerTree.tsx`).
- **Status Bar Branch Indicator:** Live branch indicator button in status bar footer showing active branch (e.g. `main` or `HEAD (a1b2c3d)`).
- **Read-Only Diff Inspection:** Line-by-line text comparison viewer (`SourceControlDiffModal.tsx`) with binary file guard protection.

### 💻 11. Integrated Terminal & Safe Process Execution Foundation (Step 19)
- **Terminal Process Subsystem:** Controlled user-facing process architecture (`TerminalService.ts`, `TerminalSession.ts`, `PtyAdapter.ts`, `ShellDetector.ts`) with OS shell auto-detection (PowerShell/CMD on Windows, Zsh/Bash on macOS/Linux).
- **Interactive Terminal Surface (`TerminalScreen.tsx`):** Real-time streaming output, ANSI color sequence formatting, interactive prompt, command line history navigation (Arrow Up/Down), and Ctrl+C interrupt signals.
- **Multi-Session Management (`TerminalView.tsx`):** Tabbed multi-terminal interface with session creation (`Ctrl+Shift+\``), switching, tab renaming, clear buffer, and process termination (`Trash2`).
- **Secondary Panel Integration (`SecondaryPanel.tsx`):** Integrated bottom panel with draggable resizer handle, session counter badge, and toggle shortcut (`Ctrl+\``).
- **Strict Process Isolation:** User-only interactive boundary preventing silent internal execution from AI, Git, or plugin modules.

### 12. Tasks, Build, Run & Problem Matcher Foundation (Step 20)
- **Task Runner Subsystem (`TaskService.ts`):** Project-scoped development task execution supporting `build`, `test`, `run`, `lint`, and custom tasks.
- **Problem Matcher Subsystem (`ProblemParser.ts`):** High-performance output stream parsers extracting structured diagnostics from compilers and linters (`$tsc`, `$eslint`, `$general`, `$dotnet`).
- **Interactive Problems Panel (`ProblemsPanel.tsx`):** Normalized diagnostics view with severity counters and one-click jump-to-source file, line, and column navigation.
- **Dependency & Cycle Resolver (`TaskValidator.ts`):** Deterministic prerequisite execution with DFS cycle detection (`A -> B -> A`).
- **Workspace Trust Boundary:** Explicit execution guard blocking unconfirmed processes in untrusted workspaces.
- **Build Shortcut & Command Integration:** Global build shortcut `Ctrl+Shift+B` (`Mod+Shift+B`) and Command Palette task triggers.

### 13. Unified Settings, Preferences & Configuration System (Step 21)
- **Centralized Settings Registry (`SettingsRegistry.ts`):** Typed definitions, bounds, descriptions, and defaults across Appearance, Editor, Terminal, Source Control, Tasks, Files, Search, and Accessibility.
- **Unified Settings Service (`SettingsService.ts`):** Single source of truth resolving effective values with strict scope precedence (`Workspace` -> `User` -> `Default`).
- **Unified Settings Modal (`UnifiedSettingsModal.tsx`):** Category sidebar, real-time ranked search, typed UI controls (switches, steppers, dropdowns), inline resets, and JSON import/export.
- **Backward-Compatible Migration:** Safe, automatic migration from legacy Step 13 user preferences to the unified dot-notation schema.

### 14. Unified Menus, Toolbars, Context Menus & Command Surfaces (Step 22)
- **Single Command Architecture (`CommandSurfaceRegistry.ts`):** Central command surface registry connecting all visible UI actions directly to the centralized `CommandRegistry` (`globalCommandRegistry`). Zero duplicate execution logic.
- **Application Menu Bar (`MenuBar.tsx`):** Desktop top-level menu bar featuring 9 standard categories: `File`, `Edit`, `Selection`, `View`, `Go`, `Terminal`, `Tasks`, `Source Control`, and `Help`. Accessible via keyboard (`Alt`, Arrow keys, `Enter`, `Escape`), active toggle checkmarks, and formatted platform shortcuts.
- **Primary Unified Toolbar (`Toolbar.tsx`):** High-frequency curated actions (`New`, `Open`, `Save`, `Undo`, `Redo`, `Find in Files`, `Quick Open`, `Command Palette`, `Settings`) with tooltips displaying action and shortcut.
- **Responsive Progressive Reduction:** Dynamic width tracking folding secondary toolbar actions into a clean `OverflowMenu` button on compact viewports.
- **Context Menus (`ContextMenu.tsx`):** Floating, viewport-bounded contextual menus with keyboard navigation, edge-clamping, focus restoration, and intelligent separator grouping.
- **Unified Surface Integrations:** Context menus attached to File Explorer (`Open`, `Copy Path`, `Reveal`, `Refresh`), Editor surface (`Undo`, `Redo`, `Cut`, `Copy`, `Paste`, `Select All`, `Find`), Document tabs (`Close`, `Close Others`, `Close Saved`, `Copy Path`), Terminal (`Copy`, `Paste`, `Clear`, `Kill`), Tasks (`Run`, `Cancel`, `Show Output`), and Problems (`Go to Source`, `Copy Message`).
- **Stale Context Protection:** 4-step revalidation before command execution ensuring target and availability validity before dispatch.

### 15. Unified Notifications, Dialogs, Confirmations & Progress System (Step 23)
- **Centralized Feedback Service (`FeedbackService.ts`):** Single point of interaction for user feedback with severity separation (`success`, `info`, `warning`, `error`), presentation separation (`toast`, `banner`, `dialog`, `confirmation`, `progress`, `inline`), queue management, and automated deduplication window (3,000ms).
- **Transient Toasts (`ToastHost.tsx`):** Non-blocking bottom-right notifications with automatic semantic dismissal (`brief`: 2.5s, `normal`: 5s, `persistent`), repeat count badge pills (`×N`), command action buttons, expandable sanitized technical details, and one-click copy.
- **Persistent Banners (`BannerHost.tsx`):** Spans below the Header for sustained conditions (workspace trust, missing Git runtime) with safe dismiss and custom action triggers.
- **Safe Destructive Confirmations (`ConfirmDialog.tsx`):** Typed modal gate returning `'confirmed' | 'cancelled' | 'dismissed'`. Defaults focus to the Cancel button to prevent accidental execution, enforces focus trap, and dismisses on Escape or backdrop click.
- **Floating Progress System (`ProgressHost.tsx`):** Bottom-left progress tracker supporting determinate quantitative progress (with percentage bars) and indeterminate pulsing activity, alongside cancellation tokens.
- **Inline Validation (`InlineFeedback.tsx`):** Scoped input validation component with accessible ARIA live regions (`assertive` for errors, `polite` for warnings).
- **Security & Privacy Sanitization:** Automatic redaction of credentials, bearer tokens, passwords, and private keys from all technical details prior to presentation.

### 16. Accessibility, Focus Management & Keyboard Navigation Foundation (Step 24)
- **Centralized Focus Manager (`FocusManager.ts`):** Deterministic focus lifecycle management with hierarchical focus scopes (`application`, `dialog`, `menu`, `contextmenu`, `commandpalette`, `quickopen`, `settings`, `terminal`, `editor`, `explorer`, `problems`), safe LIFO restoration on overlay exit, and fallback handling for unmounted targets.
- **Modal Containment & Focus Trapping (`FocusTrap.tsx`):** Centralized focus trap wrapper containing Tab and Shift+Tab cycling within active dialogs while enabling clean Escape key dismissal.
- **Input Field Protection (Rule 43):** Protected native text editing (`Mod+A`, `Mod+C`, `Mod+V`, `Mod+X`, `Mod+Z`, `Mod+Y`) within `<input>` and `<textarea>` elements, preventing buffer commands from hijacking search queries or settings entry.
- **Focus Region Workbench Commands:** Registered keyboard commands for jumping between primary shell regions (`workbench.action.focusExplorer`, `workbench.action.focusEditor`, `workbench.action.focusTerminal`, `workbench.action.focusProblems`, `workbench.action.focusSettings`).
- **Semantic ARIA Composite Widgets:** Document tabs (`role="tablist"` / `role="tab"`) with roving tabindex and ArrowLeft/Right switching, File Explorer tree (`role="tree"` / `role="treeitem"` / `aria-level`), Problems list (`role="list"` / `role="listitem"`), and accessible panel resizer (`role="separator"` with keyboard ArrowUp/Down adjustment).
- **Visual Focus & Theming Accessibility:** High-contrast `:focus-visible` styling (`2px solid var(--border-focus)` with 2px offset), reduced-motion awareness (`@media (prefers-reduced-motion: reduce)`), and high-contrast mode compatibility (`@media (forced-colors: active)`).
- **ARIA Live Announcements (`LiveRegion.tsx`):** Polite and assertive screen-reader announcement regions for status updates, save results, and diagnostic alerts.

### 17. Responsive Workspace, Adaptive Layout, Panel Resizing & UI Density (Step 25)
- **Centralized Layout State & Protection (`LayoutService.ts`, `LayoutConstraints.ts`):** Centralized layout service enforcing safe boundaries across window sizes and display scaling. Enforces strict editor area protection (min editor width: 300px, min editor height: 150px) preventing sidebars or secondary panels from occluding the central code editor.
- **Bidirectional Accessible Panel Resizing:** Draggable splitters for both Primary Sidebar (min: 160px, max: 500px, default: 260px) and Secondary Bottom Panel (min: 120px, max: 600px, default: 240px) with double-click reset, keyboard adjustment (Arrow keys, Home, End), and full ARIA separator semantics.
- **UI Density System (`comfortable` vs `compact`):** System-wide density tokens adjusting header height (`48px` vs `40px`), status bar height (`28px` vs `24px`), tab height (`38px` vs `30px`), and tree item density without sacrificing touch/pointer hit target accessibility or typography legibility.
- **Document Tab Overflow & Active Tab Reveal:** Responsive tab strip container with smooth horizontal scrolling and automated `scrollIntoView` for active documents, paired with text truncation preserving dirty state markers.
- **Responsive Status Bar Adaptation:** Automatic progressive reduction hiding secondary status metrics (`.status-item-secondary`) on viewports `<= 800px` to prevent horizontal overlap.
- **Standardized Layering (Z-Index Tokens):** Eliminated arbitrary z-index values in favor of standardized semantic design tokens (`--z-base` through `--z-tooltip`).
- **Layout State Persistence & Factory Reset:** Bounded localStorage persistence (`qm_editor_layout_state_v1`) with versioning, strict numeric clamping, and a dedicated layout reset command (`workbench.action.resetLayout`).

### 18. Professional UI Component Library, Interaction States & Design System (Step 26)
- **Standardized Component Library (`src/components/common/index.ts`):** Complete collection of typed, theme-aware, accessible UI building blocks eliminating fragmented component implementations across editor surfaces.
- **Action & Form Primitives:** `Button` (5 variants, 3 sizes, loading state with `aria-busy`), `IconButton` (accessible label requirement, toggle support), `Input` (clearable, leading/trailing icon slots, validation variants), `Textarea` (resize controls), `Select` (typed options), `Checkbox` (indeterminate state support), `Toggle` (`role="switch"` semantics), `RadioGroup` (roving arrow navigation), and `Slider` (accessible numeric range).
- **Composite Form Field Architecture (`FormField.tsx`):** Automated accessibility binding linking label, description, and error alert to control inputs via deterministic `htmlFor`, `id`, `aria-describedby`, and `aria-invalid`.
- **Containers, Navigation & Panels:** `Card` (with composable Header, Content, Footer), `Panel` (with composable Header, Content, Footer), `Divider` (with horizontal/vertical and text label separation), `List` & `ListItem` (composable leading icon, title, secondary description, trailing action slots).
- **Overlay & Floating Primitives:** `Tooltip` (delay trigger, `role="tooltip"`), `Popover` (escape dismissal, outside-click close, non-modal region), and `Dialog` (`FocusTrap` containment, `var(--z-modal)` layering).
- **Feedback & State Indicators:** `Badge` (extended semantic variants), `StatusIndicator` (non-color redundant symbols, `role="status"`), `Spinner` & `Skeleton` (animated loading states), `EmptyState` (customizable zero-data placeholders), and `ErrorState` (expandable technical details, retry actions).
- **Standard Interaction States:** Seamless support for default, hover, focus-visible, active/pressed, selected, disabled, loading, error, and warning states across Dark and Light themes.

### 19. Welcome Experience, Workspace Entry, Empty States & Start Center (Step 27)
- **Start Center Surface (`StartCenter.tsx`):** Dedicated entry surface when no workspace or documents are open, or when invoked via `Help: Welcome (Start Center)`. Cleanly separated from the Document Model (never an editable tab, no buffer pollution, zero false dirty flags).
- **Canonical Action Delegation:** Direct routing to canonical commands (`workspace.open`, `file.new`, `file.open`, `workbench.action.showCommands`, `workbench.action.openSettings`, `workbench.action.resetLayout`).
- **Recent Workspaces Service (`RecentWorkspacesService.ts`):** Bounded history (10 items), MRU ordering, normalized path deduplication, persistent local storage with memory fallback, and safe removal (never touches physical files).
- **Unified Empty-State System:** Normalized `EmptyState` component adoption across File Explorer, Editor Canvas, Source Control, Tasks, Problems, Terminal, and Search.
- **Accurate State Communication:** Strict preservation of semantic ground truth (`Empty ≠ Loading`, `Empty ≠ Error`, `Empty ≠ Unavailable`, `No Results ≠ Error`).

### 20. Design System Finalization, Visual Consistency, Theming & UI Polish (Step 28 - Phase 03 Final)
- **Design Token Centralization:** Complete semantic layer tokens across dark and light themes (`--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-card`, `--bg-input`, `--border-subtle`, `--text-inverse`, `--text-danger`, `--accent-color`, `--accent-active`, `--accent-subtle`, `--success`, `--warning`, `--error`, `--info`).
- **Complete Theme Symmetry & Contrast:** Eliminated dark card fallbacks and pale borders in light mode; verified consistent contrast and immediate theme switching without application restarts.
- **Z-Index Layer Normalization:** Fully eliminated arbitrary high z-index literals across all overlays, modals, menus, toolbars, and toasts in favor of centralized hierarchy tokens (`--z-base` through `--z-tooltip`).
- **Interaction Classes & Hover Styling:** Added standard component class hooks (`.qm-button`, `.qm-icon-button`, `.qm-card-clickable`, `.qm-list-item`, `.qm-panel-header`) ensuring uniform interaction states and visual family resemblance.
- **Phase 03 Consolidation:** Unified all 28 steps into a single cohesive desktop product with full test coverage (55 test files, 250 tests passed, 0 type errors, 0 build warnings).

### 21. Core Application Runtime, Service Lifecycle & Dependency Orchestration (Step 29 - Phase 04 Initial)
- **Central Application Runtime (`ApplicationRuntime.ts`):** Top-level runtime coordinating application lifecycle (`created`, `initializing`, `ready`, `degraded`, `shuttingDown`, `terminated`).
- **Service Registry & Scopes (`ServiceRegistry.ts`):** Typed service registration and resolution partitioned by lifetime scope (`application`, `workspace`, `session`) and criticality (`critical`, `optional`).
- **Topological Dependency Resolution (`DependencyResolver.ts`):** Kahn's topological sort and deterministic DFS cycle detection guaranteeing safe initialization and reverse-order shutdown.
- **Fault Isolation & Rollback (`LifecycleManager.ts`):** Rollback on critical service failure; optional service fault isolation preserving core editor availability in degraded mode.
- **Generational Workspace Lifecycle:** Atomic `workspaceGeneration` tokens preventing stale asynchronous results from mutating newer workspace contexts.
- **Shutdown Coordinator (`ShutdownCoordinator.ts`):** Graceful process cleanup and resource teardown with safe timeout safeguards.

### 22. Workspace & Project Context Engine (Step 30)
- **Centralized Workspace Engine (`WorkspaceEngine.ts`):** Authoritative subsystem for active workspace state, identity, roots, capabilities, and lifecycle (`none`, `opening`, `ready`, `changing`, `closing`, `closed`, `degraded`, `failed`).
- **Resource Boundary & Traversal Guards (`WorkspaceResourceBoundary.ts`):** Canonical path normalization and strict membership verification preventing prefix collision vulnerabilities (`C:\project` vs `C:\project-other`) and traversal exploits (`../`).
- **Serialized Transitions & Mutex Locking:** Enforces transition locks to prevent overlapping state mutations and guarantees atomic, rollback-safe workspace switches.
- **Async Generational Protection:** Generates request contexts with monotonic generation counter invalidation to eliminate stale background results from Search, Git, Indexing, and Tasks.
- **Unsaved Document Protection:** Integrates document dirty state validation to prevent silent data loss during workspace changes.

### 23. Edit Transactions, Change Events & Revision Consistency (Step 31)
- **Structured Edit Transactions (`EditTransactionManager.ts`):** Atomic text operations supporting multi-cursor edits, batch replacements, and refactorings with explicit base revisions and origins.
- **Ordered Reverse Execution:** Applies multiple non-overlapping edits descending by character offset, eliminating offset corruption during batch replacements.
- **Revision Monotonicity & Invariants:** Enforces strict sequential `contentRevision` tracking, no-op suppression on identical content, and dirty state preservation (`isDirty = contentRevision !== savedRevision`).
- **Undo / Save State Protection:** Restores `isDirty = false` when undoing back to the exact saved revision, and guards against in-flight save races.
- **IME & Composition Lifecycle:** Tracks active Input Method Editor sessions with `isComposition` flags and composition event markers.
- **Document Change Observability:** Canonical event bus publishing `document.transactionWillApply`, `document.transactionApplied`, and `document.dirtyStateChanged`.

### 26. Diagnostics Model, Aggregation & Editor Integration (Step 34)
- **Canonical Diagnostic Service (`DiagnosticService.ts`):** Central manager coordinating diagnostic collections, severity prioritisation, deduplication, and workspace summaries.
- **Multi-Source Diagnostic Collections:** Isolated diagnostic buffers for linters, language servers, and compilers without cross-provider state stomping.
- **CodeMirror Squiggle Decorations:** Real-time gutter and inline wavy squiggles (`.cm-diagnostic-*`) reflecting problems directly within code editors.
- **Unified Problems Panel Integration:** Bidirectional synchronization between active diagnostics collections and task problem matchers.

### 27. Symbol Infrastructure, Outline & Symbol Navigation (Step 35)
- **Canonical Symbol Abstraction (`SymbolTypes.ts`):** Standardized `DocumentSymbol`, `WorkspaceSymbol`, and `SymbolKind` (class, interface, method, function, variable, enum, heading, etc.) with 1-based coordinates.
- **Hierarchical Symbol Extraction (`SymbolExtractors.ts`):** Multi-language heuristic symbol parsing for TypeScript, JavaScript, Markdown (nested H1/H2/H3 hierarchies), Python, JSON, and fallbacks.
- **Revision-Keyed Indexing (`SymbolService.ts`):** Monotonically keyed document symbol cache (`contentRevision`) preventing redundant parsing across unchanged documents.
- **Responsive Cancellation (`CancellationToken.ts`):** Cooperative cancellation tokens releasing background scanning cycles on rapid user inputs.
- **Generational Stale-Result Guards:** Query sequence numbering (`querySequence`) discarding outdated asynchronous symbol search results.
- **Go To Symbol Navigation (`GoToSymbolModal.tsx`):** Unified modal supporting document symbol jumps (`@` / `Mod+Shift+O`) and workspace symbol search (`#` / `Mod+T`) with keyboard navigation and kind badges.
- **Outline Panel (`OutlinePanel.tsx`):** Sidebar outline tree reflecting document structure with active cursor tracking and one-click jump-to-definition.

### 28. Document Engine, Resource Lifecycle & Cross-Service Coordination (Step 36)
- **Authoritative Document Engine (`DocumentEngine.ts`):** Central manager coordinating document models, open resource lifecycles, and in-memory buffer authority.
- **Resource Identity Subsystem (`ResourceIdentity.ts`):** Platform-normalized canonical URIs distinguishing physical (`file://`), W3C storage handles (`browser-fs://`), untitled (`untitled:`), and virtual resources.
- **Duplicate Open Prevention:** Guaranteed activation of existing documents across File Explorer, Quick Open, Search, and Command Palette without duplicate buffer instances.
- **Revision-Safe Save Protection:** Strict monotonic revision checkpoints preventing saves from dropping edits typed while a physical disk write is in-flight.
- **External Filesystem Conflict Invariants:** Automatic safe reloads for clean documents, paired with conflict protection that never silently overwrites dirty buffers upon external disk changes.
- **Resource Reassignment:** Preserves document runtime ID and edit history when saving untitled buffers or executing Save As.

---

## 📋 Progress Roadmap

- [x] **Step 1:** Complete Project Audit & Technical Baseline
- [x] **Step 2:** Technical Architecture & Development Foundation
- [x] **Step 3:** Project Foundation, Scaffolding & Engineering Guardrails
- [x] **Step 4:** Core Application Shell, Layout System & UI Foundation
- [x] **Step 5:** Navigation, Shell State Management & Workspace Interaction
- [x] **Step 6:** Document Workspace Model, Tabs & Editor Surface Foundation
- [x] **Step 7:** Editor Engine Evaluation, Integration Architecture & Core Editing Surface
- [x] **Step 8:** Editor Command System, Keyboard Architecture & Core Editing Actions
- [x] **Step 9:** File System Service, Document I/O & Safe Save Architecture
- [x] **Step 10:** File Explorer, Workspace Tree & Resource Navigation
- [x] **Step 11:** Search & Replace Engine, UI, Commands and Editor Integration
- [x] **Step 12:** Language System, Syntax Highlighting & Editor Language Intelligence Foundation
- [x] **Step 13:** Professional Editor Behavior, Editing Preferences & Productivity Foundation
- [x] **Step 14:** Advanced Editor Navigation, Location History & Session Continuity Foundation
- [x] **Step 15:** Command Palette, Action Discovery & Intelligent Command Execution
- [x] **Step 16:** Quick Open, Workspace File Search & Fast Resource Navigation
- [x] **Step 17:** Workspace Search, Find in Files & Safe Multi-File Replace
- [x] **Step 18:** Git Integration & Source Control Foundation
- [x] **Step 19:** Integrated Terminal & Safe Process Execution Foundation
- [x] **Step 20:** Tasks, Build, Run & Problem Matcher Foundation
- [x] **Step 21:** Unified Settings, Preferences & Configuration System
- [x] **Step 22:** Unified Menus, Toolbars, Context Menus & Command Surfaces
- [x] **Step 23:** Unified Notifications, Dialogs, Confirmations, Progress & Feedback System
- [x] **Step 24:** Accessibility, Focus Management, Keyboard Navigation & Interaction Foundation
- [x] **Step 25:** Responsive Workspace, Adaptive Layout, Panel Resizing & UI Density System
- [x] **Step 26:** Professional UI Component Library, Interaction States & Design System Completion
- [x] **Step 27:** Welcome Experience, Workspace Entry, Empty States & Start Center
- [x] **Step 28:** Design System Finalization, Visual Consistency, Theming & UI Polish (Phase 03 Complete)
- [x] **Step 29:** Core Application Runtime, Service Lifecycle & Dependency Orchestration (Phase 04 Started)
- [x] **Step 30:** Workspace & Project Context Engine
- [x] **Step 31:** Edit Transactions, Change Events & Revision Consistency
- [x] **Step 32:** Filesystem Watchers & External Change Reconciliation
- [x] **Step 33:** Undo/Redo History, Edit Grouping & Transaction Safety
- [x] **Step 34:** Diagnostics Model, Aggregation & Editor Integration
- [x] **Step 35:** Symbol Infrastructure, Outline & Symbol Navigation
- [x] **Step 36:** Document Engine, Resource Lifecycle & Cross-Service Coordination
- [x] **Step 37:** Editor Engine Coordination, Text Model Transactions & Editing State
- [x] **Step 38:** File Watching, External Change Detection & Resource Synchronization
- [x] **Step 39:** Undo/Redo Integration, Edit History Integrity & Transaction Safety
- [x] **Step 40:** Diagnostics, Problems, Markers & Issue Lifecycle Engine

## 🛠️ Technology Stack

- **Framework:** React 18, Vite 6
- **Language:** TypeScript 5.7 (Strict Mode)
- **Editor Engine:** CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/language`)
- **Iconography:** Lucide React
- **Testing:** Vitest
- **Styling:** Vanilla CSS Tokens (Dark Glassmorphism UI)

---

## 💻 Development & Build Scripts

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Run TypeScript type check
npm run type-check

# Run Vitest unit & component test suite
npm test

# Build production bundle
npm run build
```

---

## 🛡️ Architecture & Security Principles

1. **Domain Separation:** `Document Content` ≠ `Editor View State` ≠ `Navigation History` ≠ `Session Metadata` ≠ `Recent Files`. Document text content is **never** persisted in session storage.
2. **Metadata-Only Search:** Quick Open and Command Palette perform string filtering on local metadata. Zero `eval()` or dynamic script execution is performed.
3. **Workspace Scope Boundary:** Quick Open search is strictly bounded inside the active workspace folder. Queries cannot escape the workspace root.
