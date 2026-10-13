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
