# QM Editor LSP Hover Architecture

## Phase 06, Step 59 — LSP Hover, Signature Help & Contextual Documentation Integration

---

## 1. Overview & Architectural Role

LSP Hover integration connects external Language Server Protocol servers (`textDocument/hover`) directly to QM Editor's canonical `HoverCoordinator` and `LanguageIntelligenceRegistry` established in Step 43.

The language server functions strictly as an **external contextual intelligence provider**. QM Editor remains 100% authoritative over document content, cursor position, editor surface rendering, and transient UI lifecycle.

```text
Editor Surface (Mouse move / Ctrl+K Ctrl+I)
          │
          ▼
HoverCoordinator (Step 43)
          │
          ▼
LanguageIntelligenceRegistry (Priority 100)
          │
          ▼
LspProviderAdapter (Step 59)
          │
          ├── Settings check: 'lsp.hover.enabled'
          ├── Session readiness check: 'ready' | 'running'
          ├── Capability check: caps.hoverProvider === true
          ├── 1-based to 0-based coordinate translation
          │
          ▼
Language Server Process (JSON-RPC 2.0 textDocument/hover)
          │
          ▼
LspContextValidator (Defensive Sanitization & Validation)
          │
          ▼
LspContextMapper (Canonical HoverResult & 1-based Range mapping)
          │
          ▼
HoverCoordinator (Stale generation, revision & workspace fencing)
          │
          ▼
HoverWidget (Step 43 Accessible UI with safe markdown rendering)
```

---

## 2. Protocol Specification (`textDocument/hover`)

### Request
```typescript
interface LspHoverParams {
  textDocument: { uri: string };
  position: { line: number; character: number }; // 0-based
}
```

### Response
```typescript
interface LspHover {
  contents: LspMarkedString | LspMarkedString[] | LspMarkupContent;
  range?: LspRange; // 0-based
}
```

---

## 3. Position Mapping & Coordinate Translation

1. **Inbound Request:**
   QM Editor 1-based `Position { line, column }` is mapped to LSP 0-based `LspPosition`:
   - `lspLine = Math.max(0, request.position.line - 1)`
   - `lspCharacter = Math.max(0, request.position.column - 1)`

2. **Outbound Range:**
   LSP 0-based `LspRange` is mapped to canonical QM Editor 1-based `Range`:
   - `startLine = lspRange.start.line + 1`
   - `startColumn = lspRange.start.character + 1`
   - `endLine = lspRange.end.line + 1`
   - `endColumn = lspRange.end.character + 1`

3. **Inversion Safety:**
   `LspContextValidator` normalizes inverted ranges where `start > end`, preventing editor highlight corruption.

---

## 4. Stale-Result Protection & Transient Lifecycle

Hover requests are highly ephemeral:
- **Cursor Movement:** Rapid mouse movement or keyboard arrow navigation triggers `activeCts.cancel()`, superseding in-flight hover requests.
- **Revision Fencing:** If the document revision advances while a hover query is in flight, the late-arriving response is discarded by `HoverCoordinator`.
- **Workspace Isolation:** If the active workspace changes, pending hover responses are rejected immediately.
- **Session Generations:** Sever restarts or crashes invalidate prior session tokens, preventing stale hover tooltips from rendering.

---

## 5. Security & Untrusted Content Defense

All server-provided hover content is treated as untrusted:
- Dangerous HTML tags (`<script>`, `<iframe>`, `<object>`, `<embed>`, `<button>`, etc.) are stripped.
- Dangerous URI schemes (`javascript:`, `vbscript:`, `data:`, `file:`, `command:`) are blocked.
- Oversized documentation text is capped at 20,000 characters to prevent memory exhaustion and UI freezing.
- Document text is never mutated from hover actions.
