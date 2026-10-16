# QM Editor — LSP Symbol Security & Boundary Isolation
**Phase 06, Step 61 of 135 — Advanced Features**

---

## 1. Untrusted Server Data Principle

All data returned by language servers via `workspace/symbol` is treated as untrusted external input:

1. **Symbol Names & Container Strings:**
   - Sanitized by `LspWorkspaceSymbolValidator.sanitizeDisplayString()`.
   - Control characters (`[\x00-\x1F\x7F]`) are stripped.
   - HTML entities (`<`, `>`, `&`, `"`, `'`) are encoded.
   - Length is clamped to 512 characters.
   - Rendered using safe React text nodes; never injected via `dangerouslySetInnerHTML`.

2. **Location URI Validation:**
   - Insecure URI schemes (`javascript:`, `command:`, `shell:`, `data:`, `vbscript:`) are rejected.
   - Only valid `file:///` URIs, untitled URIs, or local filesystem paths are allowed.
   - Malformed URIs cause the individual symbol candidate to be discarded without aborting the entire result set.

---

## 2. Workspace Boundary & Session Isolation

- Queries are scoped strictly to the active workspace (`WorkspaceEngine.getWorkspaceId()`).
- Sessions belonging to other workspaces or previous generations are ignored.
- Language servers cannot force navigation across unauthorized workspace boundaries.

---

## 3. Read-Only Protection & Mutation Prohibition

- Selecting a workspace symbol is strictly a navigation action.
- The symbol engine, LSP symbol provider, and Navigation Coordinator never create files, delete files, or modify buffer text during workspace symbol queries or selections.
- Step 61 strictly prohibits rename, refactoring, code formatting, semantic tokens, or file writes.
