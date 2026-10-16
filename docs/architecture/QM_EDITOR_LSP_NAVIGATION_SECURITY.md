# QM Editor LSP Navigation Security & Boundary Governance

## Phase 06, Step 60 — Technical Specification

---

## 1. Threat Model & Defense Principles

Language servers run as external subprocesses and can return arbitrary strings, URIs, and coordinates.

QM Editor treats all server-provided navigation responses as **untrusted data**.

### Threat Mitigations

1. **Protocol Injection & Malicious Schemes**:
   - `LspLocationValidator.validateUri()` blocks dangerous URI schemes:
     - `javascript:`, `command:`, `vbscript:`, `data:`, `shell:`, `cmd:`, `powershell:`, `eval:`.
   - Only approved schemes (`file:`, `untitled:`) or valid relative paths are permitted.

2. **Negative Coordinates & Out-of-Bounds**:
   - 0-based lines and characters must be non-negative integers.
   - Malformed items in an array are discarded individually without invalidating valid sibling items.

3. **Stale Result Protection**:
   - If the user edits the document, switches workspaces, or the language server restarts while a request is in flight, the request generation and session generation mismatches cause the response to be rejected.

4. **Resource Authority**:
   - Navigation targets are opened strictly via `DocumentEngine` and `NavigationCoordinator`.
   - Language servers cannot directly create files, open tabs, or mutate documents.
