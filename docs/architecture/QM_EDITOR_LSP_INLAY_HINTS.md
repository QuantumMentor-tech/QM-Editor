# QM Editor — LSP Inlay Hints Architecture
**Phase 06, Step 65 — LSP Inlay Hints, Parameter Names, Type Information & Inline Semantic Annotations**

---

## 1. Executive Summary

LSP Inlay Hints provide inline contextual annotations directly inside the editor buffer view without altering actual document text, buffer offsets, undo/redo stacks, or dirty states. This subsystem implements the LSP 3.17 `textDocument/inlayHint` protocol and cleanly maps server-provided parameter names, inferred variable types, and return types into CodeMirror 6 inline widget decorations.

---

## 2. Core Architectural Principles

1. **Strictly Non-Mutating Derived Visuals**:
   Inlay hints are pure presentation data. They do not alter document content, text models, content revisions, dirty states, filesystem content, undo/redo history, local history, backup snapshots, or recovery journals.
2. **Double Revision Guard**:
   Every request records `contentRevision` and `workspaceGeneration` at dispatch time. When a response arrives, the current document revision is compared against the dispatch revision; if the document has changed, the response is discarded immediately to prevent misaligned hints.
3. **Single Decoration Pipeline**:
   Hints are rendered via CodeMirror 6 `Decoration.widget` with `InlayHintWidget` extending `WidgetType`. No secondary decoration framework is introduced.
4. **Security & Sanitization Boundary**:
   Labels, label parts, and tooltips returned by language servers are treated as untrusted data. Text is sanitized to strip malicious script tags, iframes, and control characters. Plain text DOM nodes (`textContent`) are constructed without `innerHTML`.
5. **Subordinate Visual Theming**:
   Hints use distinct font styling (`0.85em`), subtle borders, muted opacity, and dedicated tokens for light, dark, and high-contrast modes, ensuring source code readability is never compromised.

---

## 3. Subsystem Architecture

```text
Editor / Document
        │
        ▼ (document.opened / changed)
LspInlayHintCoordinator (debouncing, cancellation)
        │
        ▼
LspInlayHintProvider
        │
        ▼ (Capability check: inlayHintProvider)
textDocument/inlayHint
        │
        ▼
Language Server
        │
        ▼
LspInlayHintResponse
        │
        ▼
LspInlayHintValidator (bounds check, XSS sanitization, DoS limits)
        │
        ▼
LspInlayHintMapper (offset conversion, sorting, padding, class assignment)
        │
        ▼
EditorInlayHintDecoration[]
        │
        ▼
LspInlayHintExtension (CodeMirror 6 StateField & InlayHintWidget)
        │
        ▼
Editor Rendering (Light / Dark / High-Contrast BaseTheme)
```

---

## 4. Component Inventory

| Component | File | Responsibilities |
| :--- | :--- | :--- |
| **Types & Contracts** | `LspInlayHintTypes.ts` | Protocol types, canonical decoration models, and cache entries |
| **Error Taxonomy** | `LspInlayHintErrors.ts` | Specific typed error classes for validation and stale responses |
| **Validator** | `LspInlayHintValidator.ts` | Coordinates validation, line bounds check, text sanitization, max caps |
| **Mapper** | `LspInlayHintMapper.ts` | Translates `(line, character)` to document offsets, sorts by `from`, formats labels |
| **Widget** | `LspInlayHintWidget.ts` | CodeMirror 6 `WidgetType` for safe DOM rendering and DOM diffing |
| **Theme** | `LspInlayHintTheme.ts` | CodeMirror 6 `baseTheme` styles for dark, light, and high-contrast modes |
| **Extension** | `LspInlayHintExtension.ts` | CodeMirror 6 `StateField`, effects, and transaction mapping |
| **Provider** | `LspInlayHintProvider.ts` | Client request dispatcher, range calculation, cache, stale check |
| **Coordinator** | `LspInlayHintCoordinator.ts` | Event lifecycle orchestrator, debouncer, cancellation tracker |

---

## 5. Configuration & Settings

| Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `lsp.inlayHints.enabled` | `boolean` | `true` | Master switch for LSP inlay hints |
| `lsp.inlayHints.typeHints` | `boolean` | `true` | Enables display of inferred type annotations |
| `lsp.inlayHints.parameterNames` | `boolean` | `true` | Enables display of parameter name annotations |
| `lsp.inlayHints.requestDebounceMs` | `number` | `250` | Debounce interval after document edits |
