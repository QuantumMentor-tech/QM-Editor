# QM Editor — Code Lens Rendering & Editor Decoration Architecture
**Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration**

---

## 1. Visual Placement & Hierarchy

Code Lens actions appear above the relevant symbol declaration line (e.g. above `class UserService` or `function calculate()`). The visual hierarchy maintains readability:

1. **Source Code**: Primary visual weight.
2. **Diagnostics**: Red/yellow squiggles on error tokens.
3. **Inlay Hints**: Inline muted type/parameter labels within the line.
4. **Code Lens**: Subordinate line block headers above the line, styled with muted typography and interactive hover states.

---

## 2. CodeMirror 6 Block Widget Implementation

Code Lens avoids altering the underlying document string or text buffer offsets by using CodeMirror 6 **Line Block Widgets**:

```ts
Decoration.widget({
  widget: new CodeLensWidget(lineData),
  block: true,
  side: -1, // Places the widget above the target line
}).range(lineData.from);
```

### Line Grouping Optimization

To prevent stacking multiple separate DOM nodes for lines that have multiple actions (e.g. `3 references | Run Test | Debug`), `LspCodeLensMapper` groups all lenses on the same line into an `EditorCodeLensLine`:

- Actions on the same line render within a single horizontal flex container (`cm-code-lens-line`).
- Lenses are sorted left-to-right by `range.start.character`.
- Multiple actions are separated by subtle bullet delimiters (`•`).
- This minimizes layout passes and prevents vertical line jumping.

---

## 3. Theme Integration & Tokens

The Code Lens theme (`LspCodeLensTheme.ts`) integrates seamlessly with QM Editor's theme tokens:

- **Action Buttons (`.cm-code-lens-action`)**:
  - `font-size: 0.82em`
  - `font-family: inherit`
  - Subtle link hover effect (`color: var(--qm-color-primary, #3b82f6)`)
  - No default focus outline ring to avoid visual clutter, but distinct accessible focus outline on keyboard `Tab` navigation.
- **Dark Mode**: Neutral slate/gray color (`#94a3b8`) with subtle blue hover (`#60a5fa`).
- **Light Mode**: Muted gray color (`#64748b`) with primary blue hover (`#2563eb`).
- **High-Contrast Mode**: Enhanced underline and contrast colors adhering to WCAG 2.1 AAA standards.

---

## 4. Accessibility & Keyboard Navigation

- **Semantic HTML**: Actions render as `<button>` elements with `type="button"`.
- **Keyboard Activation**: Actions are triggerable via `Enter` or `Space` keys.
- **ARIA Attributes**: `aria-label` provides descriptive text for screen readers (e.g. "Action: 3 references").
- **No Focus Traps**: Standard document navigation, cursor navigation, and text selection are completely unaffected by the presence of block widgets.
