# QM Editor — Professional UI Component Library & Design System Specification

**Version:** 3.0.0 (Phase 03 Final Consolidated Release)  
**Status:** Approved & Hardened Component Architecture  
**Last Updated:** October 12, 2026  

---

## 1. Overview & Architectural Philosophy

The **QM Editor UI Component Library** is the foundational visual and interactive vocabulary of the application. It provides typed, accessible, theme-aware, and responsive building blocks across all editor surfaces:
- Explorer and Workspace
- Menus, Toolbars, and Context Menus
- Unified Settings and Modals
- Terminal, Source Control, Tasks, and Problems
- Notifications, Progress, and Feedback Hosts
- Start Center and Empty States

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

**Core Boundary:** Business logic, document buffers, and process execution must **never** be placed inside UI primitives. Primitives emit interaction events and accept presentation props; commands and services execute business logic.

---

## 2. Reusable Component Inventory

All primitives and composites are centralized and exported from `src/components/common/index.ts`:

| Component | Category | Purpose | Key Props & Contract | Standardized CSS Class |
| :--- | :--- | :--- | :--- | :--- |
| **`Button`** | Primitive | Primary and secondary user actions | `variant` (`primary`, `secondary`, `ghost`, `outline`, `destructive`), `size` (`sm`, `md`, `lg`), `icon`, `trailingIcon`, `isLoading`, `loadingText`, `fullWidth` | `.qm-button`, `.qm-button-[variant]`, `.qm-button-[size]` |
| **`IconButton`** | Primitive | Icon-only action button | `icon`, `aria-label` (required), `variant`, `size`, `active` (`aria-pressed`) | `.qm-icon-button`, `.qm-icon-button-[variant]` |
| **`Input`** | Primitive | Single-line text input | `inputSize`, `variant` (`default`, `error`, `warning`), `leadingIcon`, `trailingIcon`, `clearable`, `onClear`, `isInvalid` | `input[type="text"]` |
| **`Textarea`** | Primitive | Multiline text input | `textareaSize`, `variant`, `resize` (`none`, `vertical`, `horizontal`, `both`), `isInvalid` | `textarea` |
| **`FormField`** | Composite | Accessible form label/description/error wrapper | `id`, `label`, `description`, `error`, `warning`, `required`, automatic `aria-describedby` & `aria-invalid` binding | Form layout wrapper |
| **`Select`** | Primitive | Accessible option selection | `options: SelectOption[]`, `selectSize`, `variant`, `placeholder`, `value`, `onChange` | `select` |
| **`Checkbox`** | Primitive | Boolean selection with label | `checked`, `indeterminate`, `onChange`, `label`, `description`, `isInvalid` | Accessible checkbox |
| **`Toggle`** | Primitive | Immediate boolean setting switch | `checked`, `onChange`, `label`, `description`, `size`, `role="switch"`, `aria-checked` | Accessible switch |
| **`RadioGroup`** | Composite | Mutually exclusive options group | `name`, `options: RadioOption[]`, `value`, `onChange`, `orientation`, roving keyboard arrow navigation | Roving tabindex group |
| **`Slider`** | Primitive | Numeric range adjustment | `min`, `max`, `step`, `value`, `onChange`, `label`, `showValue`, `formatValue` | Range slider |
| **`Badge`** | Primitive | Compact status badge / chip | `variant` (`primary`, `secondary`, `accent`, `warning`, `success`, `error`, `neutral`, `muted`), `size` (`sm`, `md`), `icon` | Status badge chip |
| **`StatusIndicator`** | Primitive | Live state indicator (non-color redundant) | `status` (`saved`, `dirty`, `error`, `syncing`, `info`, `warning`, `offline`, `online`), `compact`, `role="status"` | Status dot with symbol |
| **`Tooltip`** | Composite | Delayed contextual tooltip | `content`, `children`, `placement` (`top`, `bottom`, `left`, `right`), `delayMs`, `role="tooltip"` | Floating tooltip |
| **`Popover`** | Composite | Contextual non-modal popup | `isOpen`, `onClose`, `children`, `anchorEl`, escape dismissal, outside-click close | Floating popover |
| **`Divider`** | Primitive | Visual and structural separator | `orientation` (`horizontal`, `vertical`), `spacing` (`none`, `sm`, `md`, `lg`), `label`, `role="separator"` | Divider line |
| **`Card`** | Composite | Structured content container | `Card`, `CardHeader` (title, description, actions), `CardContent`, `CardFooter`, `onClick` | `.qm-card-clickable` (when interactive) |
| **`Panel`** | Composite | Flexible collapsible panel | `Panel`, `PanelHeader` (leading, title, actions), `PanelContent`, `PanelFooter` | `.qm-panel-header` |
| **`Dialog`** | Composite | Modal dialog with focus trap | `isOpen`, `onClose`, `title`, `children`, `FocusTrap` integration, `var(--z-modal)` | Modal dialog |
| **`List`** | Composite | Semantic list container | `List` (`role="list"`), `ListItem` (`leading`, `title`, `secondary`, `trailing`, `selected`, `onClick`) | `.qm-list-item` |
| **`Loading`** | Primitive | Activity feedback | `Spinner` (`size`, `label`, `aria-live="polite"`), `Skeleton` (`width`, `height`, `borderRadius`) | Accessible spinner |
| **`EmptyState`** | Pattern | Empty / zero-data placeholder | `icon`, `title`, `description`, `action`, `secondaryAction` | Centered empty banner |
| **`ErrorState`** | Pattern | Diagnostic failure placeholder | `title`, `message`, `details`, `onRetry`, `action`, expandable details toggle | Centered error banner |

