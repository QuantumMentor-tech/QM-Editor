# QM EDITOR — AGENT OPERATING RULES & SAFETY GUIDELINES

These non-negotiable rules govern all AI coding agents working on the QM Editor project.

---

## RULE 01 — INSPECT BEFORE MODIFYING
Never edit or delete a file without first reading its full contents and understanding its role within the QM Editor architecture.

## RULE 02 — DO NOT GUESS OR INFER SCHEMAS
Do not assume APIs, file paths, prop types, export structures, or component signatures. Verify them directly from source code using file viewing and search tools.

## RULE 03 — PRESERVE WORKING FUNCTIONALITY & ARCHITECTURE
Do not rewrite, refactor, reorganize, or replace existing working code or established architecture unless explicitly requested or required by an approved plan.

## RULE 04 — PRESERVE UI/UX INTEGRITY
Do not change layouts, visual design systems, color schemes, typography, spacing, navigation, or interaction patterns without explicit authorization.

## RULE 05 — NO UNSOLICITED OR SPECULATIVE FEATURES
Implement only the exact features requested for the current step. Do not add unused utility functions, speculative features, or dead code.

## RULE 06 — PROTECT USER DATA AND ASSETS
Never overwrite, corrupt, delete, or reset user documents, database persistence, project configuration, or assets (such as `./QM Editor Logo.png`).

## RULE 07 — CONTROLLED DEPENDENCY MANAGEMENT
Do not install, replace, or upgrade third-party packages unless explicitly specified in the active step plan. Avoid broad major-version upgrades.

## RULE 08 — WINDOWS POWERSHELL COMMAND EXECUTION RULE
When running Node/npm scripts on the Windows shell, invoke npm/npx through `cmd /c npm` or `cmd /c npx` to prevent PowerShell script execution policy errors.

## RULE 09 — MANDATORY VERIFICATION BEFORE COMPLETION
Never declare a task complete without executing build, lint, type-check, or test commands and demonstrating clean runtime success.

## RULE 10 — RESPECT PROTECTED AREAS
Always check `QM_EDITOR_PROJECT_BASELINE.md` for designated protected files and directories before making structural edits.

## RULE 11 — STOP AT STEP BOUNDARIES
Conclude execution when the assigned step's acceptance criteria are met. Do not proceed into subsequent steps or phases automatically.

## RULE 12 — EDITOR ENGINE ABSTRACTION DISCIPLINE
Never bypass `EditorAdapter` (`src/components/editor/EditorAdapter.ts`) to make direct third-party engine calls from arbitrary UI components. Maintain clean separation between `DocumentModel` state and editor view state.

## RULE 13 — NO UNSOLICITED AI IN EDITOR CORE
Keep all future AI capabilities behind explicit `AIService` boundaries. Never inject model calls or LLM API keys directly into the core editor engine or component layout layers.

## RULE 14 — FILE SYSTEM & EXPLORER BOUNDARY DISCIPLINE
File Explorer and UI components must never make raw native/OS filesystem calls directly. All storage and directory enumeration must route through `FileService` or `WorkspaceService`. Explorer nodes represent navigation metadata and must not contain raw document text buffers.

## RULE 15 — NON-DESTRUCTIVE EXPLORER SAFETY
File Explorer components must never perform destructive filesystem operations (such as delete, rename, move, or bulk overwrite) without dedicated permission-checked safety workflows in approved steps.

## RULE 16 — LANGUAGE SYSTEM DISCIPLINE
Language resolution and extension mappings must use the central `LanguageRegistry`. UI components must not scatter ad-hoc file extension rules. Manual language overrides must modify presentation configuration only and must never rename physical files, change extensions, or alter document content.

## RULE 17 — DO NOT REIMPLEMENT EDITOR ENGINE NATIVE BEHAVIOR
Always leverage native capabilities of the selected editor engine (CodeMirror 6) through `EditorAdapter` rather than building redundant custom parsers or custom layout overlays for line numbers, bracket matching, indentation, folding, or whitespace rendering.

## RULE 18 — ZERO-DIRTY STATE GUARANTEE FOR PRESENTATION SETTINGS
Changing editor settings (font size, word wrap, tab size, line numbers, folding, whitespace, cursor style) must only reconfigure view presentation and MUST NEVER mark any document dirty or alter file content.

## RULE 19 — SINGLE PREFERENCE OWNER DISCIPLINE
Preference state must flow predictably from `PreferencesService` → `ShellContext` → `EditorAdapter`. Do not create competing settings stores or duplicate local state in individual components or tabs.

## RULE 20 — VALIDATE PERSISTED PREFERENCES
All persisted settings loaded from storage must be strictly type-checked, bounds-clamped, and normalized before applying to the editor view. Out-of-bounds or corrupted values must fall back gracefully to defaults.

## RULE 21 — NO DYNAMIC CODE EXECUTION FROM SETTINGS
Setting values must remain pure configuration data. Never use `eval()`, dynamic `import()`, or arbitrary script execution mechanisms with user preference values.

## RULE 22 — SEPARATION OF PRESENTATION FROM DOCUMENT CONTENT
Maintain clear boundaries between document content buffers and presentation settings. Font sizes, line wrap, and tab presentation are view properties, not document content.

## RULE 23 — ACCESSIBLE & RESPONSIVE SETTINGS CONTROLS
Settings UI controls must adhere to QM Editor design system tokens, maintain full keyboard focusability, provide screen-reader accessible labels, and update editor view state live in under 5ms.

## RULE 24 — COMMAND PALETTE SINGLE DATA SOURCE DISCIPLINE
The Command Palette must use the central `CommandRegistry` as its sole authoritative source of command metadata. Never create parallel, duplicated command definition files for the palette.

## RULE 25 — NO ACTION LOGIC IN COMMAND PALETTE UI
The Command Palette is an action discovery and execution surface. It must delegate command execution strictly to `CommandRegistry.execute(id, context)` and must never contain custom, inline command handler implementations.

## RULE 26 — COMMAND AVAILABILITY REVALIDATION
Before executing any selected command, the system must revalidate `canExecute(id, context)` at execution time. Never execute a command if its availability condition evaluates to false at the moment of execution.

## RULE 27 — NO DYNAMIC CODE EXECUTION FROM SEARCH QUERIES
Search queries entered into the Command Palette must be treated as pure untrusted text for filtering metadata. Never `eval()`, execute, or pass search strings to script evaluation engines.

## RULE 28 — QUICK OPEN METADATA-ONLY SEARCH DISCIPLINE
Quick Open searches workspace resources strictly by filename and relative path metadata. Quick Open must NEVER open, read, or full-text index file contents.

## RULE 29 — REUSE EXISTING TABS ON QUICK OPEN
Selecting a resource in Quick Open that corresponds to an already-open workspace tab MUST activate the existing tab (`activateDoc(id)`) and MUST NOT instantiate duplicate document objects or tabs.

## RULE 30 — WORKSPACE BOUNDARY ENFORCEMENT
Quick Open resource indexing and search must stay strictly within the current workspace root boundary. Quick Open search queries must never resolve arbitrary paths outside the workspace scope or invoke raw OS shell commands.

## RULE 31 — ASYNC GENERATION TOKEN DISCIPLINE
Asynchronous directory indexing tasks must track generation tokens (`generationId`). Switching or closing a workspace must invalidate pending async enumeration tasks to prevent stale resource contamination across workspace boundaries.

## RULE 32 — SOURCE CONTROL SAFETY & READ-ONLY DISCIPLINE
Source Control services and UI components must remain strictly read-oriented observation tools. Git status scanning and diff inspection must never silently stage, unstage, commit, reset, discard, or mutate user files or repository metadata. UI components must never execute arbitrary raw shell process commands directly.

## RULE 33 — TERMINAL PROCESS ISOLATION & HUMAN-ONLY EXECUTION DISCIPLINE
The integrated terminal is strictly a human-controlled interactive development surface. Application features, UI components, background services, Git integrations, and AI systems must NEVER inject commands, execute hidden background processes, or use the terminal service as a backdoor process runner. Terminal session output must never be persisted to disk, logged to analytics, or uploaded externally.

## RULE 34 — TASK EXECUTION & PROBLEM MATCHER DISCIPLINE
Task execution is strictly project-scoped, observable, and explicitly user-initiated. Background AI agents, Git providers, search workers, and file services must NEVER silently execute project build, test, or run tasks. Task execution requires explicit project trust; untrusted workspaces must block execution until developer acknowledgment. Sensitive environment variables and secrets must never be logged or exposed. Problem Matchers must parse diagnostics with safe, bounded regular expressions without blocking the UI thread or exceeding memory quotas.

## RULE 35 — CENTRALIZED UNIFIED SETTINGS & CONFIGURATION DISCIPLINE
All configurable application preferences and options must be defined in the central Settings Registry and accessed exclusively through the Settings Service. Individual UI components or subsystems must NEVER create fragmented preference stores or read/write localStorage directly. Setting values must be strictly typed, validated, and scoped (user vs workspace). API keys, credentials, and sensitive secrets must never be stored in ordinary preferences or exported configuration files. Configuration writes must be atomic, protect against corruption, and maintain backward-compatible migration.

## RULE 36 — COMMAND SURFACES & SINGLE COMMAND SYSTEM DISCIPLINE
The application UI must never become a second command system. All application menus, toolbars, context menus, overflow menus, and document-tab actions must consume the centralized Command Registry (`CommandRegistry`) and Command Surface Registry (`CommandSurfaceRegistry`). UI components must never contain inline business logic or bespoke action handlers that bypass the Command Registry. Stale interaction contexts must be revalidated via `canExecute(id, ctx)` immediately prior to execution. Context menu targets do not convey authorization; all document, workspace, security, and read-only invariants must remain enforced at the command execution layer. Command surfaces must never initiate filesystem enumeration, Git operations, or expensive background tasks upon opening. Keyboard shortcuts rendered on command surfaces must be resolved dynamically from the centralized shortcut management system (`ShortcutManager`) to guarantee cross-platform accuracy.

## RULE 37 — UNIFIED FEEDBACK, NOTIFICATIONS, CONFIRMATIONS & PROGRESS DISCIPLINE
All user-facing interaction feedback across QM Editor must consume the centralized Feedback Service (`globalFeedbackService`). Subsystems must never invent parallel toast stores, modal dialogs, or confirmation prompts. Product code must NEVER invoke browser-native `alert()` or `confirm()`. Technical error details must be sanitized to strip credentials, auth tokens, passwords, and private keys. Notifications must be bounded and deduplicated to prevent spam storms. Operations taking noticeable time must use the centralized progress system without fabricating percentages when only indeterminate loading is known. Destructive actions must require explicit confirmation dialogs with safe defaults (Cancel button prefocused), focus trap, and Escape dismissal. Feedback tied to workspaces or documents must respect scope tags and must be scavenged upon scope changes to prevent stale leaks across workspace boundaries.

