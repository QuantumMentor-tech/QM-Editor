# QM Editor — Document Link Security & Threat Model

## Phase 06 — Advanced Features (Step 67 of 135)

---

## 1. Threat Model & Untrusted LSP Input

Language server responses originate from out-of-process binaries, language runtimes, or plugins. Every URI returned in `textDocument/documentLink` or `documentLink/resolve` is treated as **untrusted input**.

Document links must never become a privileged execution path.

### Potential Threats Defended

1. **Arbitrary Code Execution via Dangerous Schemes**:
   - Injection of `javascript:`, `vbscript:`, `data:`, `shell:`, `powershell:`, `cmd:`, `exec:`, `file+ssh:`, `node:`, `eval:`.
2. **Directory & Path Traversal**:
   - Sequences such as `../../`, `..\..\`, encoded `%2e%2e`, and null-byte injection (`\0`, `%00`) designed to access sensitive system files outside the workspace.
3. **Workspace Boundary Violations**:
   - Access to unauthorized files on disk without warning or permission.
4. **Denial of Service / Memory Attacks**:
   - Massive link counts (> 1,000 per document), oversized URIs (> 2,048 chars), or giant tooltip payloads (> 256 chars).
5. **Cross-Site Scripting (XSS) via Tooltips**:
   - HTML or script injection inside link hover tooltips.

---

## 2. Centralized Validation Pipeline

```
Untrusted LSP URI / Document Link
               │
               ▼
   LspDocumentLinkSecurityValidator
               │
   ├── 1. Length & Range Checks (clamp at MAX_URI_LENGTH = 2048, MAX_LINKS = 1000)
   ├── 2. Scheme Blacklist (javascript:, data:, vbscript:, shell:, powershell:, etc.)
   ├── 3. Traversal Sequence Defense (.., %2e%2e, \0, %00)
   ├── 4. Scheme Whitelist (http:, https:, mailto:, file:, browser-fs:)
   ├── 5. Workspace Root Membership (isResourceInRoot against WorkspaceRoots)
   └── 6. Tooltip Sanitization (strip HTML tags, clamp at 256 chars)
               │
               ▼
   Classification & Sanitized Canonical Link
   (workspace-local | outside-workspace | same-document | external-web | unsupported)
```

---

## 3. Strict Prohibited Schemes

The following schemes are unconditionally blocked:
- `javascript:`
- `data:`
- `vbscript:`
- `shell:`
- `powershell:`
- `cmd:`
- `exec:`
- `file+ssh:`
- `node:`
- `eval:`

Any link featuring these schemes is classified as `unsupported` and rejected before reaching the editor decoration or navigation layer.

---

## 4. Workspace Boundary Enforcement

For `file:` and relative path targets:
1. Paths are normalized into forward-slash canonical paths with drive-letter normalization.
2. If `workspaceRoots` are configured, the canonical path is evaluated against `isResourceInRoot`.
3. Targets outside the workspace are classified as `outside-workspace` and require user confirmation or restricted access.

---

## 5. Defense Against Execution Abuse

Document links activate **only** navigation:
- Under no circumstances does a link trigger shell commands, terminal execution, process spawns, or background tasks.
- Navigation for file resources is delegated solely to `NavigationCoordinator.navigateToLocation`.
- External web URLs are handled via `window.open(url, '_blank', 'noopener,noreferrer')` or the platform's external link opener.
