# QM Editor — Professional UI Component Library & Design System Specification

> **Phase 03 — Step 26**  
> **Document Status:** Active & Standardized Source of Truth

---

## 1. Overview & Architectural Philosophy

The **QM Editor UI Component Library** is the foundational visual and interactive vocabulary of the application. It provides typed, accessible, theme-aware, and responsive building blocks across all editor surfaces:
- Explorer and Workspace
- Menus, Toolbars, and Context Menus
- Unified Settings and Modals
- Terminal, Source Control, Tasks, and Problems
- Notifications, Progress, and Feedback Hosts

### Layer Separation Model
```
┌────────────────────────────────────────────────────────┐
│ 4. Feature Modules (File Explorer, Git, Terminal, etc.)│
├────────────────────────────────────────────────────────┤
│ 3. Patterns (SettingsRow, ExplorerRow, ProblemRow)     │
├────────────────────────────────────────────────────────┤
│ 2. Composites (FormField, Card, List, Toolbar, Panel)  │
├────────────────────────────────────────────────────────┤
│ 1. Primitives (Button, IconButton, Input, Badge, etc.) │
└────────────────────────────────────────────────────────┘
```
**Core Boundary:** Business logic, document editing, and process execution must **never** be placed inside UI primitives. Primitives emit interaction events and accept presentation props; commands and services execute business logic.

---

## 2. Reusable Component Inventory

All primitives and composites are centralized and exported from `src/components/common/index.ts`:

| Component | Category | Purpose | Key Props & Contract |
| :--- | :--- | :--- | :--- |
| **`Button`** | Primitive | Primary and secondary user actions | `variant` (`primary`, `secondary`, `ghost`, `outline`, `destructive`), `size` (`sm`, `md`, `lg`), `icon`, `trailingIcon`, `isLoading`, `loadingText`, `fullWidth` |
| **`IconButton`** | Primitive | Icon-only action button | `icon`, `aria-label` (required), `variant`, `size`, `active` (`aria-pressed`) |
| **`Input`** | Primitive | Single-line text input | `inputSize`, `variant` (`default`, `error`, `warning`), `leadingIcon`, `trailingIcon`, `clearable`, `onClear`, `isInvalid` |
| **`Textarea`** | Primitive | Multiline text input | `textareaSize`, `variant`, `resize` (`none`, `vertical`, `horizontal`, `both`), `isInvalid` |
| **`FormField`** | Composite | Accessible form label/description/error wrapper | `id`, `label`, `description`, `error`, `warning`, `required`, automatic `aria-describedby` & `aria-invalid` binding |
| **`Select`** | Primitive | Accessible option selection | `options: SelectOption[]`, `selectSize`, `variant`, `placeholder`, `value`, `onChange` |
| **`Checkbox`** | Primitive | Boolean selection with label | `checked`, `indeterminate`, `onChange`, `label`, `description`, `isInvalid` |
| **`Toggle`** | Primitive | Immediate boolean setting switch | `checked`, `onChange`, `label`, `description`, `size`, `role="switch"`, `aria-checked` |
| **`RadioGroup`** | Composite | Mutually exclusive options group | `name`, `options: RadioOption[]`, `value`, `onChange`, `orientation`, roving keyboard arrow navigation |
| **`Slider`** | Primitive | Numeric range adjustment | `min`, `max`, `step`, `value`, `onChange`, `label`, `showValue`, `formatValue` |
| **`Badge`** | Primitive | Compact status badge / chip | `variant` (`primary`, `secondary`, `accent`, `warning`, `success`, `error`, `neutral`, `muted`), `size` (`sm`, `md`), `icon` |
| **`StatusIndicator`** | Primitive | Live state indicator (non-color redundant) | `status` (`saved`, `dirty`, `error`, `syncing`, `info`, `warning`, `offline`, `online`), `compact`, `role="status"` |
| **`Tooltip`** | Composite | Delayed contextual tooltip | `content`, `children`, `placement` (`top`, `bottom`, `left`, `right`), `delayMs`, `role="tooltip"` |
| **`Popover`** | Composite | Contextual non-modal popup | `isOpen`, `onClose`, `children`, `anchorEl`, escape dismissal, outside-click close |
| **`Divider`** | Primitive | Visual and structural separator | `orientation` (`horizontal`, `vertical`), `spacing` (`none`, `sm`, `md`, `lg`), `label`, `role="separator"` |
| **`Card`** | Composite | Structured content container | `Card`, `CardHeader` (title, description, actions), `CardContent`, `CardFooter` |
| **`Panel`** | Composite | Flexible collapsible panel | `Panel`, `PanelHeader` (leading, title, actions), `PanelContent`, `PanelFooter` |
| **`Dialog`** | Composite | Modal dialog with focus trap | `isOpen`, `onClose`, `title`, `children`, `FocusTrap` integration, `var(--z-modal)` |
| **`List`** | Composite | Semantic list container | `List` (`role="list"`), `ListItem` (`leading`, `title`, `secondary`, `trailing`, `selected`, `onClick`) |
| **`Loading`** | Primitive | Activity feedback | `Spinner` (`size`, `label`, `aria-live="polite"`), `Skeleton` (`width`, `height`, `borderRadius`) |
| **`EmptyState`** | Pattern | Empty / zero-data placeholder | `icon`, `title`, `description`, `action`, `secondaryAction` |
| **`ErrorState`** | Pattern | Diagnostic failure placeholder | `title`, `message`, `details`, `onRetry`, `action`, expandable details toggle |

