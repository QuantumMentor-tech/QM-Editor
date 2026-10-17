# QM Editor — LSP Folding Performance & DoS Protection

## Phase 06 — Advanced Features (Step 68 of 135)

---

## 1. Safety Bounds & DoS Defenses

Language servers can potentially return tens of thousands of folding ranges or oversized string metadata. To protect editor responsiveness, the folding subsystem enforces deterministic safety limits:

| Parameter | Limit | Enforcement Point |
|---|---|---|
| **Max Folding Ranges** | 5,000 ranges per document | `LspFoldingValidator.validateRanges` |
| **Max Collapsed Text Length** | 64 characters | `LspFoldingValidator.sanitizeCollapsedText` |
| **Max Tree Nesting Depth** | 50 levels | `LspFoldingTreeBuilder.buildTree` |
| **Request Debounce** | 300 ms (configurable) | `LspFoldingCoordinator` |
| **Request Timeout** | 5,000 ms | `LspFoldingProvider.requestFoldingRanges` |

---

## 2. Asynchronous Tree Construction

- Tree construction runs in $O(N \log N)$ time using an iterative stack-based algorithm.
- No recursive tree-building functions that could cause JavaScript call stack overflow (`RangeError: Maximum call stack size exceeded`).
- Duplicate detection uses a fast `Set`/`Map` hash key (`${startLine}:${endLine}:${kind}`).

---

## 3. Coalescing Rapid Edits

- During fast typing, `document.changed` events trigger the debounce timer.
- Previous pending timers are cancelled.
- If a request is already in-flight when another edit occurs, the active `CancellationTokenSource` is cancelled.
- The double revision check discards any responses whose revision does not match the active document revision.

---

## 4. Memory Reclamation

- On document close, all memory references to canonical ranges, trees, and editor ranges are deleted from the provider cache and coordinator maps.
- No historical fold snapshots are retained across document lifecycles.