## RULE 38 — ACCESSIBILITY, FOCUS MANAGEMENT & KEYBOARD NAVIGATION DISCIPLINE
Accessibility in QM Editor is an architectural invariant. The entire interface must remain predictable, navigable, and operable without depending exclusively on a mouse or visual color cues.
1. Centralized Focus Owner: Focus state must be managed via `FocusManager` and explicit focus scopes (`application`, `dialog`, `menu`, `contextmenu`, `commandpalette`, `quickopen`, `settings`, `terminal`, `editor`, `explorer`, `problems`).
2. Focus Restoration: Opening transient overlays (dialogs, menus, palettes) must record previous focus and restore it safely on exit. If target elements unmount, fallback gracefully without throwing or leaving orphaned focus targets.
3. Modal Containment Without Traps: True modal dialogs must trap focus safely using `FocusTrap` with Escape dismissal and wrap-around cycling. Non-modal surfaces must never arbitrarily trap keyboard navigation. Never automatically steal focus during background async operations.
4. Input Field Protection: Text entry inside inputs and textareas must remain protected. Native editing keys (`Mod+A`, `Mod+C`, `Mod+V`, `Mod+X`, `Mod+Z`, `Mod+Y`) must be left to the browser and never intercepted by editor buffer commands.
5. Non-Color Redundancy: Color must never be the sole indicator of state (errors, warnings, Git status, dirty tabs, task failures, selection, or focus). Always accompany colors with semantic icons, text badges, or descriptive ARIA labels.
6. Visible Focus Rings: Never remove focus indicators (`outline: none` is forbidden without visible replacement). Visible focus must use high-contrast `:focus-visible` styling compatible with light and dark themes.
7. Semantic Controls & Roving Tabindex: Use native HTML elements or correct ARIA roles (`role="tablist"`, `role="tab"`, `role="tree"`, `role="treeitem"`, `role="separator"`). Composite widgets must implement roving tabindex or arrow navigation. Positive `tabindex` values (> 0) are strictly forbidden.

