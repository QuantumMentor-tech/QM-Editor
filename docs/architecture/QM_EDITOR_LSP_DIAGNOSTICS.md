# QM Editor — LSP Diagnostics Integration Architecture

**Phase 06 — Advanced Features**  
**Step 57 of 135: LSP Diagnostics Integration, Problems Synchronization & Diagnostic Lifecycle**

---

## 1. Executive Architectural Summary

QM Editor integrates Language Server Protocol diagnostics strictly through the existing Phase 04 `DiagnosticService` and canonical `Diagnostic` model. External language servers act strictly as **diagnostic providers**; they never become the authority over diagnostic persistence, Problems aggregation, or editor markers.

```
Language Server
      │
      ▼
textDocument/publishDiagnostics
      │
      ▼
LspDiagnosticsBridge (Provider & Session Validation)
      │
      ▼
LspDiagnosticValidator (Sanitization & Range Clamping)
      │
      ▼
LspDiagnosticMapper (0-based to 1-based Coordinate Mapping)
      │
      ▼
Canonical Diagnostic Models
      │
      ▼
DiagnosticService (createCollection('lsp:<serverDefinitionId>'))
      │
      ├───────────────────────┬───────────────────────┐
      ▼                       ▼                       ▼
Problems Panel         Editor Markers         Navigation Coordinator
(File/Error Tree)      (CodeMirror Lint)      (Jump to Location)
```

---

## 2. Inviolable Authority Invariants

1. **Diagnostics Engine Authority:** `DiagnosticService` remains the single, authoritative aggregator of all application problems. No duplicate LSP-specific problems state exists.
2. **Provider Isolation:** Diagnostics published by `lsp:typescript-lsp` or `lsp:pyright-lsp` exist in dedicated, owner-scoped `DiagnosticCollection` instances (`lsp:<serverDefinitionId>`). They cannot overwrite, mutate, or erase diagnostics emitted by Task Runners (`tasks`), built-in linters, or other language servers.
3. **Downstream UI Rendering:** UI components (`ProblemsPanel.tsx`, `EditorSurface.tsx`) subscribe solely to `DiagnosticService.subscribe()` and query `globalDiagnosticService.getDiagnostics()`. The UI has zero coupling to raw JSON-RPC notifications.
4. **Untrusted Payload Boundary:** Diagnostic messages, ranges, and URLs are treated as untrusted external inputs. Payloads pass through strict schema validation, range normalization, and URL scheme filtering (`http:` / `https:` only) before entering application state.

---

## 3. Component Responsibilities

| Component | Class / Service | Primary Responsibility |
|---|---|---|
| **LSP Diagnostics Bridge** | `LspDiagnosticsBridge` | Orchestrates per-server collections, checks session and workspace freshness, enforces settings, and manages disposal. |
| **Diagnostic Validator** | `LspDiagnosticValidator` | Validates payload schemas, clamps ranges, normalizes inverted coordinates, sanitizes URLs, and caps diagnostic counts. |
| **Diagnostic Mapper** | `LspDiagnosticMapper` | Converts 0-based LSP diagnostic protocol items to 1-based canonical `Diagnostic` objects. |
| **Diagnostics Service** | `DiagnosticService` | Aggregates collections across all providers, computes summaries, emits change events, and coordinates with DocumentEngine. |
| **Problems Panel** | `ProblemsPanel` | Renders workspace-wide problems, groupable by file or severity, with direct navigation to problem locations. |
| **Editor Surface** | `EditorSurface` | Renders squiggly decorations, gutter markers, and hover tooltips in CodeMirror based on canonical diagnostics. |

---

## 4. Multi-Server & Multi-Workspace Isolation

- **Server Scoping:** Provider ID is structured as `lsp:${serverDefinitionId}` (e.g. `lsp:typescript-lsp`). Multiple servers running concurrently publish into distinct collections.
- **Workspace Scoping:** Notifications are stamped with `sessionContext.workspaceId`. Notifications for non-active workspaces are immediately rejected to prevent cross-workspace contamination.
