# QM Editor — Document Link Performance & Scalability

## Phase 06 — Advanced Features (Step 67 of 135)

---

## 1. Performance Guardrails & Boundaries

To prevent memory leaks, UI freezes, and network congestion when opening large source files with thousands of references, the LSP Document Link system enforces strict deterministic limits:

| Parameter | Limit | Enforcement Point |
|---|---|---|
| **Max Links Per Document** | 1,000 links | `LspDocumentLinkMapper.mapToCanonicalLinks` |
| **Max URI Length** | 2,048 chars | `LspDocumentLinkSecurityValidator.classifyAndValidateUri` |
| **Max Tooltip Length** | 256 chars | `LspDocumentLinkSecurityValidator.sanitizeTooltip` |
| **Request Debounce** | 300 ms (configurable) | `LspDocumentLinkCoordinator` |
| **Max Concurrent Resolves**| 5 simultaneous requests | `LspDocumentLinkResolver` |

---

## 2. Request Debouncing & Edit Coalescing

1. When users type rapidly, `document.changed` events fire on every keystroke.
2. The coordinator debounces requests by `300ms` (`lsp.documentLinks.requestDebounceMs`).
3. If an edit occurs while a request is in flight:
   - Document revision increments.
   - The pending request's revision becomes stale.
   - When the stale response returns, it is immediately discarded before range mapping or decoration building.
   - Editor typing responsiveness is preserved with zero frame drops.

---

## 3. Lazy Resolution Strategy

- When an LSP server specifies `resolveProvider: true`, it may return minimal links containing only source ranges and opaque server `data`.
- QM Editor defers calling `documentLink/resolve` until:
  - The link is hovered or focused, or
  - The link is explicitly clicked/activated.
- This avoids issuing hundreds of round-trip JSON-RPC resolve calls on document open.
- Resolution promises are tracked in an in-memory Map keyed by link ID and cleaned up on document close.

---

## 4. Disposal & Memory Reclamation

- On document close (`document.closed`):
  - In-flight requests are cancelled.
  - Link caches are cleared from `LspDocumentLinkProvider`.
  - Decorations in `EditorAdapter` are cleared via `clearDocumentLinksEffect`.
- On workspace switch:
  - All caches across all documents are purged immediately.
  - Pending debounced timers are cancelled.
