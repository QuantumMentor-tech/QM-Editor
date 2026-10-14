# QM Editor — Completion UX Design
**Phase 04 — Core Application Engine (Step 42 of 135)**

---

## 1. Executive Summary

The **Suggest Widget** provides an accessible, high-performance suggestion list anchored to the editor cursor. It respects established QM Editor keyboard navigation conventions, high-contrast theming, and focus safety.

---

## 2. Invocation Triggers

1. **Manual Invocation**:
   - Shortcut: `Ctrl+Space` (or `Cmd+Space` on macOS).
   - Command: `editor.action.triggerSuggest`.
   - Queries providers with `triggerKind: 'invoked'`.
2. **Trigger Character Invocation**:
   - Activated when typing a character declared in provider capabilities (e.g. `.` for property access, `:` for types).
   - Queries providers with `triggerKind: 'triggerCharacter'`.
3. **Automatic Invocation (Continuous Typing)**:
   - Activated after alphanumeric word typing when `editor.suggest.enabled` is true.
   - Respects debouncing and stale request invalidation.

---

## 3. Keyboard Interaction & Focus Safety

The suggest widget integrates with the editor surface without stealing system focus:
- `ArrowDown` / `ArrowUp`: Navigates through suggestions cyclically.
- `Enter` / `Tab`: Accepts the currently focused suggestion item.
- `Escape`: Dismisses the widget without inserting text.
- `PageDown` / `PageUp`: Scrolls suggestions by page.

Focus remains authoritative in the editor buffer; typing normal text updates the buffer and dynamically filters suggestion list items.

---

## 4. Accessibility & Visual Design

1. **ARIA Compliance**:
   - Container has `role="listbox"`, `aria-label="Code Suggestions"`.
   - Items have `role="option"`, `aria-selected` tracking active index.
   - Live regions announce item details for screen readers.
2. **Visual Hierarchy**:
   - Kind badges indicate semantic category (function, method, keyword, variable, class, text).
   - Right-aligned detail column shows short type signatures or provider labels.
   - Side detail flyout displays detailed documentation when available.
3. **Theming**:
   - Uses CSS variables (`--qm-bg-secondary`, `--qm-border`, `--qm-accent`, `--qm-text-primary`) for seamless theme consistency.
