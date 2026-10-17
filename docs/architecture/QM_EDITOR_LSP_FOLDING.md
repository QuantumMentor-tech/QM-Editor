# QM Editor — LSP Folding Architecture

## Phase 06 — Advanced Features (Step 68 of 135)

---

## 1. Executive Summary

LSP Folding Ranges provide structural code folding suggestions (functions, classes, methods, namespaces, imports, comments, and custom regions) computed by language servers.

In QM Editor, language server folding ranges are treated as **untrusted structural suggestions**. The language server informs the editor *where* code can be folded, while the editor remains strictly authoritative over *whether* a range is collapsed or expanded.

LSP folding integrates directly into the native editor folding architecture (CodeMirror 6 `foldService`, `codeFolding`, `foldGutter`, and `foldKeymap`), preserving existing syntax/indentation folding as an automatic fallback whenever LSP folding is unavailable, loading, or unconfigured.

---

## 2. Architecture & Ownership Model

```
Editor / Active Document
        │
        ▼
Document + Language Context
        │
        ▼
Language Intelligence Coordinator
        │
        ▼
LspFoldingCoordinator
        │
        ▼
LspFoldingProvider
        │
        ▼
textDocument/foldingRange (JSON-RPC)
        │
        ▼
LSP Folding Range Response
        │
        ▼
Validation (LspFoldingValidator)
        │
        ▼
Hierarchy & Nesting (LspFoldingTreeBuilder)
        │
        ▼
Canonical & Editor Mapping (LspFoldingMapper)
        │
        ▼
CodeMirror 6 foldService / EditorAdapter
        │
  ┌─────┴─────────────────────────┐
  ▼                               ▼
LSP Range Match           Fallback to Syntax
(fold marker rendered)    (brace/indent fold)
        │                         │
        └──────────────┬──────────┘
                       ▼
            User Fold State & Gutter
```

### Subsystem Boundaries

| Subsystem | Sole Authority & Ownership |
|---|---|
| **LspClient** | Protocol communication, JSON-RPC lifecycle, capability advertisement |
| **LspFoldingProvider** | LSP protocol adaptation for `textDocument/foldingRange`, stale revision protection |
| **LspFoldingValidator** | Boundary checking, numeric sanity, collapsed text sanitization, DoS limits |
| **LspFoldingTreeBuilder** | Hierarchical nesting, duplicate elimination, non-nested overlap resolution |
| **LspFoldingMapper** | 0-based LSP lines to buffer character offsets `(from, to)` |
| **LspFoldingExtension** | CodeMirror 6 `foldService` facet, `foldingRangesField`, custom `codeFolding` |
| **EditorAdapter** | Authoritative user-facing fold state (`foldAll`, `unfoldAll`, `toggleFold`) |

---

## 3. Protocol Scope & Capability Negotiation

1. **Client Capabilities**:
   - Advertises `textDocument.foldingRange`:
     - `dynamicRegistration: false`
     - `rangeLimit: 5000`
     - `lineFoldingOnly: false`
     - `foldingRangeKind: { valueSet: ['comment', 'imports', 'region'] }`
     - `foldingRange: { collapsedText: true }`
2. **Server Capabilities**:
   - Inspects `serverCapabilities.foldingRangeProvider`.
   - Distinguishes:
     - `unsupported` (`undefined` / `null` / `false`)
     - `supported` (`true` or configuration object)

---

## 4. Fallback Strategy & Native Folding Continuity

LSP folding enhances rather than replaces native editor folding:
1. When LSP folding ranges are present: CodeMirror's `foldService` matches the start line and applies the language server's structural range.
2. When on a line with no LSP range, or when LSP is disabled, unsupported, or returns empty `[]`: `foldService` returns `null`, prompting CodeMirror to automatically query the Lezer syntax tree (`foldNodeProp`) and indentation folding.
3. Folding commands (`Toggle Fold`, `Fold All`, `Unfold All`, `Ctrl+Shift+[` / `Ctrl+Shift+]`) continue to work seamlessly in all situations.