## RULE 39 — RESPONSIVE LAYOUT, PANEL RESIZING & UI DENSITY DISCIPLINE
Responsive workspace and adaptive layout behavior must preserve the developer editing experience across window dimensions, monitor resolutions, and display scaling:
1. Editor Area Protection: The primary code editor is the central workspace priority. Sidebars and secondary panels must never expand so far as to occlude or compress the editor beneath minimum usable bounds (min editor width: 300px, min editor height: 150px).
2. Centralized Layout State: Layout state (sidebar width, panel height, density, visibility) must be managed centrally via `LayoutService` / `ShellContext`. Child components, widgets, or third-party plugins must NEVER manipulate global workspace dimensions directly or inject arbitrary inline styles.
3. Dimension Validation & Clamping: All dimensions (sidebar width: 160px–500px, panel height: 120px–600px) must be validated (`Number.isFinite`, within boundaries) before committing or persisting. Out-of-bounds, negative, or corrupted dimensions must fall back gracefully to standard defaults.
4. Non-Disruptive Resizing: Dragging splitters must remain fluid and lightweight. Expensive background scans, Git refreshes, File Explorer rebuilds, terminal restarts, or editor re-instantiations must NEVER be triggered during drag operations.
5. Accessible Resizer Controls: All layout splitters and resize handles must expose proper accessibility semantics (`role="separator"`, `aria-orientation`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`) and support full keyboard adjustment (Arrow keys, Home, End).
6. UI Density Preservation: UI density modes (`comfortable` vs `compact`) must adjust spatial padding and structural tokens (`--header-height`, `--statusbar-height`, `--tab-height`) without sacrificing text legibility, touch/pointer target accessibility, or focus indicators.
7. Semantic Stacking (Z-Index Tokens): Arbitrary `z-index: 999999` numbers are strictly forbidden. All overlays, popovers, menus, dialogs, and toolbars must consume standardized design tokens (`--z-base` through `--z-tooltip`).

## RULE 40 — COMPONENT LIBRARY & UI INTERACTION DISCIPLINE
All user interface development across QM Editor must consume the centralized, reusable UI component library (`src/components/common/`):
1. Single Component Source: Never create duplicate `Button`, `IconButton`, `Input`, `Select`, `Toggle`, `Badge`, `Card`, or `Dialog` implementations. Always import and use standardized primitives and composites from `src/components/common`.
2. Native HTML Semantics: Always prefer native HTML controls (`<button>`, `<input>`, `<select>`) over arbitrary `<div role="button">` constructs.
3. Separation of Concerns: Primitives must remain strictly presentational. Business logic, filesystem I/O, process execution, and document buffers must NEVER be placed inside primitive components.
4. Accessible Form Association: Form controls must be wrapped in `FormField` to guarantee deterministic and accessible `label`, `description`, and `error` associations (`htmlFor`, `aria-describedby`, `aria-invalid`).
5. Non-Color Redundancy: Status badges and state indicators must never rely exclusively on color. Always provide textual labels, semantic icons, or accessible symbols (`✓`, `●`, `✕`, `⚠`).
6. Standard Interaction States: All interactive components must implement standardized states (default, hover, focus-visible, active/pressed, disabled, loading, error, warning) using design system CSS custom properties.
7. Design Token Compliance: Component styles must consume design tokens (`--bg-*`, `--border-*`, `--text-*`, `--radius-*`, `--z-*`) rather than hardcoded hex codes, pixel margins, or ad-hoc overrides.

## RULE 41 — WELCOME EXPERIENCE, START CENTER & EMPTY-STATE DISCIPLINE
The Welcome Experience, Start Center, and empty-state system must adhere to strict architectural, security, and UX standards:
1. Welcome Surface Separation: The Start Center is a pure UI surface and NEVER an editable document. It must not register into `DocumentRegistry`, create dirty buffer states, intercept file saves, or masquerade as a text tab.
2. Semantic State Differentiation: UI states must communicate ground truth accurately. Never conflate or mask states:
   - Empty ≠ Loading (show spinner/progress while data is resolving; never show empty).
   - Empty ≠ Error (failures must display factual error messages and retry actions, never 'no data').
   - Empty ≠ Unavailable (plainly communicate when a tool or service is disabled).
   - No Results ≠ Error (zero query matches indicate absence of results for that query, not failure).
3. Recent Workspaces Safety & Privacy: Removing an item from recent workspace history clears only the local metadata entry. It must NEVER delete, unlink, or alter physical directories or files on the filesystem. Recent workspace paths are strictly local and must never be sent to external networks or telemetry.
4. Canonical Command Delegation: Start Center actions (Open Folder, New File, Open File, Command Palette, Settings) must route through canonical commands in `CommandRegistry` and existing platform services. Direct filesystem I/O, process spawning, or custom file-open logic inside Welcome components is strictly forbidden.
5. Zero Startup Burden: Displaying the Start Center must remain instantaneous. Never perform background filesystem crawls, Git operations, process spawns, or heavy language service initializations merely to render the Welcome screen.
6. Reusable Empty States: All feature panels, sidebars, and overlays must consume the reusable `EmptyState` component primitive rather than inventing one-off custom markup.
7. Accessible & Responsive Navigation: The Start Center must provide clear heading hierarchy (`h1`, `h2`), semantic regions, keyboard tab stops, visible focus outlines, and responsive reflow across all supported viewport dimensions without horizontal clipping.

## RULE 42 — DESIGN SYSTEM, VISUAL CONSISTENCY & THEME HARDENING DISCIPLINE
Phase 03 establishes the permanent UI/UX and Design System foundation for QM Editor. All subsequent development must adhere to this unified foundation:
1. Design Token Centralization: All components, panels, overlays, and dialogs must strictly consume CSS design tokens defined in `src/index.css` (semantic background layers `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-card`, `--bg-input`, border layers, text layers, accent layers, state colors, spacing scale `--space-*`, radius scale `--radius-*`, and z-index tokens `--z-*`). Ad-hoc literal hex codes (`#1e1e2e`, `#334155`), arbitrary pixel margins, or bespoke component tokens are strictly forbidden.
2. Complete Theme Symmetry: Every component and surface must be tested and visually verified in both Dark and Light themes. Never assume dark theme fallbacks or write dark-only CSS. Light theme must maintain crisp contrast, legible text, and distinct panel borders without washed-out text or dark purple card artifacts.
3. Component Family Resemblance: Always reuse canonical primitives from `src/components/common` (Button, IconButton, Input, Select, Toggle, Card, Panel, Dialog, List, EmptyState, ErrorState). Do not invent redundant button styles, custom modal overlays, or ad-hoc dialogs.
4. Interaction State Matrix: Interactive controls must provide predictable visual feedback across all states (Default, Hover, Focus-Visible, Active/Pressed, Selected, Disabled, Loading, Error, Warning). Never remove focus rings without an approved accessible replacement.
5. Calm Editor Surface: The code editor is the visual center of the application. Toolbars, sidebars, status bars, and notifications must remain visually subdued and must never distract or compete with source code rendering.
6. Zero Network Dependencies for UI: The design system, fonts, icons, and themes are strictly local. Loading remote stylesheets, web fonts, or CDN assets at runtime is strictly forbidden.
7. Architectural Phase Boundary: The UI/UX foundation is hardened and consolidated at Phase 03. Future phases (Phase 04+) must build core application engine, project, and runtime capabilities on top of this established UI without redesigning the interface or introducing cosmetic refactoring churn.

## RULE 43 — CORE APPLICATION RUNTIME, SERVICE LIFECYCLE & DEPENDENCY DISCIPLINE
Phase 04 establishes the core engine room, application runtime, and service lifecycle management for QM Editor. All services and runtime operations must adhere to strict lifecycle architecture:
1. Explicit Dependency Declaration: Services must explicitly declare their prerequisites in `dependencies`. Never rely on implicit import ordering or hidden global singletons. Circular dependencies are strictly forbidden and deterministically fail startup validation.
2. Controlled Service Registration: Service registration is strictly internal and application-controlled. Workspace files, project configuration, or user content must NEVER be permitted to dynamically inject or register executable runtime services.
3. Explicit Readiness & Health: No service is considered ready merely because its JavaScript object exists. Services must define explicit `initialize()` hooks and publish operational health (`healthy`, `degraded`, `unavailable`, `failed`).
4. Fault Isolation Guarantee: Services are classified as `critical` or `optional`. An optional service failure (e.g. Git, Terminal backend, Task runner) must NEVER prevent the code editor from launching and operating. Core editing, File Explorer, and document operations must remain 100% functional in degraded mode.
5. Deterministic Rollback & Idempotent Cleanup: If a critical service fails during startup, the runtime must roll back already-initialized services in reverse topological dependency order. All `dispose()` hooks must be idempotent and must never throw on repeated calls.
6. Generational Workspace Isolation: Application lifecycle (`start`, `ready`, `shutdown`) and workspace lifecycle (`open`, `change`, `close`) are strictly separated. Switching workspaces must increment `workspaceGeneration` and reset workspace-scoped services without restarting the application runtime. Asynchronous operations must reject stale generation tokens.
7. Safe Shutdown Ordering: Application shutdown must dispose services in reverse topological order, terminate external child processes (terminals, tasks), release file watchers and timers, and enforce safe timeout protection against hanging services.

## RULE 44 — WORKSPACE & PROJECT CONTEXT ENGINE DISCIPLINE
Phase 04 Step 30 establishes the permanent Workspace & Project Context Engine for QM Editor. All workspace, project, and resource operations must adhere to this unified foundation:
1. Single Authoritative Identity: `WorkspaceEngine` is the sole authority for active workspace state, identity, roots, and lifecycle. Domain services (File Explorer, Search, Quick Open, SCM, Tasks, Settings, Terminal) must never maintain competing definitions of active workspace identity.
2. Canonical Boundary & Traversal Protection: Resource membership must strictly use centralized path logic (`WorkspaceResourceBoundary.isResourceInRoot`). Naive prefix comparisons (e.g. `path.startsWith(root)`) that cause directory collision bugs (e.g. `C:\project` matching `C:\project-other`) and relative path traversal attacks (`../`) are strictly forbidden.
3. Serialized Transitions & Transaction Switches: Workspace open, switch, and close transitions are protected by transition mutex locks. Transitions behave as transactions: if new workspace preparation or validation fails, the previous workspace remains active and untainted.
4. Generational Stale Result Invalidation: All workspace-scoped asynchronous operations (search jobs, Git refreshes, task enumerations, resource indexing) must capture `WorkspaceRequestContext` and validate generation tokens before committing results. Stale results from a previous workspace must be discarded immediately.
5. Unsaved Document Protection: Workspace switches and closes must never silently discard unsaved buffer edits. Transitions must verify document dirty states and trigger appropriate confirmation or blocking errors unless explicitly forced.
6. Execution Isolation: Workspace configuration files (e.g., settings, task configs) must be treated as data metadata, not executable code. Workspace configuration must never trigger hidden command execution or register dynamic runtime services.
7. Architectural Separation: The distinction between Application, Workspace, Repository, Project, Filesystem Root, and Document must remain inviolate.

## RULE 45 — EDIT TRANSACTIONS, CHANGE EVENTS & REVISION DISCIPLINE
Phase 04 Step 31 establishes the permanent Edit Transaction & Revision Consistency subsystem for QM Editor. All document text mutations and edit workflows must adhere to this unified foundation:
1. Structured Transaction Invariants: Document modifications must be expressed as structured `EditTransaction` objects with explicit base revisions and range-checked `SingleTextEdit` changes.
2. Reverse Offset Execution: Multi-cursor and multi-edit batches must always execute in reverse offset order (descending by start offset) to ensure that prior offsets remain mathematically valid as text shrinks or expands.
3. Overlap Prohibition: Interleaved or overlapping edit ranges within the same transaction are strictly forbidden and must be rejected before mutation occurs.
4. Monotonic Revisioning: Every modifying transaction strictly increments `contentRevision`. Zero-change operations must preserve the current revision without spurious dirty flag toggling.
5. Save/Undo Symmetry: Dirty states are strictly derived from `contentRevision !== savedRevision`. Undoing edits back to the exact saved revision must restore `isDirty = false`.
6. IME Composition Isolation: Input Method Editor (IME) composition sessions must track composition boundaries and preserve character stream integrity without emitting corrupted intermediate undo checkpoints.
7. Event-Driven Observability: Downstream listeners (diagnostics, search, breadcrumbs, minimap) must listen to canonical `document.transactionApplied` events rather than polling buffer text.

## RULE 46 — FILESYSTEM WATCHERS & EXTERNAL CHANGE RECONCILIATION DISCIPLINE
Phase 04 Step 32 establishes the permanent Filesystem Watcher and External Change Reconciliation subsystem for QM Editor. All filesystem monitoring, event handling, and document state synchronization must adhere to this foundation:
1. Canonical Ownership: `FileSystemWatcherService` is the single authoritative manager for filesystem subscriptions and external change reconciliation. Ad-hoc `setInterval`, manual watcher loops, or fragmented polling systems across components are strictly forbidden.
2. Event Coalescing & Debouncing: All incoming raw filesystem events must pass through `EventCoalescer` with debouncing and state folding (e.g., create + modify -> create; create + delete -> absorbed). Raw bursts from compilers or VCS must never trigger unbounded subscriber invocations.
3. Echo Suppression Invariant: Internal application writes (via `FileService.writeFile`) must register an internal write window via `recordInternalWrite()`. The watcher must never misinterpret the editor's own saves as external modifications.
4. Unsaved Buffer Inviolability: When an external modification occurs on an open file whose buffer has unsaved changes (`isDirty === true`), the system must NEVER overwrite local text silently. It must preserve the user's edits, raise `watcher.conflictDetected`, and require explicit user resolution (`keep_local` or `revert_disk`).
5. Generational Stale-Event Discarding: Watcher events carry `workspaceGeneration`. When a workspace is closed or changed, in-flight events from older generations must be discarded immediately without mutating active workspace state, and stale subscriptions must be disposed.
6. Exclusion Filtering: Watchers must ignore universal ignored directories (`.git`, `node_modules`, `dist`, `.cache`, `coverage`, `.DS_Store`) and honor subscription-specific exclusion patterns to prevent CPU and memory degradation.
7. Idempotent Cleanup: All watcher subscriptions return disposable unwatch handles. Disposing the watcher service must release all timers, clear pending event queues, and purge subscription tables without leaking resources or throwing errors.

## RULE 47 — UNDO/REDO HISTORY, EDIT GROUPING & INVERSION DISCIPLINE
Phase 04 Step 33 establishes the permanent Document History, Undo/Redo, and Edit Grouping subsystem for QM Editor. All document history management, transaction inversions, and state restorations must adhere to this foundation:
1. Canonical History Ownership: `DocumentHistoryService` is the single authoritative manager for document-level undo and redo stacks. Independent ad-hoc history arrays or competing undo implementations across components are strictly forbidden.
2. Exact Mathematical Inversion: Every committed transaction must generate its inverse via `createInverseTransaction` with cumulative offset tracking. Inverting forward edits must mathematically reconstruct exact previous content without character drift or data corruption.
3. Save/Undo Symmetry Invariant: Document dirty state is strictly derived from `contentRevision !== savedRevision`. When an undo operation returns the document to its saved revision, `isDirty` MUST automatically evaluate to `false`. Redoing away from the saved revision MUST restore `isDirty = true`.
4. Multi-Cursor Coordinate Preservation: Multi-cursor transactions must preserve all cursor head and anchor coordinates (`selectionsBefore` and `selectionsAfter`). Undo operations must restore exact `selectionsBefore` across all active cursors.
5. Atomic Edit Grouping: Batch edits (e.g. Find & Replace All, macros, formatting) and contiguous typing bursts must be grouped atomically into `EditGroup` units. An undo request must roll back all grouped entries in reverse chronological order in a single atomic operation.
6. Redo Invalidation on Forward Edits: Pushing any fresh forward edit (origin other than `'undo'` or `'redo'`) must immediately clear the document's redo stack.
7. Bounded Memory & Document Scoping: History stacks must be strictly bounded per document (`maxDepth`, default 500) to protect memory. When documents are closed, their history stacks must be explicitly disposed via `disposeDocument()`.

## RULE 48 — DIAGNOSTICS MODEL, AGGREGATION & EDITOR INTEGRATION DISCIPLINE
Phase 04 Step 34 establishes the permanent Diagnostics Model, Aggregation, and Editor Integration subsystem for QM Editor. All diagnostic reporting, problem management, and editor squiggle presentation must adhere to this unified foundation:
1. Canonical Aggregator Ownership: `DiagnosticService` is the single authoritative manager and aggregator for all document diagnostics across the application. Fragmented or ad-hoc diagnostic arrays scattered across components are strictly forbidden.
2. Producer Isolation (`DiagnosticCollection`): Every producer (linters, language servers, compilers, task runners, syntax checkers) must operate through its own named `DiagnosticCollection`. Mutating or clearing diagnostics in one collection must NEVER overwrite or delete diagnostics belonging to other producers on the same document URI.
3. Strict Range & Coordinate Normalization: All diagnostic ranges must use 1-based line and column numbers. Any incoming range must be validated through `validateAndNormalizeRange` to clamp negative, inverted, or out-of-bound coordinates gracefully without UI exceptions.
4. Logical Severity & Position Sorting: Aggregated diagnostics for documents and views must always be sorted deterministically: ascending by line, ascending by column, and then by severity priority (`error` > `warning` > `info` > `hint`).
5. Unified Problems Panel & Bidirectional Bridges: The Problems panel must present a unified view of compiler/task problems and live diagnostic service collections via `problemToDiagnostic` and `diagnosticToProblem` without duplicate entries or state divergences.
6. Synchronized Editor Squiggles: CodeMirror editor surfaces must reflect live diagnostics as styled wavy decorations (`.cm-diagnostic-error`, `.cm-diagnostic-warning`, `.cm-diagnostic-info`, `.cm-diagnostic-hint`) with accessible tooltips and character-offset mapping derived from document line structures.
7. Workspace Observability & Lifecycle Cleanup: The status bar and secondary panel must display real-time error and warning totals derived from `DiagnosticSummary`. When documents are closed or workspaces switched, document-scoped and workspace-scoped collections must be cleared cleanly without leaking memory or orphaned listeners.

## RULE 49 — SYMBOL INFRASTRUCTURE, OUTLINE & NAVIGATION DISCIPLINE
Phase 04 Step 35 establishes the permanent Symbol Infrastructure, Outline, and Symbol Navigation subsystem for QM Editor. All document and workspace symbol indexing, hierarchical outline trees, and symbol navigation must adhere to this unified foundation:
1. Canonical Symbol Service Ownership: `SymbolService` (`globalSymbolService`) is the single authoritative manager for document symbol indexing, workspace symbol search, and provider coordination. Fragmented symbol extraction or ad-hoc outline parsers scattered across components are strictly forbidden.
2. Revision-Keyed Document Indexing: Document symbols must be cached keyed by `contentRevision`. When an open document's revision changes, its cached symbols are invalidated. When unchanged, queries must immediately return cached symbol trees without redundant parsing.
3. Multi-Language Structural Normalization: All symbols must normalize to canonical `DocumentSymbol` / `WorkspaceSymbol` contracts with 1-based line/column coordinates, typed `SymbolKind` (class, interface, method, function, variable, enum, heading, etc.), and hierarchical nested children for structured containers.
4. CancellationToken & Responsive Cancellation: All asynchronous symbol queries and searches must accept a `CancellationToken`. Asynchronous extractors and workspace scans must honor cancellation signals proactively, releasing worker cycles without blocking UI responsiveness.
5. Generational Stale-Result Guards: Symbol query dispatchers and UI quick-open dialogs must track monotonically increasing `querySequence` identifiers. Stale or out-of-order asynchronous responses returning from prior keystrokes must be discarded immediately without mutating UI state.
6. Unified Quick Navigation & Outline Integration: Symbol navigation modals must support both active document symbol lookup (`@`) and workspace symbol search (`#`) with keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`) and symbol kind badge indicators. The primary sidebar Outline panel must reflect the active document's structural hierarchy and highlight the symbol enclosing the active cursor position.
7. Lifecycle Cleanup & Failure Resilience: All query promises, listeners, and cancellation sources must be safely cleaned up on modal dismissal, editor document closure, or workspace switching. Provider extraction errors must be handled gracefully without crashing navigation or clearing unrelated document indexes.

## RULE 50 — DOCUMENT ENGINE, RESOURCE LIFECYCLE & CROSS-SERVICE SYNCHRONIZATION DISCIPLINE
Phase 04 Step 36 establishes the permanent Document Engine, Resource Lifecycle, and Cross-Service Document Coordination subsystem for QM Editor. All document models, open resource lifecycles, and buffer synchronizations must adhere to this unified foundation:
1. Canonical Document Engine Ownership: `DocumentEngine` (`globalDocumentEngine`) is the single authoritative manager for open-document lifecycle, resource identities, in-memory buffer state, and cross-service coordination. Competing document registries or ad-hoc document managers scattered across components are strictly forbidden.
2. Distinct Document and Resource Identities: Runtime `documentId` (`doc-...`) must remain strictly distinct from external `resourceUri` (`file:///...`, `browser-fs://...`, `untitled:...`) and display titles. Documents can change resource bindings (Save As, rename) without altering document identity or losing in-memory history.
3. Duplicate Open Prevention: Opening an existing resource through any entry point (File Explorer, Quick Open, Search, Command Palette, Recent Files) must activate the existing document instance rather than spawning duplicate document records.
4. Revision-Safe Save Invariant: Every document edit increments `contentRevision`. Saving captures a target `persistingRevision`. Upon confirmed write completion, `isDirty` is evaluated strictly as `contentRevision !== savedRevision`. If the user continues typing while a save is in-flight (`contentRevision > persistingRevision`), the document MUST remain dirty.
5. Inviolable Conflict Boundary: External filesystem modifications must be evaluated against active buffer dirty states. If an open document has unsaved local changes (`isDirty === true`), the system must NEVER overwrite local text or disk files silently. It must raise `document.conflictDetected` and preserve user edits until explicitly resolved (`keep_local` or `revert_disk`).
6. Content Privacy & Safe Disposal: Document contents, passwords, or secret buffers must never be logged or serialized in event payloads. When documents are closed, their history stacks, diagnostics, and cached resources must be safely released without memory leakage.
7. Workspace Coordinated Transitions: Workspace switches and closures must coordinate through `DocumentEngine.hasUnsavedChanges()` and `getDirtyDocuments()` to protect against accidental data loss before disposing resources.

## RULE 51 — EDITOR ENGINE COORDINATION, TEXT MODEL TRANSACTIONS & EDITING STATE DISCIPLINE
Phase 04 Step 37 establishes the permanent Editor Engine Coordination, Text Model Transactions, and Editing State subsystem for QM Editor. All editor instances, text models, view states, and programmatic text modifications must adhere to this unified foundation:
1. Controlled Coordination Boundary: `EditorCoordinationService` (`globalEditorCoordinationService`) is the single authoritative coordination layer between `DocumentEngine`, visual editor adapters (`CodeMirrorEditorAdapter`), text models, view states, and programmatic editing transactions. Direct ad-hoc mutations of editor instances or CodeMirror views from arbitrary UI components or tools are strictly prohibited.
2. Single Canonical Text Model: The editor text model (`TextModelImpl`) wraps `DocumentRecord.content` directly without duplicating text buffers in JavaScript memory. Coordinate transformations (line/column <-> offset) and line counting are calculated on demand.
3. Inviolable Native Undo Stack: The application MUST NEVER create a second undo/redo stack. CodeMirror 6's native history remains authoritative. Programmatic edits must be dispatched as single atomic ChangeSets grouping multiple operations into exactly one undo entry.
4. Programmatic Edit Transactions (`ProgrammaticEditTransaction`): All programmatic changes (Search & Replace, Multi-File Replace, formatters, code actions) must be dispatched through `EditorCoordinationService.applyTransaction()`. Every transaction must validate document existence, read-only status (`doc.metadata.isReadOnly`), conflict status (`doc.metadata.hasConflict`), and bounds.
5. Stale Revision Invariant: If a transaction specifies an `expectedRevision`, it MUST be rejected immediately with status `'stale'` if `expectedRevision !== doc.contentRevision`. Programmatic changes computed against older document revisions may never silently overwrite newer user edits.
6. View State Isolation & Clamping: Cursor position, multi-selection ranges, and scroll positions belong strictly to ephemeral `EditorViewState`, not the core `DocumentRecord`. View states are isolated per `documentId` and MUST be clamped against document line structures and total character bounds on restoration to prevent crashes.
7. Privacy & Security: Document buffers, replacement strings, and user input are strictly prohibited from being logged, traced, or included in event payloads. Transaction logs record only document IDs, revision numbers, operation counts, and source origins.

## RULE 52 — FILE WATCHING, EXTERNAL CHANGE DETECTION & RESOURCE SYNCHRONIZATION DISCIPLINE
Phase 04 Step 38 establishes the permanent File Watching, External Change Detection, and Resource Synchronization subsystem for QM Editor. All filesystem monitoring, external change detection, and cross-service resource synchronizations must adhere to this unified foundation:
1. Centralized Watcher Authority: `FileSystemWatcherService` is the sole application-level authority responsible for filesystem observation and native watcher handles. No feature, panel, or UI component may create an independent workspace filesystem watcher without explicit architectural approval.
2. Duplicate Watcher Prevention: Watching a folder, file, or subpath inside an already-watched workspace root MUST reuse the existing watcher root registration and increment its reference count. Redundant native watchers must never be spawned.
3. Raw Event Isolation: Raw OS filesystem events must never be exposed directly to UI components. All events must be normalized, coalesced, and classified by `ResourceSynchronizationService` before reaching application consumers.
4. Dirty Buffer Inviolability: When an external modification occurs on an open document whose buffer is dirty (`isDirty === true`), the system must NEVER silently overwrite in-memory user work. It must preserve local edits, record conflict metadata (`hasConflict: true`, `externallyModified: true`), surface a non-intrusive warning via `FeedbackService`, and emit `synchronization.conflictDetected`.
5. Authoritative Subsystem Boundaries: `FileWatchService` is the observation authority, `DocumentEngine` remains the authoritative owner of document lifecycle, revision, and content state, and `EditorCoordinationService` remains authoritative for editor view state, cursors, and visual rendering.
6. Workspace Boundary Enforcement: Every watch registration and filesystem event must be normalized and validated against the active workspace root. Path traversal attempts (`../`) and unauthorized locations outside the workspace root must be rejected immediately.
7. Generational Stale-Event Discarding: Events carrying an older `workspaceGeneration` (`generation < currentGeneration`) must be discarded without mutating active documents or workspace state.
8. Workspace Lifecycle Binding: All watcher roots and subscriptions are strictly workspace-owned and MUST be cleanly disposed upon workspace closure or switching.
9. Privacy & Zero-Content Telemetry: File contents and sensitive paths must never be logged, captured in diagnostic events, or transmitted to telemetry.
10. Feedback & Accessibility: External change and conflict workflows must use existing `FeedbackService` notification mechanisms and accessible live regions without stealing focus or interrupting active user typing.
## RULE 53 — UNDO/REDO INTEGRATION, EDIT HISTORY INTEGRITY & TRANSACTION SAFETY DISCIPLINE
Phase 04 Step 39 establishes the permanent Undo/Redo Coordination and Edit History Integrity subsystem for QM Editor. All editor operations, history queries, commands, programmatic edits, and synchronization lifecycles must adhere to this unified foundation:
1. Single Authoritative Text History Owner: The visual Editor Engine (`CodeMirror 6`) is the sole authoritative owner of the in-memory text buffer undo and redo history. The application layer coordinates history, rather than duplicating it. Creating an application-level snapshot stack (`previousContents[]`, `nextContents[]`) for text buffers is strictly prohibited.
2. Programmatic Edits via Transaction Boundary: All programmatic text mutations (Replace, Replace All, Search & Replace, Formatters, Refactorings, AI actions) must pass through `EditorCoordinationService.applyTransaction(...)`. No feature may mutate editor text buffers through an uncoordinated side-channel.
3. Monotonic Document Revisions: Document revisions (`contentRevision`) represent application-level mutation counters that increment strictly monotonically ($N \to N+1$). Undoing or redoing an edit produces a new, higher document revision rather than rolling back the integer counter. Revisions are mutation history counters, not file snapshot pointers.
4. Baseline-Compared Dirty State: A document's `isDirty` state is derived by comparing current buffer content against `savedBaselineContent`. If an undo operation returns the document text to exact equality with `savedBaselineContent`, `isDirty` MUST evaluate to `false`. Conversely, undoing past a save point where content differs from the newly saved baseline MUST evaluate to `isDirty = true`.
5. Save Operation Invariant: Saving is a resource-level persistence operation, not a text edit. Successful save updates `savedBaselineContent` and `savedRevision` and resets `isDirty = false`. A save operation MUST NEVER push an entry onto the undo/redo stack. Failed saves must leave `isDirty = true` and keep undo history intact.
6. Multi-Edit Atomic Grouping: Composite programmatic edits affecting multiple non-overlapping spans (e.g. Replace All) must be dispatched to the editor model as a single atomic transaction. The user must be able to undo the composite operation in exactly one undo step.
7. Absolute Multi-Document Isolation: History belongs strictly to the individual document's editor model. An undo or redo command in Document A must NEVER alter or access Document B. Tab switching must dynamically evaluate the active document's history without global caching.
8. Model Lifecycle Protection: When an editor instance or document model is disposed, all history operations targeting it must be safely rejected (`canUndo` and `undo` return `false`). Stale references or late async callbacks must never mutate unmounted or closed documents. True model closure must not leave lingering history references.
9. Destructive Reload History Invalidation: When a clean document is reloaded with external content during filesystem synchronization, native editor history must be immediately cleared (`globalEditorCoordinationService.clearHistory(doc.id)` and `globalDocumentHistoryService.clear(doc.id)`). Stale pre-reload undo operations must never be permitted to reverse or corrupt externally synchronized content.
10. Centralized Command Registration: The Undo (`Mod+Z`, `editor.undo`, alias `edit.undo`) and Redo (`Mod+Y`, `editor.redo`, alias `edit.redo`) commands must be centrally registered in `CommandRegistry`. Keyboard shortcuts, menus, context menus, and the Command Palette must execute through this single command boundary. Read-only documents must strictly enforce `canExecute = false` and reject undo/redo.
11. Privacy & Zero-Content Telemetry: Reversible history entries can contain sensitive document data. Document history buffers must never be logged, serialized to telemetry, or transmitted over remote interfaces.

## RULE 54 — CENTRALIZED DIAGNOSTICS, PROBLEMS & ISSUE LIFECYCLE DISCIPLINE
Phase 04 Step 40 establishes the permanent Diagnostics, Problems, Markers, and Issue Lifecycle Engine for QM Editor. All diagnostic producers, issue markers, editor squiggles, task problem matchers, and problems presentations must adhere to this unified foundation:
1. Centralized Diagnostics Engine Ownership: `DiagnosticService` (`globalDiagnosticService`) is the single authoritative manager for diagnostic state, collections, querying, and lifecycle aggregation. Subsystems, plugins, or tools must NEVER create independent problem registries or global problem lists.
2. Absolute Provider Ownership: Diagnostic producers own strictly their own diagnostics within a dedicated, named `DiagnosticCollection`. A provider must NEVER clear, overwrite, or mutate another provider's diagnostics.
3. UI Components as Pure Consumers: Problems panel, status bar, and File Explorer components must NEVER act as diagnostic stores. They consume projections and aggregated state from the Diagnostics Engine and dispatch user actions through standard command and navigation interfaces.
4. Generation-Safe Results: All diagnostic updates must support generation guards (`options.generation`). Slower asynchronous provider operations with older generations MUST be rejected immediately when newer analysis has already taken effect.
5. Document Revision Awareness: Document-scoped analysis diagnostics must specify and validate `options.documentRevision`. If the user continues typing and the document content revision advances before an asynchronous analysis completes, the stale result MUST be rejected.
6. Stale Task Run Isolation: Repeated task executions (e.g. Build Run 101 vs Run 102) must assign monotonic run generations. Slower delayed outputs from prior task runs MUST NEVER overwrite newer task run results.
7. Derived Editor Squiggles & Markers: Editor squiggles and text annotations must remain pure projections of the Diagnostics Engine. The Editor Engine must never independently calculate, store, or cache diagnostic authority.
8. Decoupled Task Diagnostics Flow: Tasks and problem matchers must flow parsed problems through the `TaskDiagnosticProvider` and `DiagnosticService`. The Task Engine remains the process execution authority; the Diagnostics Engine remains the diagnostic state authority.
9. Resource-Level & Optional-Range Integrity: Configuration errors, missing dependencies, and folder-level problems that have no source range must keep `range` optional (`undefined`). Coordinate values (lines/columns) must NEVER be fabricated for range-less issues.
10. Privacy & Sanitized Logging: Diagnostic messages, rule codes, and related information must remain strictly local. Source code snippets, file contents, passwords, and sensitive environment variables must NEVER be logged, serialized, or transmitted to telemetry.
11. Document Close vs Delete Boundary: Diagnostics represent resource and project state. Closing an editor tab removes visual editor decorations with the model, but valid provider diagnostics MUST NOT be deleted merely because a tab is closed. Only explicit resource deletion (`handleResourceDeleted`) cleans up resource diagnostics.

## RULE 55 — CODE NAVIGATION, SYMBOLS, LOCATIONS & OUTLINE ENGINE DISCIPLINE
Phase 04 Step 41 establishes the permanent Code Navigation, Symbol, Location, and Outline Engine for QM Editor. All structured navigation, symbol producers, outline consumers, and location models must adhere to this unified foundation:
1. Canonical Location Authority: All structured navigation targets and code references must use the canonical `Location` and 1-based `Range` models (`src/core/navigation/LocationTypes.ts`). Inventing feature-specific location, range, or coordinate schemes is strictly prohibited.
2. Single Navigation Coordinator: `NavigationCoordinator` (`globalNavigationCoordinator`) is the sole application-level gateway for navigating to code locations. UI components, commands, search panels, outline trees, and diagnostics must NEVER invoke ad-hoc document opening, editor model lookups, or uncoordinated editor jumps.
3. Centralized Document Resolution: Navigation to unopened resources must pass through the registered opener or `DocumentEngine`. Direct manual filesystem reading or instantiating duplicate document models during navigation is strictly prohibited. If a document is already open, the existing instance MUST be activated.
4. Safe Range Clamping Invariant: When navigating to a range, coordinates must be validated and safely clamped against actual document line counts and line text lengths via `clampRangeToDocument`. Stale or out-of-bounds navigation targets must never trigger exceptions or crash the editor.
5. Monotonic Sequence & Race Protection: All asynchronous navigation operations must validate their monotonic sequence ID. If a newer navigation request begins while an older request is resolving, the older request MUST be discarded immediately with error code `'STALE_REQUEST'`.
6. Workspace Generation Boundary: Navigation operations and symbol queries are strictly bound to active workspace identity. If the active workspace switches while an operation is pending, the operation MUST be aborted with `'WORKSPACE_MISMATCH'` to prevent cross-workspace state contamination.
7. Absolute Symbol Provider Isolation: Each `SymbolProvider` owns strictly its own symbol results. A provider must never overwrite, mutate, or erase another provider's symbols unless explicitly configured as authoritative for that document scope.
8. Document Revision Awareness for Symbols: Symbols derived from document content MUST be associated with `document.contentRevision`. If the document's content revision changes before an asynchronous symbol result completes, the stale result MUST be rejected immediately.
9. Outline UI as Pure Consumer: The Outline Panel is a presentation consumer and MUST NOT become a persistent symbol data store. It derives its hierarchy from `SymbolEngine`, navigates via `NavigationCoordinator`, and maintains distinct loading, ready, empty, and error states.
10. History Integration & Deduplication: Programmatic jumps to meaningful code locations must integrate with `NavigationService`. Consecutive navigation within the line-jitter tolerance threshold (< 5 lines in the same document) must update the current pointer rather than polluting the history back-stack.
11. Shared Navigation Boundary for Diagnostics, Search, and Quick Open: Diagnostics, Problems, Search Results, Quick Open, and Go to Symbol must share the same canonical location and navigation coordination pipeline.
12. Modular Intelligence Boundary: Future language services, LSP implementations, and AI/SLM code intelligence engines must integrate as registered `SymbolProvider` instances rather than creating uncoordinated side-channels or bypassing the core architecture.

## RULE 56 — LANGUAGE INTELLIGENCE & COMPLETION PROVIDER ARCHITECTURE DISCIPLINE
Phase 04 Step 42 establishes the permanent Language Intelligence Provider Architecture and Completion Framework for QM Editor. All language-aware features, suggestion providers, completion engines, and future LSP or AI/SLM integrations must adhere to this unified foundation:
1. Provider Architecture Authority: Language intelligence must use the central `LanguageIntelligenceRegistry` (`globalLanguageIntelligenceRegistry`). Subsystems, plugins, or extensions must NEVER create competing provider registries.
2. Direct Mutation Invariant: Completion providers generate suggestion metadata; they must NEVER mutate editor models, document records, or view states directly.
3. Edit Transaction System Authority: Accepted completions that mutate document content must flow through `EditorCoordinationService.applyTransaction({ source: 'completion' })`. Bypassing the Edit Transaction System or Document Engine is strictly prohibited.
4. Revision & Stale Protection: Completion requests and results are strictly revision-bound. If the user continues typing or the document revision advances while a provider request is pending, the stale result MUST be discarded immediately.
5. Workspace Generation Protection: Completion queries are bound to the active workspace generation. If the active workspace switches while a completion request is resolving, results MUST be discarded without polluting the new workspace.
6. Absolute Provider Isolation: Each provider operates in an isolated failure shield. If one provider throws an unhandled exception or hangs, other providers must continue functioning without crashing the editor host or completion widget.
7. Cooperative Cancellation: Every completion request must pass a `CancellationToken`. Slower providers must check `token.isCancellationRequested` periodically. When a new keystroke occurs, any prior request must be aborted immediately.
8. Read-Only Enforcement: Completion acceptance must strictly respect document capabilities. Applying a completion to a read-only document must be safely rejected without mutating document content or throwing unhandled errors.
9. Native Undo/Redo Integration: Accepted completions must integrate directly into the native editor history stack. No completion-specific undo stack may be created. Undoing a completion must cleanly revert the text edit in a single step.
10. Modular Intelligence Boundary: Future Language Server Protocol (LSP) clients, compiler-backed providers, and AI/SLM assistants must plug in as registered `LanguageIntelligenceProvider` instances without altering the core editor, DocumentEngine, or UI architecture.
11. Security & Content Sanitization: Completion documentation must be rendered safely (plain text or sanitized markdown). Executable scripts, arbitrary HTML, and unapproved command execution are strictly prohibited.
12. Privacy & Zero-Content Telemetry: Source code, cursor context, completion requests, and suggestion lists must NEVER be logged, serialized to telemetry, or transmitted across unauthorized networks.

## RULE 57 — HOVER, SIGNATURE HELP & CONTEXTUAL LANGUAGE INTELLIGENCE DISCIPLINE
Phase 04 Step 43 establishes the permanent Hover Information, Signature Help, and Contextual Language Intelligence Engine for QM Editor. All symbol documentation, parameter hints, type info, and contextual intelligence providers must adhere to this unified foundation:
1. Centralized Language Intelligence Architecture: Hover and Signature Help must strictly use the centralized `LanguageIntelligenceRegistry` (`globalLanguageIntelligenceRegistry`). Subsystems, extensions, or language packs must NEVER create competing hover or signature registries.
2. Direct Mutation Invariant: Hover and Signature Help providers return read-only contextual intelligence; they MUST NEVER mutate editor models, document records, or view states directly, nor create document revisions.
3. Informational Read-Only Status: Informational language intelligence remains fully available in read-only and untitled documents without requiring saved physical files on disk.
4. Revision & Stale Protection: All hover and signature requests are strictly revision-bound. If the user edits the document while an asynchronous provider operation is in-flight, the stale result MUST be discarded immediately upon resolution.
5. Monotonic Generation Guards: Signature Help and Hover requests track monotonic generation counters (`generation`). Slower delayed responses from prior queries MUST NEVER overwrite newer active results.
6. Workspace Generation Boundary: Hover and signature requests are strictly bound to the active workspace generation. Switching workspaces while an operation is pending immediately invalidates the request and prevents cross-workspace data leakage.
7. Absolute Provider Isolation: Each provider executes within an isolated failure boundary. An exception or crash in one provider MUST NEVER crash the editor, freeze the UI, or prevent other providers from returning valid documentation.
8. Cooperative Cancellation: All contextual requests receive a `CancellationToken`. Typing, cursor motion, document closing, or editor blur must immediately abort pending requests.
9. Safe Index Clamping: Signature Help active signature and active parameter indices must be strictly validated and clamped within valid array bounds `[0, length - 1]` to prevent runtime exceptions or UI crashes.
10. Untrusted Documentation Sanitization: All provider-supplied documentation, parameter descriptions, and markup must pass through `ContentSanitizer`. Arbitrary `<script>`, `<iframe>`, inline `on*` event handlers, and unsafe URL protocols are strictly prohibited.
11. Canonical Navigation Integration: Any definition location or navigation target exposed within a hover card must route strictly through `NavigationCoordinator.navigateToLocation()`. Bypassing the navigation pipeline is forbidden.
12. Modular Intelligence Boundary: Future LSP servers, compilers, and AI/SLM assistants must integrate as registered `LanguageIntelligenceProvider` instances declaring `hover` and/or `signatureHelp` capabilities.
13. Privacy & Zero-Content Telemetry: Document text, cursor position, hover requests, signature parameters, and documentation content must NEVER be logged or transmitted over remote telemetry channels.

## RULE 58 — CODE ACTIONS, QUICK FIXES & SAFE CODE TRANSFORMATION DISCIPLINE
Phase 04 Step 44 establishes the permanent Code Action, Quick Fix, and Safe Code Transformation Foundation for QM Editor. All code actions, quick fixes, automated transformations, refactorings, and future LSP/AI code modifications must adhere to this unified foundation:
1. Proposal Authority vs Mutation Authority: Code Action providers propose transformations; they must NEVER directly mutate editor models, document records, view states, or the filesystem.
2. Edit Transaction System Exclusivity: All document mutations resulting from accepted code actions must pass through the authoritative `EditTransactionManager` / `EditorCoordinationService.applyTransaction({ source: 'codeAction' })`. Direct calls to `editor.executeEdits` or raw buffer slicing from UI or providers are strictly prohibited.
3. Double Validation Rule: Code actions must be validated at presentation (applicability check) and revalidated rigorously at execution time (revision check, workspace check, boundary check, read-only check, overlap check).
4. Stale Action Protection: Code actions are strictly revision-bound. If the user edits the document after an action is formulated, attempting to apply the old action must be safely rejected with `'stale'`. Stale transformations must never be applied blindly.
5. Workspace Generation Protection: Actions generated in Workspace A must never execute in Workspace B. Workspace generation mismatch immediately aborts execution with `'workspace_mismatch'`.
6. Non-Mutating Preview Invariant: Preview generation simulates edits purely on read-only in-memory string copies. Previews must NEVER mutate documents, alter dirty state, modify files on disk, or create undo history entries.
7. Read-Only Document Integrity: Code action execution must respect document permissions. Applying an edit action to a read-only document must be rejected without mutating document content or throwing unhandled errors.
8. Native Undo/Redo Integration: Applied code actions must register as standard reversible operations in `DocumentHistoryStack`. Undoing a code action must cleanly revert the text transformation in a single step without custom undo managers.
9. Provider Isolation: Each code action provider executes within an isolated failure shield. A failure or crash in one provider must never crash the host editor or prevent other providers from returning valid actions.
10. Cooperative Cancellation: Code action generation must pass a `CancellationToken`. Moving the cursor, typing, switching documents, or closing tabs must cancel pending requests immediately.
11. Resource Operation Safety: Resource lifecycle operations (create, rename, delete) must route strictly through `FileService` and workspace root boundary validation. Executing arbitrary shell commands or raw OS filesystem mutations is forbidden.
12. Privacy & Zero-Content Telemetry: Document source code, cursor ranges, proposed transformations, and preview contents must NEVER be logged, serialized to telemetry, or transmitted across unauthorized networks.

## RULE 59 — PHASE 04 CORE APPLICATION ENGINE INTEGRATION & HARDENING DISCIPLINE
Phase 04 Step 45 establishes the permanent Core Engine Integration, Authority Matrix, and Reliability Discipline for QM Editor upon completing Phase 04. All current and future systems (including Phase 05 Data Architecture, Phase 06 Advanced Features, and Phase 07 AI/LLM/SLM) must strictly adhere to these unified architectural invariants:
1. One Authority Per State Domain:
   - Application Lifecycle → `ApplicationRuntime`
   - Workspace Context & Generation → `WorkspaceEngine`
   - Document Buffers, Revisions & Dirty State → `DocumentEngine`
   - Text Mutation Authorization → `EditTransactionManager`
   - Filesystem I/O Operations → `FileService`
   - Filesystem Observation → `FileSystemWatcherService`
   - Undo/Redo Stacks → `DocumentHistoryService`
   - Issue Lifecycle & Markers → `DiagnosticService`
   - Document Outline & Symbols → `SymbolService`
   - Spatial Jumps & History → `NavigationCoordinator`
   - Language Providers → `LanguageIntelligenceRegistry`
   - Command Execution & Bindings → `CommandRegistry`
   - User Notifications & Dialogs → `FeedbackService`
   Subsystems, plugins, or extensions must NEVER create competing duplicate authorities for any of these domains.
2. Controlled Mutation Boundary: No UI component, language provider, background watcher, or future AI/SLM assistant may directly mutate document text or disk files. All text mutations must route through `EditTransactionManager` / `EditorCoordinationService.applyTransaction()` with an explicit `TransactionOrigin`.
3. Deterministic Event Sequencing: State-changing events must be emitted only after the underlying state has been validated and committed. Notifications must never precede actual mutation.
4. Double Validation Rule: All asynchronous proposals (code actions, completions, external reloads) must be validated at proposal time and strictly revalidated at execution time.
5. Zero Silent Data Loss: External modifications to dirty documents must trigger non-destructive conflict warnings, preserving local user edits unconditionally.
6. Workspace Boundary Containment: Resource operations and file observation paths must remain strictly within active workspace roots. Path traversals outside workspace boundaries are prohibited.
7. Provider Trust Boundary: All language providers are treated as potentially untrusted and run within isolated `Promise.allSettled` try/catch boundaries. Malfunctioning providers must never crash the editor host.
8. Non-Mutating Information & Previews: Hover cards, signature hints, outline panels, and code action preview diffs must never mutate document buffers, alter dirty flags, write to disk, or create undo history entries.
9. Cooperative Request Cancellation: All asynchronous queries must accept a `CancellationToken`. Rapid cursor movements or typing must abort pending queries immediately.
10. Strict Stop Boundary Discipline: Phase 04 ends at Step 45. Future phases (Phase 05 Data & Storage Architecture, Phase 06 Advanced Features, Phase 07 AI Layer) must build on top of these established core engine boundaries, never around or beneath them.

## RULE 60 — DATA & STORAGE ARCHITECTURE, PERSISTENCE BOUNDARIES & SCHEMA GOVERNANCE DISCIPLINE
Phase 05 Step 46 establishes the permanent Data & Storage Architecture Foundation, Persistence Boundaries, and Schema Governance for QM Editor. All Phase 05 features and future extensions must strictly enforce these storage and persistence invariants:
1. Defined Domain Ownership: Every persisted dataset must have an authoritative domain owner (`SettingsService`, `WorkspaceEngine`, `SessionService`). Storage is durable infrastructure, not a second domain authority.
2. Direct UI Storage Prohibition: UI components (`React`, panels, dialogs) must NEVER access physical storage, database adapters, or `localStorage` directly. All persistence routes through Domain Services and Repositories.
3. Strict Serialization Boundary: Runtime objects (functions, symbols, DOM nodes, CodeMirror editor views, circular structures) must NEVER be passed to persistence. Explicit DTO transformations (`toPersistence()` / `fromPersistence()`) are required.
4. Mandatory Schema Versioning: Every persistent structured dataset must declare a positive integer `schemaVersion` managed by `SchemaRegistry`. Arbitrary untyped blobs are prohibited.
5. Migration Requirement: Schema changes must be accompanied by explicit, ordered migrations in `MigrationRegistry`. Migrations must preserve user data, validate each step, and abort safely without corrupting stored records.
6. Unsupported Schema Downgrades: Schema downgrades are strictly rejected with `StorageMigrationError`. Stored records with higher schema versions must never be silently overwritten or truncated.
7. Local-First & Zero Egress: All storage operations must remain local. No cloud synchronization, remote telemetry databases, or external network data copies are permitted without explicit future architecture and user consent.
8. Secrets & Plaintext Credential Prohibition: Plaintext credentials (passwords, private keys, API secrets, auth tokens) must NEVER be stored in ordinary persistence. `StorageSerializer` actively scans and rejects sensitive keys with `StorageSensitiveDataError`.
9. Cache & Derived Separation: Caches and derived data (search indexes, symbol outlines, completions) must remain discardable, unbacked, and logically separated from durable user state. Caches must never become authoritative user state.
10. Honest Storage Health Reporting: Storage failures, read-only filesystem modes, quota exhaustion, and corruption must be surfaced honestly via `StorageHealthReport`. The system must never silently swallow storage errors or fabricate fake success.
11. Stale Write Protection: Monotonically increasing `recordVersion` and serialized per-key write queues protect against concurrency race conditions. Callers with stale `expectedRecordVersion` must be rejected with `StorageVersionConflictError`.
12. Workspace Partitioning & Isolation: Workspace-scoped storage must be partitioned under `ws:<workspaceId>:<key>`. Workspace A must never read, overwrite, or mutate Workspace B's storage records.
13. No Competing Storage Engines: No subsystem or plugin may create its own ad-hoc persistent storage engine. All durable application and workspace data must integrate through the canonical `StorageService` and `IStorageAdapter` architecture.

## RULE 61 — WORKSPACE PERSISTENCE, METADATA & SESSION STORAGE DISCIPLINE
Phase 05 Step 47 establishes the authoritative Persistent Workspace Metadata, Workspace State, Recent Workspaces, and Safe Workspace Session Storage subsystem for QM Editor. All workspace persistence interactions must strictly uphold these engineering boundaries:
1. WorkspaceEngine Runtime Authority: The Workspace Engine (`WorkspaceEngine`) remains the sole runtime authority for workspace lifecycles, active roots, and generation tracking. Persistent storage is strictly the durable representation used to restore approved state. Storage must never act as a second workspace engine.
2. Single Canonical Workspace Identity: Persistent workspace identity is strictly derived from normalized canonical root URIs (`ws-${normUri...}`). The application must never create or rely on duplicate, competing, or disconnected storage workspace IDs.
3. Strict Boundary Isolation: Workspace A must never load, mutate, or leak session state into Workspace B. During session persistence, open documents outside the active workspace roots must be filtered out immediately.
4. Open File Reference != Unsaved Document Content: Workspace session persistence only remembers open file references and view state coordinates. Unsaved dirty buffer content is NOT claimed to be recovered until Phase 05 document history/crash recovery (Step 48+). Live physical files on disk remain authoritative for file contents.
5. Untitled Document Exclusion: Untitled in-memory buffers without real filesystem paths must be excluded from persistent workspace session storage to avoid creating corrupted or orphaned references on reload.
6. Partial Restoration Resilience: Missing, moved, deleted, or unauthorized session files must be safely skipped during restoration. A failure to restore one file must never crash the session or halt the restoration of remaining valid files.
7. Generational State Protection: Every session restore operation must carry and check the active WorkspaceEngine generation. If a workspace switch or close occurs while asynchronous restoration is in progress, the operation must immediately abort and reject stale results.
8. Controlled Persistence Boundaries: State persistence must occur at designated lifecycle boundaries (workspace open, workspace close, workspace switch, shutdown) and through debounced writes (coalescing rapid sequential tab changes). High-frequency writing on every character or cursor step is strictly prohibited.
9. Bounded Recent Workspaces: Recent workspace history must remain strictly bounded with deterministic MRU ordering and path-based deduplication. Inaccessible or temporarily unmounted workspaces must not cause startup crashes.
10. Explicit Serialization & DTOs: Only serializable DTOs (`WorkspaceMetadataDTO`, `WorkspaceSessionDTO`, `RecentWorkspaceDTO`) may be persisted. Transient runtime objects (editor views, DOM references, event listeners, promises) must never enter persistent storage.

## RULE 62 — DOCUMENT METADATA, RESOURCE STATE & PERSISTENCE FOUNDATION DISCIPLINE
Phase 05 Step 48 establishes the authoritative Persistent Document Metadata, Resource State & Document Persistence Foundation for QM Editor. All document persistence interactions must strictly uphold these engineering boundaries:
1. Filesystem Saved Content Authority: The filesystem remains the sole authoritative source for saved file contents. Persistent metadata is descriptive application knowledge, not a secondary content archive.
2. Document Engine Runtime Authority: The Document Engine (`DocumentEngine`) remains the authoritative owner of runtime document state, revisions, dirty flags, and capabilities. Storage must never become a second Document Engine.
3. Content Serialization Prohibition: Document metadata persistence must NEVER store source code, buffer text, unsaved edits, or snippets. Persistent metadata stores only approved non-content metadata (`languageId`, `encoding`, `lineEnding`, `isReadOnly`, timestamps, size, cursor coordinates).
4. Runtime Object Exclusion: Runtime editor and document objects (CodeMirror instances, DOM references, event subscriptions, promises, cancellation tokens) must NEVER be passed to storage. Only versioned DTOs (`DocumentMetadataDTO`, `ResourceStateDTO`) are permitted.
5. Distinct Identity Triad: `documentId` (runtime-only identifier in `DocumentRegistry`), `resourceUri` (durable canonical resource identifier), and `workspaceId` (containing workspace context) must remain distinct and never collapsed into one.
6. Path & Resource Validation: All persisted paths and resource URIs must be validated through the canonical `ResourceIdentity` and `WorkspaceResourceBoundary` before use. Invalid or out-of-scope paths must be rejected safely.
7. Save Metadata Integrity: Document metadata must only be updated with `lastSavedAt` and refreshed file stats AFTER actual filesystem write success. If save fails, metadata updates must be suppressed; false save success must never be reported.
8. Save As & Rename Migration: When a document is saved as or renamed, metadata must be cleanly migrated from the old to the new URI, and old records must be cleaned up to prevent orphaned duplicates.
9. Watcher-Driven External Reconciliation: External file events (modify, delete, rename) must route through `FileSystemWatcherService` / `ResourceSynchronizationService` into `DocumentEngine`. Persistence must never poll or observe the filesystem directly.
10. Stale Persistence & Race Protection: Optimistic concurrency (`expectedRecordVersion`) and serialized write queues protect against concurrency races. Stale writes must never overwrite newer metadata.
11. No False Recovery Claims: Persistent document metadata does NOT imply unsaved-content recovery or crash recovery. Unsaved content recovery remains a dedicated future subsystem.
12. Versioned Schema Governance: Document metadata and resource state schemas (`qm.document.metadata`, `qm.resource.state`) must be registered with `SchemaRegistry` and evolve strictly via versioned migrations in `MigrationRegistry`.

## RULE 63 — SETTINGS, PREFERENCES & CONFIGURATION PERSISTENCE DISCIPLINE
Phase 05 Step 49 establishes the authoritative Persistent Settings, Preferences and Configuration Storage subsystem for QM Editor. All configuration and preferences persistence interactions must strictly uphold these engineering boundaries:
1. Settings System Configuration Authority: The Settings System (`SettingsRegistry` & `SettingsService`) remains the sole authority for configuration semantics, definitions, defaults, scopes, precedence, types, validation rules, and runtime behavior.
2. Storage Subsystem Persistence Boundary: Storage (`SettingsRepository` & `StorageService`) is strictly the durable persistence mechanism for approved overrides. Storage never determines defaults, precedence, or whether a setting exists.
3. No Private Configuration Silos: No editor feature, language provider, AI system, terminal subsystem, or plugin may create a private `.json` or isolated config store for ordinary configuration. All configuration must register into the unified `SettingsRegistry` and route through `SettingsService`.
4. Persist Overrides, Not Redundant Defaults: Storage persists only explicit overrides (`userSettings`, `workspaceSettings`). Defaults belong strictly to `SettingsRegistry` and are never redundantly stored in persistent records.
5. Validation Precedes Persistence: Setting changes must pass validation (`SettingsService.validateValue()`) against the definition schema before any in-memory state or storage record is updated. Invalid values must be rejected immediately.
6. Stale Write & Concurrency Protection: Stale settings writes must never overwrite newer values. Storage operations utilize monotonic `recordVersion` and `expectedRecordVersion` checks to prevent race conditions.
7. Strict Workspace Context Isolation: Workspace settings are strictly partitioned by canonical workspace ID (`ws:<workspaceId>:settings`). Workspace A overrides must never mutate, contaminate, or leak into Workspace B.
8. Workspace Generation Safety: Asynchronous workspace settings operations carry the active `currentWorkspaceGeneration`. Late responses from previous workspaces must be discarded immediately upon context switch.
9. Plaintext Secrets Prohibition: Sensitive settings (API keys, auth tokens, passwords, credentials) must NEVER be persisted in ordinary plaintext configuration storage. `SettingsService` rejects sensitive writes, redacts sensitive keys from exports, and masks values in logs.
10. Explicit Versioned Migrations: Settings schema migrations must be explicit, versioned (`qm.settings.user`, `qm.settings.workspace`), and registered in `MigrationRegistry`. Loose coercion is forbidden.
11. Unknown & Removed Settings Safety: Unrecognized settings keys from future/external versions must be safely preserved without polluting runtime registered lookups. Removed settings must be cleanly pruned or migrated.
12. Direct UI Storage Prohibition: Settings UI components and modal dialogs must never write directly to storage or `localStorage`. All user interactions must route through `SettingsService.set()`, `setAsync()`, or `reset()`.
13. Zero False Persistence Success: Persistence failures (such as read-only storage or disk write errors) must never be falsely reported as successful configuration changes. `setAsync()` rolls back in-memory state on persistence failure and reports the error honestly.
14. Coalesced Writes & Clean Shutdown: Rapid setting updates (e.g., sliders) must use debounced persistence coalescing. Application shutdown and workspace switches must flush all pending writes via `SettingsService.flush()`.

## RULE 64 — RECENT RESOURCES, NAVIGATION HISTORY & USER ACTIVITY PERSISTENCE DISCIPLINE
Phase 05 Step 50 establishes the authoritative Persistent Recent Resources, Recent Files, Navigation History, and Bounded User Activity State subsystem for QM Editor. All recent resource and navigation history persistence interactions must strictly uphold these engineering boundaries:
1. Navigation System Runtime Authority: The Navigation System (`NavigationCoordinator`, `NavigationService`) remains the sole runtime authority for navigation stacks, active locations, and back/forward semantics. The persistence layer is purely the durable serialization of selected history.
2. No Competing Navigation Managers: Recent-resource persistence must not become a second navigation manager, nor may navigation persistence become a second recent-resource service. UI surfaces must consume runtime navigation and recent services, not direct storage.
3. Bounded Recent Resources: Recent-resource data must remain strictly bounded (default `MAX_RECENT_DOCUMENTS = 20`) with deterministic MRU ordering and deduplication. Unlimited accumulation is forbidden.
4. Bounded Navigation History: Navigation back and forward stacks must remain strictly bounded (maximum 50 entries) to prevent unlimited database growth.
5. Inert Data Prohibition on Execution: Persisted history entries are inert data structures (URIs, line/column coordinates, timestamps) and must NEVER represent executable commands, scripts, or instructions.
6. Canonical Resource & Workspace Identity: Persisted history must identify resources via canonical URIs (`resourceId`) and partition workspace records by canonical workspace ID (`ws:<workspaceId>:...`). Filename-only identification is prohibited.
7. Safe Validation & No Forced Navigation: Stale, missing, or out-of-scope locations must be validated and safely skipped upon restoration. Historical locations must never force navigation or override current workspace reality.
8. Resource Lifecycle Synchronization: Resource renames and deletions must update or prune history references through the Resource Lifecycle and `NavigationPersistenceCoordinator`. A deleted file must never wipe unrelated history.
9. Graceful Failure Resilience: History persistence failures (including read-only storage or disk errors) must never break live editing, active navigation, or crash the application.
10. Source Content Serialization Prohibition: Source text, buffer snippets, unsaved content, ASTs, and selections must NEVER be stored inside recent-resource or navigation history records.
11. Local Confinement & Zero Telemetry: History data must remain strictly local. No user navigation journeys or accessed files may be transmitted over networks, logged in full, or sent to telemetry sinks.
12. Workspace Isolation & Generational Safety: Workspace-specific recent resources and navigation stacks must never leak across workspaces. Asynchronous history restores must verify the active `workspaceGeneration` and reject late cross-workspace completions.
13. Repository Boundary for History Clearing: Clear-history operations must execute via official repository boundaries (`RecentResourceRepository.clearRecentResources()`, `NavigationHistoryRepository.clearNavigationHistory()`) and must never erase unrelated document metadata or settings.

## RULE 65 — WORKSPACE INDEXING, SEARCH CACHE & DERIVED DATA STORAGE DISCIPLINE
Phase 05 Step 51 establishes the authoritative Persistent Workspace Index, Search Cache, and Derived Data Storage subsystem for QM Editor. All workspace indexing and derived data interactions must strictly uphold these engineering boundaries:
1. Derived Data Classification: Workspace indexes are strictly derived, rebuildable acceleration caches and must NEVER become authoritative project state.
2. Filesystem Authority Superiority: Filesystem truth must always outrank stale index data. If the index states a file exists but the filesystem indicates it was deleted or moved, the filesystem immediately takes precedence and the index entry must be invalidated.
3. Canonical Resource Identity: Search and Quick Open candidates must use canonical resource identities (`resourceId`, normalized URI) and avoid relying solely on ambiguous local file basenames.
4. Workspace Isolation: All persistent indexes must be workspace-scoped (`ws:<workspaceId>:resource_index`). An index from Workspace A must never serve candidates or commit state into Workspace B.
5. Centralized Watcher Authority: The File Watch Service (`FileSystemWatcherService` / `ResourceSynchronizationService`) is the sole filesystem observation authority. Subsystems, search engines, and indexers are strictly forbidden from creating private, uncoordinated filesystem watchers.
6. Generational Safety: Every index rebuild and persistent write must verify the active `workspaceGeneration`. Stale asynchronous build completions from previous workspaces or superseded index generations must be discarded immediately.
7. 100% Rebuildability & Self-Healing: Persistent indexes must be completely rebuildable from disk. Corruption or schema mismatches must trigger clean automatic rebuilding without crashing workspace initialization or editor startup.
8. Storage Separation: Derived index storage must remain isolated from authoritative persistence (settings, workspace metadata, document metadata). Index corruption must never corrupt authoritative user records.
9. Bounded Growth & Eviction: Derived indexes must have bounded retention, exclude large binary files and ignored paths (`node_modules`, `.git`, `dist`), and support explicit invalidation/clearing via `ResourceIndexRepository.deleteIndex()`.
10. Source Content Serialization Prohibition: Document source code, buffer bodies, syntax trees, and secrets must NEVER be persisted in the workspace index. Only lightweight metadata (paths, names, sizes, modified times, advisory fingerprints) is permitted.
11. Local Confinement & Zero Telemetry: All index data must remain local. Workspace file paths, project structures, and search metadata must never be transmitted externally or sent to telemetry sinks.
12. Non-Blocking Editor Execution: Indexing and persistence must never block core editing, typing, or UI responsiveness. All persistent index writes must use debounced write coalescing and background execution.

## RULE 66 — DOCUMENT RECOVERY, AUTOSAVE & CRASH-SAFE UNSAVED WORK FOUNDATION DISCIPLINE
Phase 05 Step 52 establishes the authoritative Document Recovery, Autosave, and Crash-Safe Unsaved Work Foundation for QM Editor. All recovery, autosave, and abnormal termination handling must strictly uphold these engineering boundaries:
1. Protective Safety Buffer, Not Local History: Recovery snapshots are temporary durable safety data to protect against abnormal application termination. They must NEVER evolve into Local History or persistent undo engines.
2. Zero Silent Filesystem Overwrite: The recovery subsystem must NEVER silently replace or overwrite real filesystem files merely because a recovery snapshot exists. Canonical filesystem content remains authoritative.
3. DocumentEngine Runtime Authority: All recovered text must pass through `DocumentEngine.openResource()` and `DocumentEngine.updateText()` / `createUntitled()`. Direct injection into UI components or disk bypassing `DocumentEngine` is prohibited.
4. Dirty State Restoration Invariant: Restoring recovered content into an existing document leaves the physical disk file untouched and sets `isDirty = true`. An explicit manual user Save is required to commit recovered content to disk.
5. Dedicated Untitled Recovery Identity: Restoring untitled documents must use dedicated untitled identities (`createUntitled()`) without inventing fake or temporary filesystem paths.
6. Monotonic Generation Race Protection: Every recovery snapshot carries a `recoveryGeneration`. Stale older generation writes must never overwrite newer snapshots if an asynchronous write finishes out of order.
7. Base Metadata & Conflict Detection: Snapshots record base file metadata (timestamp, size, fingerprint). If the physical file on disk was modified externally after the snapshot was recorded, candidate evaluation must flag a `conflict` and prevent silent data loss.
8. Bounded Quotas & Retention: Recovery storage must enforce bounded retention limits (default 24h) and storage capacity quotas (default 50MB). Snapshots must be cleanly pruned when documents are saved, cleanly closed, or explicitly discarded.
9. Write Coalescing: Rapid typing bursts must be debounced and coalesced. High-frequency writing on every single keystroke is strictly forbidden.
10. Non-Blocking Editor Execution & Resilience: Recovery storage failures (disk full, write permission denied) must NEVER crash the application or prevent the user from typing, editing, and saving normally.
11. Local Confinement & Zero Telemetry: Unsaved document recovery snapshots must remain strictly local. Source code, unsaved buffer contents, and secrets must NEVER be logged, sent to analytics, or transmitted over network boundaries.
12. Workspace Isolation & Generational Containment: Recovery records are workspace-aware. Recovery operations for Workspace A must never contaminate or restore candidates into Workspace B.

## RULE 67 — LOCAL HISTORY, DOCUMENT SNAPSHOTS & VERSIONED CONTENT PERSISTENCE DISCIPLINE
Phase 05 Step 53 establishes the authoritative Local History, Document Snapshots, and Versioned Content Persistence subsystem for QM Editor. All local history, snapshot persistence, and version restoration interactions must strictly uphold these engineering boundaries:
1. Strict Subsystem Boundaries: Local History is strictly distinct from Recovery (Step 52), Undo/Redo (native editor EditTransaction stacks), Autosave, external Git/VCS repositories, and cloud sync. These systems must never be conflated, combined, or substituted for one another.
2. Inviolable Filesystem Authority: Restoring a historical snapshot must NEVER silently replace or overwrite the physical file on the filesystem. Historical restore mutates the in-memory `DocumentEngine` buffer via `applyTransaction`, marks the document `isDirty = true`, and requires an explicit manual Save (`Ctrl+S`) by the user to commit changes to disk.
3. Pre-Restore Safety Invariant: Before restoring a historical version, `LocalHistoryCoordinator` must create a safety snapshot of live in-memory content (`source: 'preRestore'`), ensuring accidental restorations remain fully recoverable through Local History.
4. Native Undo/Redo Symmetry: Restoring historical content applies as an `EditTransaction`. This preserves the editor's native undo stack, enabling `Ctrl+Z` to reverse the restore and `Ctrl+Y` / `Ctrl+Shift+Z` to reapply it seamlessly.
5. Deterministic Content Hashing & Coalescing: All snapshots are verified by cryptographic checksum (SHA-256). Consecutive saves of unchanged content must be coalesced and skipped to prevent duplicate snapshot storage.
6. Bounded Storage & Automatic Retention: Local History storage must remain strictly bounded (`history.maxEntriesPerFile`, default: 50; `history.retentionDays`, default: 30; `history.maxStorageBytes`, default: 100MB). Older snapshots must be pruned automatically, while always preserving at least the latest checkpoint for any tracked document.
7. Workspace Scoping & Document Isolation: Manifests and snapshots are partitioned by canonical resource URI and workspace identifier. Document history from Workspace A must never be accessible from or mixed with Workspace B.
8. Read-Only Inviolability: Historical restore operations must be rejected immediately if the target document or resource is read-only.
9. Non-Blocking Editor Execution & Resilience: Local history persistence failures (disk I/O errors, storage full) must never block typing, editing, or normal document saving.
10. Strict Local Privacy & Zero Telemetry: Document history contains sensitive user code and text. Snapshots must remain strictly local. Document content, historical code snippets, or diff payloads must NEVER be uploaded to cloud services, sent to AI/LLM models, included in error logs, or transmitted to telemetry sinks.
11. No Competing Identity Systems: Local History must use authoritative `resourceUri` and `documentId` established by `ResourceIdentity` and `DocumentEngine`. Fabricating second competing document identities or path schemes is prohibited.
12. Explicit User Confirmation on Destructive Actions: Clear-history and delete-entry operations must be explicit and confirm through `FeedbackService`. Deleting history records must NEVER delete or damage the physical file on disk.

## RULE 68 — APPLICATION BACKUP, EXPORT, IMPORT & SAFE DATA PORTABILITY DISCIPLINE
Phase 05 Step 54 establishes the authoritative Application Backup, Export, Import, and Data Portability architecture for QM Editor. All backup, export, import, restore, and migration operations must strictly uphold these engineering boundaries:
1. Strict Concept Separation: Backup ≠ Export ≠ Import ≠ Restore. Backup is about safety preservation and disaster recovery; Export is a deliberate, portable representation of selected state; Import is validating untrusted external data; Restore is applying validated backup state with explicit user confirmation.
2. Inviolable Filesystem Authority: QM Editor does not own ordinary project source files merely because it edits them. The filesystem remains authoritative. Backups and exports must NEVER silently duplicate or bundle entire external project directories unless an explicit source export feature is deliberately invoked.
3. Step 52 Recovery Isolation: Backup/Export is strictly distinct from Crash Recovery. Active recovery snapshots must NEVER be exported in standard packages, and imported recovery data must NEVER be automatically injected into active recovery sessions or used to overwrite filesystem files.
4. Step 53 Local History Portability: Local History is conditionally portable and included in exports only when explicitly toggled. Importing history must never automatically restore content to active editor models or filesystem files; history becomes available for chronological inspection.
5. Untrusted Input & Staging Mandate: Imported packages are treated as hostile, untrusted data. An incoming package must NEVER be extracted directly into live application storage roots. It must pass through temporary staging validation: manifest validation, format version check, quota limits (max 5,000 files, max 10MB per file, max 50MB package), and cryptographic checksum verification.
6. Path Traversal & Security Boundary: Archive path traversal (`../`, `..\`, absolute paths, drive letters `C:`, UNC network paths `\\`) is strictly forbidden. Packages containing insecure paths or payloads outside approved domain namespaces (`settings/`, `workspaces/`, `history/`, `documents/`, `metadata/`, `recovery/`, `recent/`) must fail validation immediately.
7. Secret & Credential Exclusion: Backups and exports must NEVER contain passwords, API keys, tokens, or private keys. The serializer and validator proactively sanitize and strip sensitive patterns before package creation.
8. Rebuildable Derived Data Policy: Derived caches (search indexes, Quick Open caches, resource indexes) are excluded from portable packages. Upon restore or import of authoritative state, affected derived indexes must be invalidated and rebuilt fresh.
9. Pre-Restore Safety Backup: Prior to executing any destructive restore or import operation, the coordinator must automatically capture a safety backup of the current application state to guarantee zero accidental data loss.
10. Deterministic Conflict Resolution: Conflicts between incoming and current state must be detected, previewed to the user via an Import Plan, and resolved through controlled strategies (`merge`, `replace`, `skip`). The system must never silently overwrite conflicting user configurations.
11. Versioning & Migration Pipeline: Packages must carry versioned manifests (`qm.portability.manifest` v1). Legacy package formats must pass through registered schema migrators (`PackageMigrator`). Unsupported future formats must fail validation cleanly.
12. Strict Local Confinement: Backups and portability packages are strictly local-first. Uploads to cloud servers, remote backup daemons, telemetry leaks of archive payloads, and AI/LLM backup integrations are strictly prohibited.

## RULE 69 — PHASE 05 DATA & STORAGE INTEGRATION, HARDENING & COMPLETION GOVERNANCE
Phase 05 Step 55 establishes the final integration, cross-domain authority boundaries, and release readiness governance for the entire Data & Storage Architecture:
1. Unidirectional Persistence Hierarchy: All application persistence must flow through authoritative domain coordinators -> dedicated persistence repositories -> StorageService -> StorageAdapter. UI components and domain services must NEVER bypass repositories to manipulate physical storage or files directly.
2. Inviolable Single Source of Truth: For every domain, exactly one authority exists: DocumentEngine owns active buffers, FileSystem owns saved disk files, WorkspaceEngine owns workspace identity, SettingsService owns configurations, LocalHistoryCoordinator owns version timelines, DocumentRecoveryCoordinator owns crash snapshots, and BackupCoordinator owns portability packages.
3. Recovery & History Inviolability: Recovery snapshots (Step 52) must NEVER become Local History entries (Step 53), and Local History must NEVER act as editor Undo/Redo or Crash Recovery. Restoring historical or recovered content applies strictly in memory, sets `isDirty = true`, and preserves filesystem content untouched until explicitly saved by the user.
4. Zero Unvalidated Package Ingestion: All imported archives must pass through staging validation. Direct extraction of external archives into application storage roots is prohibited. Archive path traversal, drive letter escapes, and archive bomb attacks must be blocked before touching disk.
5. Rebuildable Derived Data Invalidation: Search indexes and workspace candidate caches are derived acceleration structures. They must NEVER be treated as authoritative. Upon any restore or import of authoritative state, derived indexes must be invalidated and rebuilt fresh.
6. Local Privacy & Secret Exclusion Invariant: User code, unsaved buffer text, passwords, and API credentials must NEVER be logged, sent to telemetry sinks, uploaded to cloud backups, or exposed to AI/LLM memory. Plaintext credentials must be proactively sanitized before serialization or export.
7. Degraded Mode & Concurrency Safety: Storage failures or read-only states must degrade gracefully without crashing core editing. Optimistic concurrency versioning (`recordVersion`) must reject stale writes to prevent race conditions.
8. Strict Phase 05 Boundary: With the completion of Step 55, Phase 05 is officially complete. No Phase 06 work (plugins, marketplace, debugging, remote databases, cloud sync) may be started until explicitly authorized.






