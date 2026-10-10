# QM EDITOR — SOURCE CONTROL UX & DESIGN SYSTEM
**Phase 1, Step 18 — Git Integration & Source Control Foundation**

---

## 1. UI COMPONENTS & LAYOUTS

### A. Sidebar View Switcher & Header
- **Primary Sidebar Header:** Displays tab toggle buttons to switch between:
  - **Explorer** (`workbench.view.explorer`)
  - **Source Control** (`workbench.view.scm`)
- Active view switcher highlights using design tokens (`var(--accent-primary)`, `var(--bg-active)`).

### B. Source Control View Panel (`SourceControlPanel.tsx`)
- **Header Bar:**
  - Repository name & current branch badge (`Git: main` or `Git: detached HEAD`)
  - Refresh button (`RotateCw` icon)
- **Status Groups:**
  - **Changes (N):** Working tree modified / deleted files (`M`, `D`).
  - **Untracked Files (N):** Newly created untracked files (`U`).
  - **Staged Changes (N):** Staged files (`S`).
  - **Conflicts (N):** Unmerged conflict files (`C`).
- **File Row Actions:**
  - Hovering or clicking a file row reveals the **Inspect Diff** action button (`GitCompare` icon).
  - Clicking a file opens the document in editor or opens the **Diff Inspection Modal**.

### C. File Explorer Decorations (`FileExplorer.tsx`)
- Tree nodes display subtle, accessible status badges on the right side of the item row:
  - **M** (`var(--warning)` / Amber): Working tree modified
  - **U** (`var(--success)` / Green): Untracked file
  - **D** (`var(--error)` / Red): Deleted file
  - **C** (`var(--accent-error)` / Magenta): Conflicted file
  - **S** (`var(--accent-primary)` / Blue): Staged file
- Badges use high-contrast color tokens and text labels to satisfy WCAG 2.1 AA accessibility guidelines (never color-only).

### D. Status Bar Branch Indicator (`StatusBar.tsx`)
- Located on the left side of the footer status bar:
  - Displays Git branch icon (`GitBranch`) alongside current branch name (e.g. `main` or `HEAD (a1b2c3d)`).
  - Clicking the indicator triggers `sourceControl.openPanel` to switch to the Source Control panel.

### E. Diff Inspection Modal (`SourceControlDiffModal.tsx`)
- Accessible modal dialog for side-by-side or line-by-line diff viewing:
  - Highlights additions (`+` green) and deletions (`-` red).
  - Disables editing to preserve read-only inspection safety.
  - Warns on binary files or unreadable file states.

---

## 2. EMPTY, LOADING & ERROR STATES

- **No Repository State:** Displays a clean card explaining "No Git Repository Detected in Workspace" with zero intrusive popup warnings.
- **Git Unavailable State:** Displays "Git Runtime Unavailable" explanation card without breaking editor operations.
- **Loading State:** Subtle spinner inside Source Control header during async tree status scans.
- **Error State:** User-friendly notification banner with details logged to diagnostic logger.
