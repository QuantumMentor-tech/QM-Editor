# QM Editor — LSP Workspace Symbols Architecture
**Phase 06, Step 61 of 135 — Advanced Features**

---

## 1. Overview & Architectural Principle

LSP Workspace Symbol search provides live, cross-file semantic symbol search across the current workspace by querying active Language Server Protocol (LSP) sessions using the `workspace/symbol` request method.

Rather than introducing a parallel or competing symbol engine, the LSP provider integrates seamlessly into QM Editor's authoritative Step 41 `SymbolEngine` and canonical `Symbol` model.

```text
User / Command ('workbench.action.showAllSymbols' / Mod+T / '#')
      │
      ▼
GoToSymbolModal (Workspace Mode)
      │
      ▼
SymbolEngine (Step 41)
      │
      ├── BuiltinRegexSymbolProvider (Fallback)
      └── LspWorkspaceSymbolProvider (Priority 100)
            │
            ▼
      LspServerManager / Active Session (workspaceId matching)
            │
            ▼
      Language Server (workspace/symbol)
            │
            ▼
      LspWorkspaceSymbolValidator & Sanitizer
            │
            ▼
      LspWorkspaceSymbolMapper (Canonical Symbol[])
            │
            ▼
      GoToSymbolModal Selection
            │
            ▼
      NavigationCoordinator.navigateToLocation()
            │
            ▼
      DocumentEngine (opens resource & reveals 1-based range)
```

---

## 2. Server Capability & Request Validation

Before dispatching `workspace/symbol`:
1. **Server Readiness:** Server must be in `'ready'` or `'running'` state.
2. **Capability Check:** Server must advertise `workspaceSymbolProvider` (boolean or object) in its negotiated `ServerCapabilities`.
3. **Workspace Association:** Session's `workspaceId` must match the active workspace from `WorkspaceEngine`.
4. **Settings Gate:** `lsp.workspaceSymbols.enabled` must not be set to `false`.
5. **Interactive Timeout:** Bound by `lsp.interactiveTimeoutMs` (default 3,000ms).
6. **Graceful Degradation:** If the server lacks `workspaceSymbolProvider`, the provider quietly returns `[]` without displaying error dialogs, allowing built-in providers to serve local results.

---

## 3. Query Normalization & Empty Query Policy

- **Query Sanitization:** Control characters (`[\x00-\x1F\x7F]`) and excess whitespace are stripped. Query length is clamped to `MAX_QUERY_LENGTH = 256`.
- **Empty Query Handling:** Empty or whitespace-only queries return `[]` unless `lsp.workspaceSymbols.allowEmptyQueries` is explicitly configured to `true`. This prevents issuing unbounded symbol dumps to servers that do not safely handle empty requests.

---

## 4. Stale Result & Generation Protection

Interactive search changes rapidly as the user types:
- Each query increments `requestGeneration`.
- If a response arrives after `requestGeneration` has advanced, the older response is discarded immediately.
- If the active workspace changes before a query resolves, the response is discarded to prevent cross-workspace contamination.
- Standard cancellation tokens terminate obsolete JSON-RPC requests via `$/cancelRequest`.

---

## 5. Non-Persistence Guarantee

LSP workspace symbols are server-provided live semantic results. QM Editor never persists them into authoritative workspace databases or disk caches. The language server remains the live semantic authority, while QM Editor remains authoritative for resource identity, document opening, and editor navigation.
