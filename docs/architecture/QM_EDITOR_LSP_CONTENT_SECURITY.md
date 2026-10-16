# QM Editor LSP Content Security & Sanitization Architecture

## Phase 06, Step 59 — LSP Hover, Signature Help & Contextual Documentation Integration

---

## 1. Threat Model & Untrusted Server Boundary

Language Server Protocol servers run as external subprocesses and may ingest untrusted source code, external packages, or dependencies containing malicious documentation strings.

Potential attack vectors:
1. **Cross-Site Scripting (XSS) & Script Injection:** Embedded `<script>`, `<iframe src="...">`, `<embed>`, or `<object>` tags designed to execute arbitrary JavaScript inside the renderer.
2. **Protocol Hijacking:** Malicious links with `javascript:`, `vbscript:`, `data:`, or `file:` schemes designed to trigger remote code execution or file exfiltration.
3. **DOM Event Handler Hijacking:** Inline attributes such as `<img onerror="..." src="...">` or `<div onclick="...">`.
4. **Denial of Service (DoS):** Mega-payloads with millions of characters or nested recursive elements designed to exhaust browser memory or lock up the main thread.

---

## 2. Multi-Tier Defensive Pipeline

### Tier 1: Input Validation & Bounds Clamping (`LspContextValidator`)
- **Documentation Text:** Clamped to `MAX_DOC_LENGTH` (10,000 characters). Oversized strings append `*(documentation truncated)*`.
- **Hover Text:** Clamped to `MAX_HOVER_TEXT_LENGTH` (20,000 characters).
- **Signature Limits:** Clamped to `MAX_SIGNATURES` (50) and `MAX_PARAMETERS` (100).
- **Label Limits:** Clamped to `MAX_LABEL_LENGTH` (2,000 characters).

### Tier 2: Dangerous Tag & URI Stripping (`LspContextValidator`)
- Strips dangerous HTML tags matching:
  `<\s*(script|iframe|object|embed|applet|meta|form|input|button|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>`
- Neutralizes dangerous URI schemes:
  `(?:javascript|vbscript|data|file|command):[^\s'")>]+` -> `#blocked-uri`
- Strips inline `on*` event handlers.

### Tier 3: Safe Markdown Rendering (`ContentSanitizer`)
- Code blocks are escaped via `escapeHtml()`.
- Headers, bold, italic, and inline code are safely tokenized.
- Links `[label](url)` are validated with `isSafeUrl()`. Only `http://`, `https://`, `mailto:`, and internal anchors `#` are permitted.
- Permitted links are rendered with `target="_blank" rel="noopener noreferrer"`.
- Final HTML passes through `sanitizeHtml()` for defense-in-depth against nested bypasses.
