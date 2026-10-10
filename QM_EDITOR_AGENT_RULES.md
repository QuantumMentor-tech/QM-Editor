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


