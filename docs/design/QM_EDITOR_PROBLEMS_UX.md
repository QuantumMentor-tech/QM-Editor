# QM Editor Problems UI & Navigation UX

**Status:** Permanent Production Architecture (Phase 04, Step 40)  
**Location:** `src/components/problems/ProblemsPanel.tsx` & `src/components/explorer/TreeNodeRow.tsx`

---

## 1. Overview

The Problems UI provides the user interface for inspecting, filtering, and navigating diagnostic issues across QM Editor.

It consumes state exclusively from `globalDiagnosticService` and `taskService`, adhering to the strict rule that UI components must never act as diagnostic stores.

---

## 2. Component Organization

### Problems Panel Toolbar
- **Severity Counters:** Real-time badges for total errors (`#f85149`) and warnings (`#d29922`).
- **Severity Filter:** Dropdown to filter by "All Severities", "Errors Only", "Warnings Only", or "Info Only".
- **Source Filter:** Dynamic dropdown populated with all currently active diagnostic providers (e.g. `tsc`, `eslint`, `tasks`).
- **Search Input:** Real-time substring filter querying message, file path, rule code, and details.
- **Clear All:** Disposes task and service diagnostics on demand.

### Problems List
- **Keyboard Navigation:** Each problem row is focusable (`tabIndex={0}`) with `Enter` / `Space` activation.
- **Context Menu:** Right-click triggers `'contextmenu:problem'` with copy and navigation options.
- **Visual Design:** Follows QM Editor Phase 03 Design System tokens (`var(--bg-primary)`, `var(--border-color)`, `var(--text-accent)`).
- **Empty States:** Renders an accessible `EmptyState` when workspace has 0 problems or when an active filter yields 0 matches.

---

## 3. Navigation & Bounds Safety

When a user clicks or presses `Enter` on a diagnostic row:
1. `validateNavigationTarget(diagnostic)` verifies URI and clamps line/column against active document buffer length if loaded.
2. The target file is opened or activated in `WorkspaceContext`.
3. If the diagnostic has a structured text location, `qm:editor:gotoline` is dispatched to reveal and focus the line.
4. If the diagnostic is resource-level (no line range), the file opens safely without triggering invalid cursor movements to line 0.

---

## 4. File Explorer Integration

`TreeNodeRow.tsx` integrates aggregated diagnostics at the resource tree level:
- File rows query `globalDiagnosticService.getResourceSummary(node.uri)`.
- Directory rows query `globalDiagnosticService.getDirectorySummary(node.uri)`.
- If error count > 0, an error badge (`AlertCircle`) with count is displayed.
- If warning count > 0, an amber warning badge (`AlertTriangle`) with count is displayed.
- Targeted event subscriptions ensure only affected tree rows re-render when diagnostics change.
