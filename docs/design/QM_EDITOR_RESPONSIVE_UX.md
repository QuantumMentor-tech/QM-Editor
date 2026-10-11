# QM Editor — Responsive Workspace & Adaptive UX Specification

> **Phase 03 — Step 25**  
> **Document Status:** Active & Standardized

---

## 1. Overview & Core Philosophy

QM Editor is a high-performance desktop development environment. The responsive and adaptive layout system is built around a single foundational premise:

> **The desktop workspace adapts intelligently to available space while preserving professional editor usability and interaction integrity.**

QM Editor does not employ mobile-first patterns or drawer paradigms that compromise desktop developer productivity. Instead, it prioritizes the core code-editing experience above all secondary panels, navigation sidebars, and peripheral toolbars.

```
Priority Pyramid:
┌─────────────────────────────────┐
│       1. Primary Code Editor    │ (Protected min width: 300px, min height: 150px)
├─────────────────────────────────┤
│    2. Primary Navigation / Tree │ (Sidebar: min 160px, collapsible to 0)
├─────────────────────────────────┤
│     3. Essential Action Items   │ (Primary commands, active tabs, dirty state)
├─────────────────────────────────┤
│ 4. Secondary Developer Panels   │ (Terminal, Problems, Tasks, Output)
├─────────────────────────────────┤
│    5. Secondary Metadata/Status │ (Encoding, Git branch, line/col indicators)
└─────────────────────────────────┘
```

---

## 2. Window Size Model & Constraints

### 2.1 Safe Minimum Dimensions
The application enforces safe minimum operating dimensions to prevent visual collapse or control clipping:
- **Minimum Application Width:** `500px`
- **Minimum Application Height:** `360px`
- **Standard Default Window:** `1280px × 800px`

### 2.2 Editor Protection Boundaries
To prevent user code editing from becoming unusable when sidebars or bottom panels are expanded:
- **Minimum Editor Usable Width:** `300px`
- **Minimum Editor Usable Height:** `150px`

If the user resizes a panel or reduces the window dimensions, panel expansion is strictly clamped against these boundaries.

---

## 3. Sidebar Interaction & Adaptations

### 3.1 Dimensions & Clamping
- **Minimum Width:** `160px`
- **Maximum Width:** `500px` (or `window.innerWidth - 300px`, whichever is smaller)
- **Default Width:** `260px`
- **Double Click Reset:** Double-clicking the resize splitter restores the default `260px`.

### 3.2 Narrow Sidebar Behavior
When the sidebar is resized to narrow dimensions (`160px - 200px`):
- Long file names and tree node labels truncate safely using ellipsis (`text-overflow: ellipsis; white-space: nowrap; overflow: hidden;`).
- File icons and disclosure chevrons remain permanently visible.
- Actions and badges condense into icon-only states or overflow context menus.
- Horizontal scrollbars are prevented within normal tree rows.

### 3.3 Keyboard Resizing & Accessibility
The sidebar splitter is a full accessibility participant:
- `role="separator"`
- `aria-orientation="vertical"`
- `aria-valuenow="{sidebarWidth}"`
- `aria-valuemin="160"`
- `aria-valuemax="500"`
- `aria-label="Resize Primary Sidebar"`
- **Keyboard Controls:**
  - `ArrowLeft`: Decrease width by `20px` (clamped).
  - `ArrowRight`: Increase width by `20px` (clamped).
  - `Home`: Snap to minimum width (`160px`).
  - `End`: Snap to maximum permitted width (`500px` or calculated max).

---

## 4. Secondary Panel (Terminal / Problems / Tasks / Output)

### 4.1 Dimensions & Clamping
- **Minimum Height:** `120px`
- **Maximum Height:** `600px` (or `window.innerHeight - 150px - header/status chrome`, whichever is smaller)
- **Default Height:** `240px`
- **Double Click Reset:** Double-clicking the horizontal splitter restores the default `240px`.

