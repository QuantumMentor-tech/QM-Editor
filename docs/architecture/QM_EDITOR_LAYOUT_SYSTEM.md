# QM Editor — Responsive Workspace, Adaptive Layout & UI Density Architecture

## 1. Architectural Philosophy & Responsibility Model

QM Editor is a professional desktop development environment. The layout architecture ensures predictable, fluid, and robust behavior under changing space constraints without degrading into mobile-first patterns or collapsing critical developer workflows.

Core principles:
- **Editor Area Prioritization (Rule 23, Rule 6)**: The central code editor is the most critical surface. Constrained viewports collapse secondary toolbars and clamp sidebars/panels to guarantee minimum editor dimensions (`minEditorWidth: 300px`, `minEditorHeight: 150px`).
- **Centralized Layout State (Rule 17)**: Workspace geometry and visibility reside in `LayoutService` and `ShellContext`, not scattered across ad-hoc element queries.
- **Strict Dimension Validation & Clamping (Rule 8, 15, 16, 53)**: Stored pixel dimensions are validated against finite numbers, clamped against available window constraints, and gracefully fall back to defaults upon corruption.
- **Layered Stacking Tokens (Rule 37)**: Defined Z-index tokens prevent arbitrary `z-index: 999999` proliferation.

---

## 2. Shell Layout Hierarchy

```
Application Window (min: 600px x 400px)
├── Header Bar (var(--header-height): 48px / compact: 40px, z-index: var(--z-header))
│    ├── Brand Logo & Title
│    ├── Application MenuBar
│    ├── Command Palette Quick Search
│    ├── Navigation History (Back / Forward)
│    ├── Primary Toolbar (Adaptive progressive reduction & overflow)
│    └── Shell Toggles (Panel, Theme)
├── System Banner Layer (BannerHost, z-index: var(--z-banner))
├── Main Workspace Body (flex: 1, display: flex, overflow: hidden)
│    ├── Primary Sidebar (width: 160px - 500px, default: 260px)
│    │    ├── View Tablist (Explorer / SCM) & Header Controls
│    │    ├── View Content (FileExplorer / SourceControlPanel)
│    │    └── Vertical Resizer Handle (role="separator", cursor: col-resize)
│    └── Central Workspace Column (flex: 1, display: flex, flexDirection: column)
│         ├── Document Tab Strip (role="tablist", height: var(--tab-height): 38px / compact: 30px)
│         ├── Editor Surface Area (flex: 1, min: 300px x 150px)
│         └── Secondary Console Panel (height: 120px - 600px, default: 240px)
│              ├── Horizontal Resizer Handle (role="separator", cursor: row-resize)
│              ├── Panel Tablist (Terminal, Tasks, Problems, Output)
│              └── Panel Content (TerminalPanel, TasksPanel, ProblemsPanel, Output)
├── Status Bar Footer (height: var(--statusbar-height): 28px / compact: 24px)
├── Global Context Menu (z-index: var(--z-contextmenu))
└── Global Overlay Layer (Modal Dialogs z-index: var(--z-modal), Toasts z-index: var(--z-toast))
```

---

## 3. Layout Service & Constraints

### 3.1 LayoutConstraints (`src/core/layout/LayoutConstraints.ts`)
| Dimension / Boundary | Constraint Value | Purpose |
| :--- | :--- | :--- |
| `minWindowWidth` | `600px` | Minimum supported desktop window width |
| `minWindowHeight` | `400px` | Minimum supported desktop window height |
| `minSidebarWidth` | `160px` | Minimum width before sidebar collapse |
| `maxSidebarWidth` | `500px` | Maximum width before preventing editor crowding |
| `defaultSidebarWidth` | `260px` | Standard initial width for File Explorer |
| `minPanelHeight` | `120px` | Minimum height for terminal and problem lists |
| `maxPanelHeight` | `600px` | Maximum height preventing editor occlusion |
| `defaultPanelHeight` | `240px` | Standard initial height for bottom panel |
| `minEditorWidth` | `300px` | Protected minimum width for code editing |
| `minEditorHeight` | `150px` | Protected minimum height for code editing |

### 3.2 Clamping & Priority Formulas
- **Sidebar Width Clamping**:
  ```ts
  const availableMax = Math.max(minSidebarWidth, windowWidth - minEditorWidth);
  const effectiveMax = Math.min(maxSidebarWidth, availableMax);
  sidebarWidth = clamp(requestedWidth, minSidebarWidth, effectiveMax);
  ```
- **Panel Height Clamping**:
  ```ts
  const chromeHeight = headerHeight + statusbarHeight;
  const availableMax = Math.max(minPanelHeight, windowHeight - chromeHeight - minEditorHeight);
  const effectiveMax = Math.min(maxPanelHeight, availableMax);
  panelHeight = clamp(requestedHeight, minPanelHeight, effectiveMax);
  ```

---

## 4. UI Density Architecture

The UI Density system (`UiDensity = 'comfortable' | 'compact'`) alters structural spacing tokens across the application via `data-density` attribute on `document.documentElement`:

| Token | Comfortable Mode (Default) | Compact Mode |
| :--- | :--- | :--- |
| `--header-height` | `48px` | `40px` |
| `--statusbar-height` | `28px` | `24px` |
| `--tab-height` | `38px` | `30px` |
| Navigation buttons | Standard padding (28px height) | Compact padding (24px height) |

Density preference is registered in `SettingsRegistry` as `appearance.uiDensity` and toggled via command `workbench.action.toggleDensity`.

---

## 5. Z-Index Layer Hierarchy Tokens

Standardized design tokens defined in `src/index.css`:
- `--z-base: 1;`
- `--z-resizer: 10;`
- `--z-header: 20;`
- `--z-popover: 50;`
- `--z-dropdown: 100;`
- `--z-contextmenu: 500;`
- `--z-modal: 1000;`
- `--z-toast: 2000;`
- `--z-banner: 3000;`
- `--z-tooltip: 4000;`

---

## 6. Persistence & Safety

- **Storage Key**: `qm_editor_layout_state_v1`
- **Schema Validation**: All stored numeric values pass `validateLayoutDimension()`. Invalid values, `NaN`, `Infinity`, or negative values are discarded.
- **Layout Reset (`workbench.action.resetLayout`)**: Restores sidebar width to 260px, panel height to 240px, density to 'comfortable', and closes open panels without affecting document buffers or user code.
