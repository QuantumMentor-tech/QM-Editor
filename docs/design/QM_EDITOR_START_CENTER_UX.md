# QM Editor — Start Center & Empty States UX Design Specification

## 1. UX Mission & Philosophy

The QM Editor Welcome Experience and Start Center provide an immediate, polished, and purposeful front door to the application. When a user opens QM Editor without an existing workspace or when all files are closed, the editor does not look broken, abandoned, or empty; instead, it presents an organized developer launchpad.

Crucially:
- It communicates **what the application is**: A fast, local, professional development workspace.
- It provides **direct paths to start working**: Open Folder, New File, Open File.
- It surfaces **recent workspaces** with clear MRU ordering, humanized timestamps, and safe removal actions.
- It introduces **power tools**: Command Palette (`Ctrl+Shift+P`), Quick Open (`Ctrl+P`), Settings (`Ctrl+,`), and Layout Reset.
- It **does NOT present marketing fluff**, product tours, onboarding tutorials, or cloud login requirements.

---

## 2. Visual Hierarchy & Surface Composition

```text
┌─────────────────────────────────────────────────────────────┐
│                       [QM Logo Icon]                         │
│                          QM Editor                          │
│               Professional Development Workspace             │
│                                                             │
│  [  Open Folder  ]     [   New File   ]    [   Open File   ] │
│                                                             │
│  ┌───────────────────────────┐ ┌──────────────────────────┐ │
│  │ RECENT WORKSPACES         │ │ EXPLORE & QUICK ACCESS   │ │
│  │ ------------------------- │ │ ------------------------ │ │
│  │ 📁 my-web-app             │ │ ⌨️  Command Palette       │ │
│  │    D:/Projects/my-web-app │ │    Ctrl+Shift+P          │ │
│  │    2h ago             [🗑]│ │                          │ │
│  │ 📁 rust-service           │ │ 🔍 Quick Open            │ │
│  │    D:/Repos/rust-service  │ │    Ctrl+P                │ │
│  │    Yesterday          [🗑]│ │                          │ │
│  │                           │ │ ⚙️  Settings              │ │
│  │                           │ │    Ctrl+,                │ │
│  └───────────────────────────┘ └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Brand Header
- Displays the official QM Editor logo icon at 56×56px with a subtle radial glow.
- Renders the primary title `QM Editor` at 2rem (bold, tracking -0.5px) paired with an accent badge `v0.1.0`.
- Subtitle: "Professional Development Workspace" with muted secondary contrast.

### 2.2 Primary Actions
- **Open Folder:** Accent-colored primary button (`Button variant="primary"`) with folder icon.
- **New File:** Neutral secondary button (`Button variant="secondary"`) with plus icon.
- **Open File:** Neutral secondary button (`Button variant="secondary"`) with file text icon.

### 2.3 Recent Workspaces Section
- Uses `List` and `ListItem` primitives from the Step 26 component library.
- Displays workspace name in medium weight, relative/absolute path in muted code styling, and human-readable time (e.g., `Just now`, `2m ago`, `1d ago`).
- Action button per row: Trash icon for **"Remove from Recent"** (`IconButton aria-label="Remove from Recent History"`).
  - Explicitly documents that removing from recent history NEVER deletes or alters files on the filesystem.
- When no recent workspaces exist, renders an `EmptyState` component with Clock icon: "No Recent Workspaces — Opened workspace folders will appear here for fast access."

### 2.4 Quick Access Exploration Cards
- Uses the `Card` component from Step 26.
- Each item displays an action icon, title, description, and keyboard shortcut badge.
- Clicking dispatches canonical command directly (`workbench.action.showCommands`, `workbench.action.quickOpen`, `workbench.action.openSettings`, `workbench.action.resetLayout`).

---

## 3. Empty-State System & Semantic Rules

All subsystem empty states are standardized using the Step 26 `EmptyState` primitive:

### 3.1 Strict Semantic Distinctions
- **Empty ≠ Loading:** A loading spinner or progress message is shown while data is actively being fetched or indexed. An empty state is never rendered while loading.
- **Empty ≠ Error:** Failures (e.g., Git command failure, invalid regex, filesystem read errors) display structured error states with error banners or retry buttons, never empty placeholders.
- **Empty ≠ Unavailable:** Subsystems that are disabled or unavailable state their condition plainly.
- **No Results ≠ Error:** A zero-match search result explicitly indicates no matching items were found and shows the query string, rather than an error icon.

### 3.2 Feature-Specific Empty States

| Feature | State | Heading | Subtext | Action |
|---|---|---|---|---|
| **File Explorer** | No folder opened | No Folder Opened | Open a workspace directory to browse files... | Open Folder |
| **File Explorer** | Empty directory | No files to display | This workspace folder contains no files... | Refresh |
| **Editor Canvas** | No tabs open | No open documents | Select a file from the explorer or create a new file. | New File / Open File |
| **Source Control**| Loading status | Checking repository status... | Scanning repository working tree... | None (spinner) |
| **Source Control**| Not a git repo | No Git Repository Detected | This workspace is not a Git repository. | None |
| **Source Control**| Clean tree | Working tree clean | No changes detected in the working tree. | None |
| **Source Control**| Git error | Source Control Error | [Error Message] | Retry |
| **Tasks** | No tasks | No tasks configured | No build, test, or run tasks defined... | None |
| **Problems** | Zero problems | No problems detected in workspace | No compiler, linter, or task diagnostic issues recorded. | None |
| **Problems** | Filter zero | No matching problems | No diagnostic problems match the active severity or search filter. | None |
| **Terminal** | Zero sessions | No Active Terminal Sessions | Create an integrated terminal session to execute build commands... | Create Terminal |
| **Search** | Empty query | Search Workspace | Type a query above to search files and symbols across the workspace. | None |
| **Search** | Zero matches | No matches found | No occurrences found matching "[query]" across workspace files. | None |

---

## 4. Accessibility & Navigation Specs

- **Landmarks:** Start Center is tagged with `role="region"` and `aria-label="QM Editor Start Center"`.
- **Keyboard Tab Order:** Header → Open Folder → New File → Open File → Recent Items → Quick Access Cards.
- **Contrast Ratios:** All text elements and iconography exceed WCAG 2.1 AA standards (4.5:1 for body, 3:1 for large text).
- **Reduced Motion:** All card transitions respect `prefers-reduced-motion` media queries.