### 4.2 Expansion Priority & Clamping
When the bottom panel expands:
- Editor vertical height decreases fluidly.
- Dynamic clamping recalculates `availableMax = windowHeight - chromeHeight - minEditorHeight`. The panel cannot exceed this height, guaranteeing the editor remains functional and interactive.

### 4.3 Keyboard Resizing & Accessibility
- `role="separator"`
- `aria-orientation="horizontal"`
- `aria-valuenow="{panelHeight}"`
- `aria-valuemin="120"`
- `aria-valuemax="600"`
- `aria-label="Resize Bottom Panel"`
- **Keyboard Controls:**
  - `ArrowUp`: Increase height by `20px` (clamped).
  - `ArrowDown`: Decrease height by `20px` (clamped).
  - `Home`: Snap to minimum height (`120px`).
  - `End`: Snap to maximum permitted height.

---

## 5. Document Tabs & Overflow Adaptation

### 5.1 Tab Width & Sizing
- Individual tabs have a minimum width (`80px`) and maximum width (`220px`).
- Long document names truncate in the middle or end with ellipsis, preserving the close button and dirty state indicator (`●`).
- Full file path and complete name are always discoverable via `title` tooltips and accessible screen reader labels.

### 5.2 Overflow Handling
- Document tabs are contained in a designated tablist scroll container with smooth horizontal scrolling.
- When an active document changes or is focused, `scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })` is executed automatically to ensure the active tab remains in the viewport without unexpected jumping.

---

## 6. Status Bar Adaptation

The status bar organizes information into primary and secondary categories:
- **Primary / Essential Status Items:** Line & column position, active selection count, encoding, and critical notification badges.
- **Secondary Status Items:** Language mode badge, indentation mode, Git branch, background task counters.
- **Responsive Media Adaptation:** At window widths `<= 800px`, secondary status items hide (`.status-item-secondary { display: none !important; }`), preventing label collision, horizontal wrapping, or truncated metrics.

---

## 7. UI Density System

QM Editor provides a unified, accessible density system allowing developers to select their preferred information density:

| Density Mode | Header Height | Status Bar Height | Tab Height | Tree Row Height | Target Audience |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`comfortable`** (Default) | `48px` | `28px` | `38px` | `28px` | General development, high-touch accessibility, standard monitors |
| **`compact`** | `40px` | `24px` | `30px` | `24px` | Small laptops, high information density, dense multi-panel workflows |

### Density Principles
1. **Accessibility Maintained:** Interactive hit targets never fall below WCAG recommended guidelines. Touch and pointer click zones maintain adequate padding.
2. **Typography Preserved:** Font sizes and text legibility remain unchanged; density adjustments solely affect layout padding and structural heights.
3. **Command Surface Integration:** Density can be toggled via `workbench.action.toggleDensity` or configured in Settings (`appearance.uiDensity`).
4. **CSS Token-Driven:** Applied directly to `document.documentElement` via `data-density="compact"|"comfortable"`.

---

## 8. Layered Z-Index Stacking Model

To eliminate arbitrary `z-index: 999999` proliferation, QM Editor standardizes on semantic design tokens:

```css
--z-base: 1;             /* Normal panel content, editor, tree */
--z-resizer: 100;        /* Sidebar and panel splitters */
--z-sticky: 200;         /* Sticky headers, tab bars */
--z-popover: 1000;       /* Dropdowns, tooltips, popovers */
--z-menu: 2000;          /* Context menus, dropdown menus */
--z-modal: 3000;         /* Confirmation dialogs, settings modal */
--z-tooltip: 4000;       /* Screen-level notifications, critical alerts */
```

---

## 9. Layout State Persistence & Reset

- Persisted in `localStorage` under `qm_editor_layout_state_v1`.
- Numeric dimensions are strictly validated (`Number.isFinite`, within bounds). Corrupted or out-of-range values fall back gracefully to defaults.
- The command `workbench.action.resetLayout` (or `View.ResetLayout`) restores all layout regions to standard factory defaults without affecting document content or settings.
