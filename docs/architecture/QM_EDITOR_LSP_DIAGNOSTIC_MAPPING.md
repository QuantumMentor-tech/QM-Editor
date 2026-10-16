# QM Editor — LSP Diagnostic Protocol to Domain Mapping

**Phase 06 — Advanced Features**  
**Step 57 of 135: LSP Diagnostics Integration, Problems Synchronization & Diagnostic Lifecycle**

---

## 1. Field-by-Field Protocol Mapping

| LSP Protocol Field (`LspDiagnostic`) | Canonical QM Field (`Diagnostic`) | Transformation & Invariant Rule |
|---|---|---|
| `range.start.line` (0-based) | `range.startLine` (1-based) | `line + 1`. Validated non-negative finite integer. |
| `range.start.character` (0-based) | `range.startColumn` (1-based) | `character + 1`. Validated non-negative finite integer. |
| `range.end.line` (0-based) | `range.endLine` (1-based) | `line + 1`. Normalized to ensure `start <= end`. |
| `range.end.character` (0-based) | `range.endColumn` (1-based) | `character + 1`. Normalized to ensure `start <= end`. |
| `severity` (1, 2, 3, 4) | `severity` (`'error'`, `'warning'`, `'info'`, `'hint'`) | Numeric mapping (1: error, 2: warning, 3: info, 4: hint). Default: `'error'`. |
| `message` (string) | `message` (string) | Control characters stripped; truncated to 4,000 characters; non-empty fallback applied. |
| `source` (string) | `source` (string) | Sanitized; truncated to 100 characters; defaults to server display name or `'lsp'`. |
| `code` (number \| string) | `code` (number \| string) | Preserved as-is (strings truncated to 100 chars). |
| `codeDescription.href` (string) | `data.codeDescriptionHref` (string) | Validated via URL parser: only `http:` and `https:` schemes allowed. |
| `tags` (1, 2) | `tags` (`'unnecessary'`, `'deprecated'`) | 1 -> `'unnecessary'`, 2 -> `'deprecated'`. Unknown tag numbers dropped. |
| `relatedInformation` (array) | `relatedInformation` (array) | URIs mapped via `LspUriMapper`; locations converted to 1-based coordinates. |
| `data` (unknown) | `data` (unknown) | Preserved as inert provider payload for future quick fix / code action mapping. |
| *Synthesized* | `id` (string) | Deterministic key: `${providerId}:${resourceUri}:${startLine}:${startColumn}-${index}`. |
| *Synthesized* | `createdAt` (number) | `Date.now()` timestamp. |

---

## 2. Coordinate System Translation

LSP positions are zero-based UTF-16 character offsets within a zero-based line index:
```json
{
  "start": { "line": 0, "character": 4 },
  "end": { "line": 0, "character": 10 }
}
```

QM Editor uses standard 1-based editor coordinates:
```typescript
{
  startLine: 1,
  startColumn: 5,
  endLine: 1,
  endColumn: 11
}
```

### Inverted Range Normalization
If an external language server transmits an inverted range (e.g. `start.line > end.line` or start character after end character on the same line), `LspDiagnosticValidator` automatically swaps start and end before coordinate translation to prevent downstream editor rendering bugs.

---

## 3. Security & URL Sanitization

- **No Dangerous Protocols:** Language server error messages may specify documentation links in `codeDescription.href`. Links containing `javascript:`, `data:`, `file:`, or shell executions are stripped to prevent Cross-Site Scripting (XSS) or arbitrary local file access.
- **Message Content:** Diagnostic messages are displayed as plain text or passed through the sanitized Markdown pipeline. Raw `innerHTML` insertion of diagnostic messages is strictly prohibited.
