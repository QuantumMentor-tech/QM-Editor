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
