# QM Editor — Code Actions & Quick Fixes UX Design

## Phase 04 — Core Application Engine | Step 44

---

## 1. UX Philosophy & Design Principles

The Code Action user experience in QM Editor is designed to be fast, clear, accessible, and safe:
- **Instant Discovery:** Triggerable via standard shortcut (`Mod+.` or `Alt+Enter`), cursor context near compiler/linter errors, or direct invocation from the Problems panel.
- **Visual Clarity:** Clear distinction between preferred fixes, regular fixes, refactorings, and source actions with category icons and provider badges.
- **Safety First:** Actions affecting multiple files or performing resource operations provide an interactive side-by-side / diff preview before committing changes.
- **Non-Intrusive:** Lightbulb widgets and floating action menus never steal focus or interrupt fluid document editing.

---

## 2. Interaction Surfaces

### 2.1 Floating Action Menu (`CodeActionWidget.tsx`)
```
+-------------------------------------------------------------------+
|  (i) CODE ACTIONS (2)                                             |
|-------------------------------------------------------------------|
|  * [Sparkles] Change type to string                 [Eye] [ts]    |
|    [Wrench]   Extract into function                 [Eye] [ref]   |
|-------------------------------------------------------------------|
|  [Enter] Apply   [Esc] Close                          quickfix    |
+-------------------------------------------------------------------+
```
- **Preferred Actions:** Highlighted with a gold star icon (`Sparkles`), bold text, and default selection.
- **Preview Button:** The `[Eye]` icon opens the interactive diff modal.
- **Keyboard Navigation:** `ArrowUp` / `ArrowDown` cycle selection; `Enter` applies the selected transformation; `Escape` closes the menu.

### 2.2 Preview Modal (`CodeActionPreviewModal.tsx`)
```
+-------------------------------------------------------------------+
|  [Eye] Preview: Rename export across files             [ref]  [X] |
|-------------------------------------------------------------------|
|  /!\ This transformation modifies 2 files.                        |
|-------------------------------------------------------------------|
|  Affected Files (2)       | file1.ts                              |
|  > file1.ts           (1) | export const B = 1;                   |
|    file2.ts           (1) |                                       |
|-------------------------------------------------------------------|
|                                           [Cancel] [Apply Changes]|
+-------------------------------------------------------------------+
```
- **File List (Left):** Shows all files affected by the action with individual edit counts.
- **Diff / Code View (Right):** Shows the proposed content with monospaced syntax formatting.
- **Confirmation Action:** Pressing "Apply Changes" dispatches the transaction through `EditTransactionManager`.

---

## 3. Keyboard Shortcuts

| Shortcut | Command | Action |
|---|---|---|
| `Mod+.` | `editor.action.quickFix` | Opens Quick Fix menu for current cursor position |
| `Alt+Enter` | `editor.action.codeAction` | Opens Code Action menu for refactorings |
| `ArrowUp` / `ArrowDown` | — | Cycles through available code actions |
| `Enter` | — | Applies the currently selected code action |
| `Escape` | — | Dismisses the action menu or preview modal |

---

## 4. Accessibility & Theming

- **ARIA Roles:** Menus carry `role="menu"`, items carry `role="menuitem"`, and modals carry `role="dialog"` with `aria-modal="true"`.
- **Keyboard Trap Free:** Closing the action menu immediately returns focus to the editor text cursor.
- **Dark Glassmorphism UI:** Adheres strictly to QM Editor design tokens (`--bg-primary`, `--bg-secondary`, `--border-color`, `--text-accent`).
