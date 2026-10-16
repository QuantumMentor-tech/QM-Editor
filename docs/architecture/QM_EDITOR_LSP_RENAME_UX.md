# QM Editor LSP Rename UX & Interaction Guidelines
**Phase 06 — Advanced Features | Step 62 of 135**

---

## 1. User Experience Principles

1. **Inline Convenience**: Pressing `F2` opens a lightweight, floating input box docked directly above the symbol identifier in the editor, pre-filled with the current symbol name and pre-selected for instant editing.
2. **Context Menu Access**: Right-clicking any code token provides "Rename Symbol (F2)" in the context menu.
3. **No Flashing Modals**: If an element cannot be renamed (e.g. keywords, operators, read-only external modules), `prepareRename` fails silently and delivers a toast notification ("You cannot rename this element.") without interrupting user typing with an empty dialogue.
4. **Instant Validation**: The inline input performs instant client-side validation as the user types:
   - Identical name warning ("New name must be different from current name").
   - Invalid identifier warning (whitespace, linebreaks, control characters).
   - Enter is disabled when invalid.
5. **Escape Abort**: Pressing `Escape` immediately closes the rename widget and returns focus to the editor cursor without making any changes.
6. **Preview Mode**: Complex or multi-file renames can be previewed non-mutatingly before execution.
