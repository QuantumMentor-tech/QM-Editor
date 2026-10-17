# QM Editor — Unified Folding Engine & Structural Navigation

## Phase 06 — Advanced Features (Step 68 of 135)

---

## 1. Unified Folding Architecture

QM Editor maintains **one single authoritative user-facing fold state** managed by CodeMirror 6. There is no parallel "LSP fold state" competing with the editor.

### Separation of Responsibilities

```
Folding Range Structure (Language Server Intelligence)
        ↓
Normalized Hierarchy (LspFoldingTreeBuilder)
        ↓
Registered Facet (CodeMirror foldService)
        ↓
Authoritative Visual Fold State (CodeMirror foldState / DecorationSet)
        ↓
User Interaction & Gutter Controls
```

- **LSP Provider**: Proposes where code can be folded based on semantic AST analysis.
- **Document Engine**: Tracks document content, revisions, and dirty state. Folding never alters document text or revisions.
- **Editor Engine**: Renders fold markers in the gutter, manages expanded/collapsed state, and handles keyboard shortcuts.
- **Commands**: Dispatches `foldAll`, `unfoldAll`, `toggleFold` through the editor instance.

---

## 2. Coexistence with Other Editor Layers

1. **Diagnostics (Step 57)**:
   - Diagnostics within collapsed regions remain tracked by `DiagnosticService` and visible in the Problems panel.
   - Line numbers in the gutter accurately reflect document line positions.
2. **Inlay Hints (Step 65)**:
   - Inlay hints inside collapsed lines are hidden as part of the folded range without creating ghost DOM elements.
3. **Code Lens (Step 66)**:
   - Block widget lenses above lines collapse cleanly when the line's containing block is folded, and reappear when expanded.
4. **Document Links (Step 67)**:
   - Links inside collapsed text are hidden and do not intercept click events until the region is unfolded.
5. **Search & Replace (Step 37)**:
   - Search queries match against the full document text. Navigating to a match inside a collapsed region automatically unfolds the containing block.
