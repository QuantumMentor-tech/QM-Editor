# QM Editor — Task & Problem Matcher UX Specification
## Phase 1, Step 20 — Tasks, Build, Run & Problem Matcher Foundation

---

### 1. UX Goals & Interaction Principles

1. **Direct Discoverability**: Development workflows (Build, Test, Lint, Run) should be discoverable via the secondary bottom panel, the Command Palette, and industry-standard keyboard shortcuts (`Ctrl+Shift+B`).
2. **Real-time Observability**: Developers receive instant visual feedback on task status: start, progress, duration, exit code, and live ANSI-formatted output.
3. **Actionable Diagnostics**: Problems reported by compilers and tools are transformed into interactive lists that take developers directly to the exact file, line, and column with a single click.
4. **Security Visibility**: The workspace trust state is transparently presented in the panel header, preventing accidental command execution in untrusted environments.

---

### 2. Panel Organization & Secondary Panel Integration

The Secondary Panel (`Ctrl+J`) incorporates dedicated tabs:
- **Terminal (N)**: Interactive terminal sessions.
- **Tasks**: Structured task runner catalog and execution console.
- **Problems (N)**: Normalized compiler and linter diagnostics with real-time error/warning badges.
- **Console / Output**: General editor output logs.

---

### 3. Tasks Panel Layout

```text
+----------------------+----------------------------------------------------------+
| [SHIELD] Trusted     | Build Project [COMPLETED] (exit: 0)  [Rerun] [Clear]     |
|                      +----------------------------------------------------------+
| AVAILABLE TASKS (4)  | > Executing task: Build Project (npm run build)          |
| [Build Project]  [>] | vite v6.4.4 building for production...                   |
| [Run Tests]      [>] | transforming (120 modules)...                            |
| [Lint Codebase]  [>] | ✓ 1665 modules transformed.                              |
| [Dev Server]     [>] | rendering chunks...                                      |
|                      | ✓ built in 140ms                                         |
| RECENT RUNS          |                                                          |
| Build Project [done] | Task completed successfully.                             |
+----------------------+----------------------------------------------------------+
```

#### Left Sidebar
- **Workspace Trust Header**: Shield icon indicating `Workspace Trusted` or `Workspace Untrusted`, with an immediate toggle button.
- **Task Catalog**: Filterable list (Build, Test, Run, Lint) displaying task label, command preview, type badges, and a direct `Play` action button.
- **Recent Runs**: Quick-switch list showing previous task sessions and their completion status.

#### Right Execution Console
- **Status Bar**: Task label, status badge (`RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`, `BLOCKED`), exit code, and problem count.
- **Action Controls**: `Cancel` (when running), `Rerun` (when finished), and `Clear Output`.
- **Output Screen**: Dark monospace screen rendering ANSI color sequences (red for errors, green for success, yellow for warnings, blue for task banners).

---

### 4. Problems Panel Layout

```text
+---------------------------------------------------------------------------------+
| Problems  (1 Error)  (1 Warning)    [Filter: All] [Search...]        [Clear]    |
+---------------------------------------------------------------------------------+
| [X] Type "string" is not assignable to type "number".  [TS2322] [tsc]           |
|     src/App.tsx [14, 5]                                                         |
|                                                                                 |
| [/] Unexpected console statement                       [no-console] [eslint]     |
|     src/utils.ts [10, 5]                                                        |
+---------------------------------------------------------------------------------+
```

- **Severity Indicators**: Red circle for errors, yellow triangle for warnings, blue info circle for hints.
- **Diagnostics Information**: Clear error message, rule/diagnostic code badge, tool source tag (`[tsc]`, `[eslint]`), and file location (`file [line, col]`).
- **One-Click Jump**: Clicking any problem row opens the target document in the editor and automatically jumps cursor position to the reported line and column.

---

### 5. Keyboard Shortcuts

- `Ctrl+Shift+B` (`Mod+Shift+B`): Run project default build task.
- `Ctrl+J` (`Mod+J`): Toggle secondary bottom panel.
- Command Palette (`Ctrl+Shift+P`):
  - `Tasks: Run Task...`
  - `Tasks: Run Build Task`
  - `Tasks: Run Test Task`
  - `Tasks: Cancel Running Task`
  - `Tasks: Show Tasks Panel`
  - `Tasks: Show Problems Panel`
