# QM EDITOR — DESIGN SYSTEM & UI SPECIFICATION

**Version:** 3.0.0 (Phase 03 Final Consolidated Release)  
**Status:** Approved & Hardened UI Foundation  
**Last Updated:** October 12, 2026  

---

## 1. DESIGN PHILOSOPHY & FOUNDATIONAL PRINCIPLES

QM Editor's user interface is engineered for **precision, developer focus, visual calm, and predictable interaction**. It delivers an uncluttered, high-performance desktop experience where code is the visual priority.

### Foundational Principles
1. **Calm Editing Surface:** The primary code editor is the visual center. Sidebars, secondary panels, toolbars, and status bars are subdued and do not compete with source code.
2. **Visual Continuity & Family Resemblance:** Every component, panel, modal, menu, and notification adheres to a single design token architecture and shared component primitives.
3. **Strict Theme Symmetry:** Dark and Light themes are first-class, intentional palettes with complete semantic mapping. Light theme avoids pale borders, washed-out text, or dark card fallbacks.
4. **Predictable Interaction States:** Every interactive primitive has defined and tested visual feedback across Default, Hover, Focus-Visible, Active/Pressed, Selected, Disabled, and Loading states.
5. **Universal Accessibility:** Visible focus rings, keyboard-first navigation, roving tabindex, ARIA semantics, and non-color redundant status indicators are built into the design system core.
6. **Zero External Runtime Dependencies:** All fonts, icons, styles, and assets are local. No remote CDNs or external web services are required to render controls.

---

## 2. CENTRALIZED DESIGN TOKEN ARCHITECTURE (`src/index.css`)

All colors, dimensions, typography, spacing, radii, elevations, and z-index layers are managed via CSS custom properties.

### 2.1 Theme & Semantic Color Tokens

```css
:root {
  /* Core Brand & Canvas (Dark Theme Default) */
  --bg-app: #0f172a;
  --bg-header: #1e293b;
  --bg-sidebar: #1e293b;
  --bg-editor: #090d16;
  --bg-panel: #1e293b;
  --bg-active-tab: #090d16;
  --bg-hover: #334155;
  --bg-status: #0f172a;

  /* Standardized Semantic Surface Layers */
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #162032;
  --bg-card: #1e293b;
  --bg-input: #0f172a;
  --bg-dropdown: #1e293b;
  --bg-modal: #1e293b;

  /* Borders & Dividers */
  --border-color: #334155;
  --border-subtle: #243044;
  --border-focus: #38bdf8;
  --border-width: 1px;

  /* Text & Foreground Tokens */
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --text-accent: #38bdf8;
  --text-inverse: #0f172a;
  --text-danger: #ef4444;

  /* Accents & Brand Actions */
  --accent-primary: #0284c7;
  --accent-hover: #0369a1;
  --accent-color: #0284c7;
  --accent-active: #075985;
  --accent-subtle: rgba(2, 132, 199, 0.15);

  /* Semantic Feedback Roles */
  --color-error: #ef4444;
  --color-warning: #f59e0b;
  --color-success: #10b981;
  --color-info: #3b82f6;
  --error: #ef4444;
  --warning: #f59e0b;
  --success: #10b981;
  --info: #3b82f6;
}

[data-theme="light"] {
  /* Core Brand & Canvas (Light Theme) */
  --bg-app: #f8fafc;
  --bg-header: #ffffff;
  --bg-sidebar: #f1f5f9;
  --bg-editor: #ffffff;
  --bg-panel: #f8fafc;
  --bg-active-tab: #ffffff;
  --bg-hover: #e2e8f0;
  --bg-status: #e2e8f0;

  /* Standardized Semantic Surface Layers */
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --bg-tertiary: #f1f5f9;
  --bg-card: #ffffff;
  --bg-input: #ffffff;
  --bg-dropdown: #ffffff;
  --bg-modal: #ffffff;

  /* Borders & Dividers */
  --border-color: #cbd5e1;
  --border-subtle: #e2e8f0;
  --border-focus: #0284c7;
  --border-width: 1px;

  /* Text & Foreground Tokens */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
  --text-accent: #0284c7;
  --text-inverse: #ffffff;
  --text-danger: #dc2626;

  /* Accents & Brand Actions */
  --accent-primary: #0284c7;
  --accent-hover: #0369a1;
  --accent-color: #0284c7;
  --accent-active: #075985;
  --accent-subtle: rgba(2, 132, 199, 0.12);

  /* Semantic Feedback Roles */
  --color-error: #dc2626;
  --color-warning: #d97706;
  --color-success: #059669;
  --color-info: #2563eb;
  --error: #dc2626;
  --warning: #d97706;
  --success: #059669;
  --info: #2563eb;
}
```

