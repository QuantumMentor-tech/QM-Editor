# QM Editor — Code Lens Performance & Large Document Policy
**Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration**

---

## 1. Concurrency Controls & Request Throttling

To prevent server overload and preserve smooth 60fps typing responsiveness:

- **Debounce Window**: Keystrokes trigger a debounced request with default `requestDebounceMs = 250ms`. Immediate requests occur only on initial document open.
- **Single Flight Per Document**: Any existing in-flight request for the same document URI is cancelled before dispatching a newer request via `CancellationTokenSource`.
- **Server Capability Gating**: If the server advertises `codeLensProvider: undefined` or `false`, no requests are dispatched.

---

## 2. Hard Capacity Limits

To defend against rogue language servers or pathological code generation that emits millions of lenses:

| Limit | Value | Action on Breach |
| :--- | :--- | :--- |
| **Max Lenses Per Document** | 500 lenses | Excess lenses beyond 500 are truncated; warning logged |
| **Max Title Length** | 256 chars | Titles are truncated and suffixed with `...` |
| **Max Arguments Count** | 10 args | Command rejected if argument count exceeds 10 |
| **Max Arg String Length** | 1,024 chars | Primitive strings beyond 1,024 chars are rejected |
| **Max Serialized Payload** | 8,192 bytes | Large argument payloads are rejected |

---

## 3. Lazy Resolution Strategy

For language servers returning thousands of symbols, resolving every reference count eagerly causes severe latency and network saturation.

- Initial `textDocument/codeLens` response contains unresolved lenses (`command: undefined`, `isResolved: false`, `data: unknown`).
- Code Lenses render with title placeholders or minimal labels.
- When the user clicks an action, `LspCodeLensCoordinator` resolves only that specific lens on-demand via `codeLens/resolve`.
- The resolved command is cached on the canonical lens for subsequent activations.

---

## 4. Failure Isolation Policy

Code Lens is strictly an optional advanced editor feature. Under no circumstance may a failure in Code Lens impair core editor operations:

1. **Typing and Editing**: Continue unimpeded regardless of LSP request status.
2. **File Saving**: Document persistence operates independently of Code Lens state.
3. **Undo/Redo Stack**: Code Lens decorations are not part of document transaction history and create no undoable steps.
4. **Crash Containment**: Network timeouts, parse errors, or unhandled exceptions in the Code Lens pipeline are caught, logged, and isolated without throwing to the global UI or editor view.
