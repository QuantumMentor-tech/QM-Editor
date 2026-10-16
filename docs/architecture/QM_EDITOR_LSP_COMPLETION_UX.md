# QM Editor — LSP Completion UX & Interaction Design

## Phase 06 — Advanced Features (Step 58 of 135)

---

# 1. Unified Suggestion UI Principle

QM Editor adheres to a strict single-UI policy: **there is no secondary or LSP-specific completion popup**.

All completion items—whether generated from an external Language Server Protocol process, internal TypeScript/JavaScript intelligence, or fallback word tokenizers—flow through the canonical `CompletionCoordinator` and render in the established editor suggestion widget.

---

# 2. Lifecycle UI States

The suggestion widget transitions through six deterministic states:

```text
[Idle] ──(typing / Ctrl+Space)──► [Loading / In-Flight]
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  ▼                       ▼                       ▼
            [Results / List]       [Incomplete List]           [Empty]
                  │                       │
           (select item)             (continue typing)
                  ▼                       ▼
          [Resolve Details]       [Refetch Query]
                  │
            (Enter / Tab)
                  ▼
              [Accepted] ──► [Idle]
```

1. **Idle**: Editor typing proceeds normally with zero layout shifts.
2. **Loading**: If provider queries take longer than 80ms, a subtle loading spinner or shimmer is shown in the suggestion widget footer.
3. **Results**: Canonical items render with standard semantic icons corresponding to `CompletionItemKind`, item labels, and right-aligned detail signatures.
4. **Incomplete Results (`isIncomplete: true`)**: Indicates the server provided a partial list based on current prefix. As the user continues typing, queries are refreshed dynamically.
5. **Empty**: If no providers find matching completions, the widget dismisses cleanly without intrusive error messages.
6. **Error / Unavailable**: If the language server crashes or is unavailable, the failure is contained silently. The editor continues to work without disruption, and other providers participate normally.

---

# 3. Keyboard Navigation & Interaction

| Keybinding | Action | Behavior |
| :--- | :--- | :--- |
| `ArrowDown` / `ArrowUp` | Navigate Selection | Moves selection highlight up/down; triggers debounced `resolveCompletionItem` for documentation. |
| `Enter` / `Tab` | Accept Completion | Validates document revision, executes atomic `EditTransaction`, advances cursor. |
| `Escape` | Dismiss | Closes completion widget, cancels active in-flight request, restores editor focus. |
| Commit Characters | Accept & Commit | If an item declares commit characters (e.g. `.`, `(`, `;`), typing that character commits the suggestion and inserts the character. |

---

# 4. Accessibility & Screen Reader Support

- Suggestion list utilizes `role="listbox"` with `aria-activedescendant` identifying the highlighted suggestion.
- Each item announces its label, semantic kind (`method`, `variable`, `keyword`), and detail.
- Documentation updates are announced via `aria-live="polite"` regions so assistive technology users understand signatures and docstrings without losing their place in the editor.
