# QM EDITOR — DESIGN SYSTEM & UI SPECIFICATION

**Version:** 1.0.0  
**Status:** Approved UI Foundation  
**Last Updated:** October 10, 2026  

---

## 1. DESIGN PHILOSOPHY

QM Editor's user interface communicates **precision, modern desktop performance, developer focus, and visual clarity**. The visual language utilizes cohesive dark and light theme tokens, explicit contrast hierarchy, predictable layout regions, and strict accessibility standards.

---

## 2. DESIGN TOKENS (`src/index.css`)

### Color Palette Tokens

```css
/* Dark Theme (Default) */
--bg-app: #0f172a;
--bg-header: #1e293b;
--bg-sidebar: #1e293b;
--bg-editor: #090d16;
--bg-panel: #1e293b;
--bg-active-tab: #090d16;
--bg-hover: #334155;
--bg-status: #0f172a;

--border-color: #334155;
--border-focus: #38bdf8;

--text-primary: #f8fafc;
--text-secondary: #94a3b8;
--text-muted: #64748b;
--text-accent: #38bdf8;

--accent-primary: #0284c7;
--accent-hover: #0369a1;

/* Light Theme */
[data-theme="light"] {
  --bg-app: #f8fafc;
  --bg-header: #ffffff;
  --bg-sidebar: #f1f5f9;
  --bg-editor: #ffffff;
  --bg-panel: #f8fafc;
  --bg-active-tab: #ffffff;
  --bg-hover: #e2e8f0;
  --bg-status: #e2e8f0;

  --border-color: #cbd5e1;
  --border-focus: #0284c7;

  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --text-accent: #0284c7;

  --accent-primary: #0284c7;
  --accent-hover: #0369a1;
}
```

### Typography Scale

- **UI Font Stack:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Code Font Stack:** `'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace`
- **Sizes:**
  - Caption / Status: `0.75rem` (`12px`)
  - Small / Button: `0.85rem` (`13.6px`)
  - Body / Subtitle: `0.95rem` (`15.2px`)
  - Section Title / Header: `1.05rem` (`16.8px`)

### Spacing & Radius System

- **Layout Heights:**
  - Header Height: `48px`
  - Status Bar Height: `28px`
  - Tab Bar Height: `36px`
  - Sidebar Width: `260px`
- **Border Radius:**
  - Small (`--radius-sm`): `4px`
  - Medium (`--radius-md`): `6px`
  - Large (`--radius-lg`): `8px`

---

## 3. LAYOUT REGIONS & ARCHITECTURE

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                           HEADER NAVBAR (48px)                          │
│   [Logo: QM Editor Logo.png] [QM EDITOR v0.1.0]      [Save] [Theme]     │
├───────────────┬─────────────────────────────────────────────────────────┤
│               │                   ACTIVE TAB BAR (36px)                 │
│               ├─────────────────────────────────────────────────────────┤
│   SIDEBAR     │                                                         │
│   EXPLORER    │                 MAIN WORKSPACE CONTAINER                │
│   (260px)     │             (Editor Area / Text Content View)           │
│               │                                                         │
├───────────────┴─────────────────────────────────────────────────────────┤
│                           STATUS BAR (28px)                             │
│   [Status: Ready | UTF-8]                       [Save State Indicator]  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. STACKING OVERLAY LAYERS (Z-INDEX)

- Base Workspace Shell: `z-index: 0`
- Sticky Header & Panel Headers: `z-index: 10`
- Dropdowns & Context Menus: `z-index: 100`
- Dialogs & Modals: `z-index: 1000`
- Tooltips & Global Notifications: `z-index: 2000`

---

## 5. REUSABLE UI PRIMITIVES

1. **Button:** Standardized button supporting `primary`, `secondary`, `ghost`, and `destructive` variants.
2. **IconButton:** Accessible icon button wrapper with explicit `aria-label`.
3. **Badge:** Categorical label badge (`primary`, `accent`, `warning`, `success`, `muted`).
4. **StatusIndicator:** Colored status dot indicating document save state or background activity.
5. **Panel:** Flexible container primitive for sidebar tools, editor panes, and status sections.
6. **Dialog:** Accessible modal overlay with backdrop mask, keyboard trap, and Escape key handler.