---

## 3. Standard Interaction States

Every interactive component supports a standardized set of states powered by CSS custom properties and standardized CSS classes:

```
[Default] ──> [Hover] ──> [Focus-Visible] ──> [Active/Pressed]
    │             │              │                  │
    └─────────────┴──────────────┴──────────────────┴──> [Disabled]
                                                          [Loading] (aria-busy)
                                                          [Error / Warning]
```

1. **Default:** Clean, high-contrast text and border tokens (`--text-primary`, `--border-color`).
2. **Hover:** Subtle background shift (`--bg-hover`, `.qm-button:hover`, `.qm-icon-button:hover`, `.qm-list-item:hover`) without jarring layout shifts or color shifts.
3. **Focus-Visible:** Mandatory high-contrast outline (`2px solid var(--border-focus)`, `outline-offset: 2px`). In forced colors / high-contrast OS mode, maps to `Highlight`.
4. **Active / Pressed:** Visual depression / color change (`--accent-active`, `.qm-button:active`). For toggles, exposes `aria-pressed="true"`.
5. **Disabled:** Reduced opacity (`0.5` - `0.6`), `cursor: not-allowed`, interactive listeners disabled.
6. **Loading:** Exposes `aria-busy="true"`, disables re-activation, displays animated spinner with accessible live text.
7. **Error / Warning:** Semantic border color (`var(--color-error)` / `var(--color-warning)`), companion icon or text, and `aria-invalid="true"`.

---

## 4. Developer Quick-Answers Guide

Future engineering agents and developers should use these direct architectural patterns:

| Question | Standard Solution |
| :--- | :--- |
| **Which Button should I use?** | Import `{ Button }` from `src/components/common`. Use `variant="primary"` for main dialog/form submission, `variant="secondary"` for standard actions, `variant="ghost"` for toolbars, or `variant="destructive"` for deletions. |
| **Which dialog should I use?** | For general modal workflows, use `{ Dialog }` from `src/components/common`. For destructive confirmations, use `{ ConfirmDialog }` from `src/components/feedback` or `useFeedback().confirm()`. Never use `window.confirm()`. |
| **How do I show an error?** | For transient errors, call `useFeedback().showToast({ message, severity: 'error' })`. For persistent component failures, render `<ErrorState title="..." message="..." onRetry={...} />`. |
| **How do I show progress?** | For inline loading, use `<Spinner size="sm" />`. For long-running background tasks, call `useFeedback().startProgress({ title, determinate: false })`. |
| **How do I add a menu command?** | Register your command in `globalCommandRegistry.registerCommand({...})` in `src/core/commands/defaultCommands.ts`. It automatically becomes accessible via MenuBar, Command Palette, and Quick Open. |
| **How do I add a shortcut?** | Specify `defaultShortcut: 'Mod+Shift+...'` in your command registration, or bind it directly via `globalShortcutManager.registerShortcut({...})`. |
| **How do I add a setting?** | Register the setting schema in `SettingsRegistry.registerSetting({...})` with category, type, and default value. It automatically renders in `UnifiedSettingsModal`. |
| **How do I add a new panel?** | Extend `PanelTabId` in `src/state/ShellContext.tsx`, add your panel to `SecondaryPanel.tsx`, and render standard header using `PanelHeader`. |
| **How do I create an accessible input?** | Wrap `<Input id="my-field" ... />` inside `<FormField id="my-field" label="My Field" error={error}>`. Automatic ARIA attributes are wired immediately. |
| **How do I add a new empty state?** | Render `<EmptyState icon={Folder} title="No Items" description="Add items to get started" action={<Button ...>Add Item</Button>} />`. |
| **How do I persist layout state?** | Centralized layout state automatically persists to `localStorage` through `ShellContext` and `SessionService`. Never write custom layout persistence keys. |

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