### 2.2 Typography Scale

- **UI Font Stack:** `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Code Font Stack:** `'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace`

| Token | Size | Line Height | Usage |
| :--- | :--- | :--- | :--- |
| `--text-2xs` | `0.65rem` (`10.4px`) | `1.25` | Badges, counters, compact shortcuts |
| `--text-xs` | `0.75rem` (`12px`) | `1.25` | Status bar, caption, metadata, tree badges |
| `--text-sm` | `0.85rem` (`13.6px`) | `1.4` | List rows, Explorer items, tabs, small buttons |
| `--text-base` | `0.90rem` (`14.4px`) | `1.5` | Standard controls, inputs, body text |
| `--text-md` | `0.95rem` (`15.2px`) | `1.5` | Form labels, card descriptions |
| `--text-lg` | `1.125rem` (`18px`) | `1.5` | Panel titles, modal headers, subsection titles |
| `--text-xl` | `1.25rem` (`20px`) | `1.3` | Start Center card titles, dialog headings |
| `--text-2xl` | `1.5rem` (`24px`) | `1.25` | Start Center hero banner, application headings |

Weights:
- `--font-normal`: `400`
- `--font-medium`: `500`
- `--font-semibold`: `600`
- `--font-bold`: `700`

### 2.3 Spacing Scale

| Token | Dimension | Application |
| :--- | :--- | :--- |
| `--space-2xs` | `2px` | Micro-gap between close icon and tab label |
| `--space-xs` | `4px` | Menu item padding, compact button padding |
| `--space-sm` | `8px` | Control spacing, toolbar icon gap, toast spacing |
| `--space-md` | `12px` | Dialog padding, card content padding, search gap |
| `--space-lg` | `16px` | Modal body padding, Start Center section gap |
| `--space-xl` | `24px` | Start Center grid gap, settings section spacing |
| `--space-2xl` | `32px` | Page hero margins, empty state container padding |

### 2.4 Density Scale

QM Editor supports two system-wide density modes via `[data-density="comfortable"]` and `[data-density="compact"]`:

| Property Token | Comfortable (Default) | Compact Mode |
| :--- | :--- | :--- |
| `--header-height` | `48px` | `40px` |
| `--statusbar-height` | `28px` | `24px` |
| `--tab-height` | `38px` | `30px` |
| `--sidebar-width` | `260px` | `230px` |
| Tree row height | `28px` | `22px` |
| Button height (sm/md) | `28px` / `34px` | `24px` / `30px` |

### 2.5 Shape, Radii & Shadows

- Radii: `--radius-xs: 2px`, `--radius-sm: 4px`, `--radius-md: 6px`, `--radius-lg: 8px`, `--radius-full: 9999px`
- Shadows:
  - `--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.15)`
  - `--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.25)`
  - `--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.35)`
  - `--shadow-elevation: 0 12px 36px rgba(0, 0, 0, 0.45)`

### 2.6 Layer Stacking Hierarchy (Z-Index Tokens)

Hardcoded arbitrary z-index numbers (`999`, `9999`, `99999`) are strictly prohibited. All elements consume centralized tokens:

| Token | Value | Applied To |
| :--- | :--- | :--- |
| `--z-base` | `1` | Base workspace canvas, editor background |
| `--z-resizer` | `10` | Splitter handles, resize dividers |
| `--z-header` | `20` | Main application header, sticky navigation |
| `--z-popover` | `50` | In-flow popovers, anchor floaters |
| `--z-dropdown` | `100` | MenuBar menus, Search options, Toolbar overflow |
| `--z-contextmenu` | `500` | Right-click context menus |
| `--z-modal` | `1000` | Dialogs, Settings, Language Selector, Confirmations |
| `--z-toast` | `2000` | Notification toasts, task progress hosts |
| `--z-banner` | `3000` | Global application alert banners |
| `--z-tooltip` | `4000` | Contextual button and status tooltips |

