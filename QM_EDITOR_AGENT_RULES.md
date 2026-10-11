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



