# QM Editor — LSP Document Links Architecture

## Phase 06 — Advanced Features (Step 67 of 135)

---

## 1. Executive Summary

LSP Document Links provide contextual resource references embedded inside source code (e.g. `import "./config.json"`, `href="./docs/api.md"`, `require("./module")`, `#include "header.h"`, `https://example.com`) discovered by language servers.

In QM Editor, Document Links are treated as **untrusted navigation proposals** rather than execution privileges. Every link returned by an LSP server passes through a centralized security validation pipeline before being rendered as a subtle inline decoration or passed to the `NavigationCoordinator`.

---

## 2. Architecture & Ownership Model

```
Editor / Active Document
        │
        ▼
Document + Workspace Context
        │
        ▼
Language Intelligence Coordinator
        │
        ▼
LspDocumentLinkCoordinator
        │
        ▼
LspDocumentLinkProvider
        │
        ▼
textDocument/documentLink (JSON-RPC)
        │
        ▼
LSP Document Link Response
        │
        ▼
LspDocumentLinkSecurityValidator (Validation / URI Security)
        │
        ▼
Canonical QM Document Link Model (LspDocumentLinkMapper)
        │
        ├────────────────────────────┐
        ▼                            ▼
Editor Link Renderer (CodeMirror 6)   LspDocumentLinkResolver
        │                            │
        │                            ▼
        │                      documentLink/resolve
        │                            │
        └──────────────┬─────────────┘
                       ▼
             Navigation Coordinator
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
Same-Workspace Resource         Approved External URI
          │                         │
          ▼                         ▼
   Document Engine          External Link Policy (Browser Open)
          │
          ▼
Editor / Resource Viewer
```

### Subsystem Boundaries

| Subsystem | Sole Authority & Ownership |
|---|---|
| **LspClient** | LSP protocol transport, JSON-RPC lifecycle, capability advertisement |
| **LspDocumentLinkProvider** | LSP protocol adaptation for `textDocument/documentLink` |
| **LspDocumentLinkCoordinator** | Canonical link lifecycle, document events, debounce, settings subscription |
| **LspDocumentLinkSecurityValidator** | Range checking, URI validation, scheme whitelist, traversal defense |
| **LspDocumentLinkResolver** | Lazy resolution via `documentLink/resolve` |
| **LspDocumentLinkExtension** | CodeMirror 6 StateField, RangeSet decorations, DOM click & keydown handlers |
| **NavigationCoordinator** | Authoritative navigation target dispatch, document opening, range reveal |
| **WorkspaceEngine** | Workspace root boundaries, membership validation |

---

## 3. Protocol Scope & Capability Negotiation

1. **Client Capabilities**:
   - Advertises `textDocument.documentLink: { dynamicRegistration: false, tooltipSupport: true }`.
2. **Server Capabilities**:
   - Inspects `serverCapabilities.documentLinkProvider`.
   - Distinguishes:
     - `unsupported` (`null` or `undefined`)
     - `supported` (`{ resolveProvider: false }` or boolean `true`)
     - `supported + resolve` (`{ resolveProvider: true }`)
     - `temporarily unavailable` / `restarting`

---

## 4. Stale-Response Protection & Lifecycle

All link requests and cached results track:
- `documentUri`: Canonical document identifier
- `revision`: Document revision counter
- `sessionId`: LSP server session identifier
- `generation`: Coordinator request generation counter

If a response arrives after the document is edited, closed, or switched to another workspace, the response is discarded silently without polluting the editor state.

---

## 5. Non-Persistence & Derived State

Document Links are strictly **derived runtime presentation state**:
- Never written to document buffer or undo/redo stacks.
- Never saved to disk, backup snapshots, or persistent workspace metadata.
- Automatically disposed when editors, documents, or sessions close.