---

## 3. INTERACTION STATE MATRIX

Every interactive primitive and composite implements a standardized interaction state contract:

| Interactive State | Visual Presentation | Accessible Semantic Signal |
| :--- | :--- | :--- |
| **Default** | High contrast text (`--text-primary`), subtle border (`--border-color`) | Base element state |
| **Hover** | Subtle background tint (`--bg-hover`), smooth opacity transition | Pointer device hover |
| **Focus-Visible** | High contrast outline (`2px solid var(--border-focus)`), `outline-offset: 2px` | Keyboard `:focus-visible` |
| **Active / Pressed** | Visual depression, darker accent (`--accent-active`) | `aria-pressed="true"` (toggles) |
| **Selected** | Accent surface background (`--accent-subtle`), bold weight | `aria-selected="true"` (tabs, rows) |
| **Disabled** | Opacity `0.5`, `cursor: not-allowed`, no hover/click response | `disabled`, `aria-disabled="true"` |
| **Loading** | Animated spinner, action disabled, subtle pulse | `aria-busy="true"`, live text |
| **Error** | Border `--color-error`, companion icon/text | `aria-invalid="true"`, `aria-errormessage` |
| **Warning** | Border `--color-warning`, companion icon/text | `aria-invalid="false"`, warning description |

---

## 4. CANONICAL UI COMPONENTS & COMPOSITION

All UI primitives are exported exclusively from `src/components/common`:

1. **`Button` / `IconButton`:** Primary, secondary, ghost, outline, and destructive action controls with standardized `.qm-button` classes and loading states.
2. **`Input` / `Textarea` / `Select`:** Accessible form controls bound with `FormField` for automatic `label`, `description`, and `error` associations.
3. **`Toggle` / `Checkbox` / `RadioGroup` / `Slider`:** Boolean switches and value selectors with full keyboard navigation and accessible roles.
4. **`Badge` / `StatusIndicator`:** Compact categorical chips and live state dots with mandatory non-color-redundant symbols and ARIA labels.
5. **`Card` / `Panel`:** Structural containers with standardized headers, subtitles, action slots, and `.qm-panel-header` styling.
6. **`List` / `ListItem`:** Semantic row lists with leading icons, titles, secondary subtitles, badges, and trailing action slots.
7. **`Dialog` / `ConfirmDialog`:** Modal overlays featuring focus trapping (`FocusTrap`), escape key closure, and backdrop blur.
8. **`EmptyState` / `ErrorState`:** Standardized zero-data and failure presentations with illustrative icons, clear guidance, and call-to-action buttons.
9. **`Toast` / `Banner` / `Progress`:** Unified feedback components managing transient toasts, urgent banners, and background progress indicators.

---

## 5. ACCESSIBILITY, FOCUS & REDUCED MOTION

- **Focus Management:** Centralized via `FocusManager` and explicit focus scopes (`application`, `dialog`, `menu`, `contextmenu`, `commandpalette`, `quickopen`, `settings`, `terminal`, `editor`, `explorer`, `problems`).
- **Focus Restoration:** Overlays capture active element before opening and restore focus to the trigger upon dismissal.
- **High-Contrast Support:** Respects Windows High Contrast / Forced Colors (`@media (forced-colors: active)`).
- **Reduced Motion:** When `@media (prefers-reduced-motion: reduce)` is active, transitions and spinner animations collapse to instantaneous execution (`0.01ms`).
- **Color Independence:** Status and error conditions always pair color with text, badges, or distinct iconography (`✓`, `●`, `✕`, `⚠`).

---

## 6. PROHIBITED DESIGN PATTERNS

- **NO** hardcoded hex values or pixel margins in component styles.
- **NO** arbitrary z-index numbers above or outside defined tokens.
- **NO** duplicate button, dialog, or toggle implementations outside `src/components/common`.
- **NO** removing focus outlines (`outline: none`) without visible replacement.
- **NO** relying on color as the sole indicator of document save, git, or task failure states.
- **NO** loading remote web fonts, CDN icon sets, or external styles at runtime.
- **NO** blocking or resizing the editor workspace beneath minimum usable bounds (min width 300px, min height 150px).
