# QM Editor — Document Link Rendering, Theme & Accessibility

## Phase 06 — Advanced Features (Step 67 of 135)

---

## 1. Non-Destructive CodeMirror 6 Decoration Architecture

Document links in QM Editor are rendered using CodeMirror 6 `Decoration.mark` inside an isolated `StateField<DecorationSet>`.

### Invariants:
1. **Zero Text Mutation**: Links never modify source text, line breaks, indentation, or buffer lengths.
2. **Derived Presentation**: The `StateField` is driven entirely by `setDocumentLinksEffect` and `clearDocumentLinksEffect`.
3. **Ascending Range Ordering**: All link ranges are sorted ascending by `(from, to)` to strictly satisfy CodeMirror's RangeSet invariant.
4. **Coexistence with Diagnostics, Inlay Hints & Code Lens**:
   - Link decorations use the CSS class `.cm-document-link`.
   - Diagnostics occupy separate diagnostic underline marks (`.cm-diagnostic-error`, etc.) without visual collisions.
   - Inlay hints (Step 65) use `Decoration.widget` and do not intercept link click ranges.
   - Code Lens (Step 66) renders above lines as block widgets (`Decoration.widget({ block: true })`).

---

## 2. Visual Styling & Theme Integration

Links are styled via `LspDocumentLinkTheme`:

- **Default Appearance**: Subtle dotted underline (`border-bottom: 1px dotted var(--qm-link-color, #4ea8de)`).
- **Hover State**: Cursor changes to `pointer`, solid underline, subtle background tint.
- **Classification Badges**:
  - `cm-document-link-external`: Distinguishes web URLs with visual cues.
  - `cm-document-link-outside`: Highlights references outside the workspace.
- **High-Contrast Support**:
  - Uses `@media (forced-colors: active)` and explicit `LinkText` system colors to guarantee visibility without relying on color alone.

---

## 3. Keyboard Activation & Accessibility

Document links comply with accessibility guidelines:
- **Keyboard Access**: Users can navigate cursor into the link range and press `Enter` or `Space` to activate.
- **ARIA & Tooltips**:
  - Each link decoration includes `role="link"` and `tabindex="0"`.
  - Accessible name (`aria-label`) describes the action (e.g. `"Open external web link: https://..."` or `"Navigate to ./config.json"`).
  - Native browser tooltip (`title`) provides sanitized hover information.
