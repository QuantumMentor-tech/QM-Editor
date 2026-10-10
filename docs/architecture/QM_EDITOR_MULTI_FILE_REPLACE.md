# QM Editor — Safe Multi-File Replace Architecture

## 1. Overview
Multi-file replacement (`Ctrl+Shift+H`) across workspace files introduces a controlled, two-stage transaction model: **SEARCH MAY BE FAST. REPLACE MUST BE DELIBERATE.**

```text
SEARCH RESULTS
       ↓
BUILD REPLACEMENT PLAN (Validate target files & permissions)
       ↓
PREVIEW & CONFIRMATION DIALOG (Explicit user approval)
       ↓
FILE STATUS VALIDATION (Dirty tab guard, read-only guard)
       ↓
TRANSACTION EXECUTION (Write closed files to disk, sync active open tabs)
       ↓
RE-EVALUATE SEARCH & REPORT AUDIT SUMMARY
```

## 2. Target File Validation Rules

1. **Dirty Open Document Protection:** If a target file is currently open in workspace tabs with unsaved edits (`isDirty === true`), it is marked `'dirty_open'` and excluded from automatic multi-file replace. This prevents accidentally overwriting unsaved user edits.
2. **Read-Only Protection:** Target files marked read-only (`fileResource.readOnly === true`) are marked `'read_only'` and skipped safely.
3. **Open Clean Tab Synchronization:** Target files that are open in workspace tabs without unsaved edits are updated directly through `DocumentService` / `WorkspaceContext` (`updateText`), preserving tab state and content revision tracking.
4. **Closed File Atomic Writes:** Target files that are closed are updated on disk via `FileService`, using reverse-offset atomic substring replacement to preserve line positions.

## 3. Replacement Plan & Audit Report
- `WorkspaceReplacePlan` calculates total ready matches vs blocked/skipped targets before execution.
- Final summary audit reports `replacedFilesCount`, `totalReplacedMatchesCount`, `skippedFilesCount`, and `errors`.