---

## 3. Standard Interaction States

Every interactive component supports a standardized set of states powered by CSS custom properties:

```
[Default] ──> [Hover] ──> [Focus-Visible] ──> [Active/Pressed]
    │             │              │                  │
    └─────────────┴──────────────┴──────────────────┴──> [Disabled]
                                                          [Loading] (aria-busy)
                                                          [Error / Warning]
```

1. **Default:** Clean, high-contrast text and border tokens (`--text-primary`, `--border-color`).
2. **Hover:** Subtle background shift (`--bg-hover`) without jarring layout shifts or color shifts.
3. **Focus-Visible:** Mandatory high-contrast outline (`2px solid var(--border-focus)`, `outline-offset: 2px`). In forced colors / high-contrast OS mode, maps to `Highlight`.
4. **Active / Pressed:** Visual depression / color change. For toggles, exposes `aria-pressed="true"`.
5. **Disabled:** Reduced opacity (`0.5` - `0.6`), `cursor: not-allowed`, interactive listeners disabled.
6. **Loading:** Exposes `aria-busy="true"`, disables re-activation, displays animated spinner with accessible live text.
7. **Error / Warning:** Semantic border color (`var(--color-error)` / `var(--color-warning)`), companion icon or text, and `aria-invalid="true"`.

---

## 4. Theme & High-Contrast Adaptation

All components strictly consume CSS design tokens defined in `src/index.css`:
- **Dark Mode (Default):** Deep dark palette (`#0f172a`, `#1e293b`, `#090d16`).
- **Light Mode (`[data-theme="light"]`):** Clean light palette (`#f8fafc`, `#ffffff`, `#e2e8f0`).
- **Forced Colors / Windows High Contrast:** Respects OS color overrides (`forced-colors: active`).
- **Reduced Motion:** When `@media (prefers-reduced-motion: reduce)` is active, animations and transitions collapse to `0.01ms`.

---

## 5. Preferred vs Forbidden Patterns

### Preferred Patterns
- **Action button:** Use `Button` with variant (`primary`, `secondary`, `ghost`, `destructive`).
- **Icon action:** Use `IconButton` with required `'aria-label'`.
- **Form controls:** Wrap inputs in `FormField` to get automatic label and error binding.
- **Selection:** Use `Select` for dropdown options, `RadioGroup` for small exclusive lists.
- **Preferences:** Use `Toggle` for on/off settings.
- **Status badges:** Use `Badge` or `StatusIndicator` with semantic symbol (non-color redundant).
- **Empty / Error states:** Use `EmptyState` and `ErrorState` with actionable retry buttons.

### Forbidden Patterns
- ❌ **NO** inline `<div role="button">` when a native `<button>` can be used.
- ❌ **NO** bespoke modal implementations bypassing `Dialog` or `ConfirmDialog`.
- ❌ **NO** color-only status indicators (e.g., a green dot without text or icon symbol).
- ❌ **NO** arbitrary `z-index: 999999` numbers (always use `--z-base` through `--z-tooltip`).
- ❌ **NO** inline form labels without `htmlFor` / `id` association.
- ❌ **NO** positive `tabindex` values (> 0).
- ❌ **NO** browser-native `alert()` or `confirm()`.
