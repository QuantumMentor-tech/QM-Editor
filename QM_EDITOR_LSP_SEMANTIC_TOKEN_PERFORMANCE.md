# QM Editor — LSP Semantic Token Performance & Scalability Architecture
**Phase 06 — Advanced Features | Step 64 of 135**

---

## 1. Performance Mission & Core Constraints

Semantic tokens affect every visible character in an open file. Pathological implementations can freeze typing, allocate excessive memory, and degrade editor frame rates.

QM Editor enforces three non-negotiable performance invariants:
1. **Typing Latency Invariance**: Semantic token processing runs entirely asynchronously and out of band. Main-thread keystroke latency must never exceed 16ms (60 FPS).
2. **Memory Bounding**: Semantic token memory scales linearly with active open document count, never exponentially.
3. **Cancellation & Debounce**: Rapid consecutive keystrokes immediately abort obsolete in-flight token requests.

---

## 2. Token Decoding & Validation Optimization

### 2.1 Numeric Iteration
`LspSemanticTokenDecoder` iterates the raw 5-tuple integer array in a single linear pass `O(N)` without allocating intermediate nested objects for invalid or out-of-bounds tuples:
- Uses fast numeric bitwise operations (`(tokenModifiersMask & (1 << bit)) !== 0`).
- Validates bounds before allocating `DecodedSemanticToken` records.

### 2.2 Maximum Token Clamping
Pathological server payloads (e.g., minified JavaScript files returning 200,000 tokens) are clamped to `DEFAULT_MAX_SEMANTIC_TOKENS = 50,000`. Extra tokens are truncated and logged with a performance warning, protecting the CodeMirror decoration tree.

---

## 3. Incremental Delta Synchronization Efficiency

Compared to full document re-tokenization, delta updates achieve dramatic throughput improvements:

| Metric | Full Request (`semanticTokens/full`) | Delta Request (`semanticTokens/full/delta`) |
| :--- | :--- | :--- |
| **Payload Size** | 10 KB – 500 KB (full integer array) | 50 B – 500 B (splice edits only) |
| **JSON Deserialization** | 5ms – 25ms | < 1ms |
| **Decoding Time** | 2ms – 10ms | < 0.5ms |
| **Network Bandwidth** | High | Near-Zero |

Delta edits are spliced into the cached raw token array using native `Array.prototype.splice()`, and then decoded into canonical tokens atomically.

---

## 4. Debounce & In-Flight Cancellation

When editing rapidly:
1. `LspSemanticTokenCoordinator` applies a centralized, bounded debounce window (`lsp.semanticTokens.requestDebounceMs`, default: 250ms).
2. Each new keystroke resets the debounce timer for that document URI.
3. If an existing request is already in-flight over the LSP transport when the user types, the coordinator cancels the in-flight request via `CancellationTokenSource.cancel()`.
4. The server receives `$/cancelRequest` and terminates computation, avoiding wasted language server CPU cycles.

---

## 5. Memory Management & Lifecycle Cleanup

1. **Document Close**: When a document is closed in `DocumentEngine`, `LspSemanticTokenCoordinator` and `LspSemanticTokenProvider` immediately purge cached raw tokens, decoded tokens, result IDs, and decoration sets for that URI.
2. **Server Restart**: When a server session restarts, `clearTokens()` purges all active session tokens and result IDs.
3. **Workspace Switch**: Switching workspaces clears all token caches and decoration sets across all documents.
4. **No Persistence**: Semantic tokens are never serialized to disk, IndexedDB, or recovery snapshots.
