# QM Editor — Unified Command Surfaces UX & Design
**Phase 03, Step 22 — User Experience Specification**

---

## 1. Design Overview

QM Editor command surfaces provide an intuitive, high-density, desktop-class experience for command discovery and execution. Commands are presented consistently across:
- **Application Menu Bar:** Standard desktop menu bar at the top of the header.
- **Primary Toolbar:** Clean, icon-based toolbar for instant one-click operations.
- **Context Menus:** Floating, cursor-anchored contextual menus clamped to the viewport.
- **Overflow Menu:** Responsive folding mechanism for compact viewport sizes.

---

## 2. Visual Style & Tokens

All surfaces consume design tokens from the QM Editor design system:

| Element | Token / Value | Description |
|---|---|---|
| Background | `var(--bg-secondary)` / `var(--bg-header)` | Slate dark theme / clean light theme |
| Text Color | `var(--text-primary)` | High contrast readability |
| Muted Text | `var(--text-muted)` | Used for shortcuts and secondary descriptors |
| Active Hover | `var(--bg-active, rgba(59, 130, 246, 0.2))` | Accent tint highlight |
| Accent Color | `var(--accent-primary, #58a6ff)` | Checkmarks and active indicators |
| Border | `var(--border-color)` | 1px border around menus and dividers |
| Box Shadow | `0 4px 16px rgba(0, 0, 0, 0.35)` | Elevation depth |
| Radius | `var(--radius-sm, 4px)` | Rounded edges matching editor aesthetics |

---

## 3. Keyboard Navigation & Accessibility (WAI-ARIA)

All command surfaces comply with desktop accessibility standards:

### 3.1 Menu Bar Navigation
- `role="menubar"` for the menu container; `role="menuitem"` for category triggers.
- `ArrowRight` / `ArrowLeft`: Navigate horizontally between top-level categories. If a menu dropdown is already open, navigating horizontally smoothly opens the adjacent category.
- `ArrowDown`: Opens the menu dropdown and focuses the first enabled item.
- `ArrowUp` / `ArrowDown`: Navigates vertically through enabled items within the open dropdown.
- `Enter` / `Space`: Executes the currently focused command.
- `Escape`: Closes the dropdown menu and returns focus to the category trigger.

### 3.2 Context Menu Navigation
- `role="menu"` on the floating context menu container; `role="menuitem"` on each item.
- `aria-disabled="true"` on disabled items.
- `ArrowUp` / `ArrowDown`: Cycle through items with wrap-around support.
- `Escape`: Immediately closes the context menu. Focus is safely returned to the element that triggered the context menu (`previousFocusRef`).

### 3.3 Platform-Aware Shortcuts
Shortcut text is rendered on the right side of menu items. Modifiers automatically adapt to the user's operating system:
- **Windows / Linux:** `Ctrl+S`, `Ctrl+Shift+P`, `Alt+Left`.
- **macOS:** `⌘S`, `⇧⌘P`, `⌥←`.

---

## 4. Viewport Clamping & Geometry

Context menus must never clip off the screen:
- When right-clicking near the right edge of the screen, the menu shifts to the left of the cursor.
- When right-clicking near the bottom edge of the screen, the menu shifts upwards above the cursor.
- An 8px viewport safety margin is maintained on all boundaries.

---

## 5. Light & Dark Theme Compatibility

Both light and dark themes are fully supported:
- **Dark Theme:** High contrast text on dark slate container with subtle blue hover active highlights.
- **Light Theme:** Dark text on crisp light background with matching contrast borders and dividers.
