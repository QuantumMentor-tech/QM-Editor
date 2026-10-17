# QM Editor — Semantic Highlighting Integration & Accessibility Specification
**Phase 06 — Advanced Features | Step 64 of 135**

---

## 1. Syntax vs. Semantic Highlighting Relationship

QM Editor maintains a strict layered relationship between lexical syntax highlighting and LSP semantic highlighting:

```text
Editor Rendering Stack (Bottom to Top)
─────────────────────────────────────────────────────────────
[Top Layer]    Diagnostic Squiggles & Markers (Errors / Warnings)
[Layer 4]      Active Selection & Find Match Highlights
[Layer 3]      LSP Semantic Token Decorations (Class / Type / Modifiers)
[Layer 2]      Lexical Syntax Highlighting (Keywords / Literals / Strings)
[Bottom Layer] Base Document Text & Editor Canvas
─────────────────────────────────────────────────────────────
```

### Precedence Rules
1. **Lexical Baseline**: Lexical tokenization runs synchronously on every keystroke via Lezer grammars. Text is never uncolored while waiting for language server responses.
2. **Semantic Overlay**: When an LSP response arrives and passes validation, semantic decorations layer on top of lexical tokens.
3. **Diagnostic Supremacy**: Semantic styles never obscure or alter diagnostic squiggles (`cm-diagnostic-error`, `cm-diagnostic-warning`).
4. **Selection & Search Invariance**: Semantic tokens use `color` and `font-style` attributes exclusively. They never define opaque backgrounds that could hide active text selection, current-line highlights, or search match highlights.

---

## 2. Dynamic Theme Switching

When the user switches between themes (Dark, Light, High Contrast):
- Themes are applied purely via CSS classes and CSS custom variables (`.cm-dark` vs `&:not(.cm-dark)`).
- **No LSP server restart is required**.
- **No protocol re-tokenization request is required**.
- The existing CodeMirror 6 `DecorationSet` continues pointing to canonical class names, which instantly adopt the newly active theme colors.

---

## 3. Accessibility & High-Contrast Mode

To guarantee accessibility for users with color vision differences and users relying on system high-contrast modes:

1. **Information Redundancy**: Deprecated symbols receive an explicit `line-through` text decoration rather than relying solely on low-contrast opacity.
2. **Forced Colors Media Query**:
   ```css
   @media (forced-colors: active) {
     .cm-semantic-type,
     .cm-semantic-class,
     .cm-semantic-function,
     .cm-semantic-variable {
       color: CanvasText !important;
     }
     .cm-semantic-mod-deprecated {
       text-decoration: line-through !important;
     }
   }
   ```
3. **Contrast Ratio Compliance**: All default dark and light theme colors maintain a minimum 4.5:1 contrast ratio against editor backgrounds in compliance with WCAG 2.1 AA guidelines.

---

## 4. User Configuration

Semantic highlighting is controlled via standard user preferences:
- `lsp.semanticTokens.enabled` (Boolean, default: `true`): Toggles semantic token requests and decorations. When disabled, the editor cleanly uses pure lexical syntax highlighting.
- `lsp.semanticTokens.enableDeltas` (Boolean, default: `true`): Enables incremental delta protocol synchronization (`textDocument/semanticTokens/full/delta`).
- `lsp.semanticTokens.requestDebounceMs` (Number, default: `250`): Debounce period in milliseconds applied to document edits before dispatching token requests.
