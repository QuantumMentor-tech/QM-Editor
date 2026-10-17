# QM Editor — Folding Range Mapping, Nesting & Overlap Resolution

## Phase 06 — Advanced Features (Step 68 of 135)

---

## 1. Coordinate & Offset Translation

LSP expresses folding ranges using 0-based line indices:
- `startLine`: 0-based line index where the fold starts.
- `startCharacter`: Optional 0-based character offset on `startLine`.
- `endLine`: 0-based line index where the fold ends.
- `endCharacter`: Optional 0-based character offset on `endLine`.

CodeMirror 6 `foldService` requires 0-based buffer offsets:
```ts
{ from: number, to: number }
```
Where:
- `from`: The character offset on the start line where the fold marker is inserted (typically `startLine.to` for multiline block folding, or `startLine.from + startCharacter`).
- `to`: The character offset on the end line where the collapsed region terminates (typically `endLine.to`, or `endLine.from + endCharacter`).

```
Line 1: function calculate(x: number) {    <-- from = end of line 1 (fold marker here)
Line 2:   const a = x * 2;                 |
Line 3:   return a + 1;                    |  [HIDDEN RANGE]
Line 4: }                                  <-- to = end of line 4
```

---

## 2. Duplicate Range Elimination

Language servers frequently return duplicate ranges (e.g. from macro expansions or overlapping grammar rules). `LspFoldingTreeBuilder` deduplicates ranges matching:
```text
key = `${startLine}:${endLine}:${kind || ''}`
```
Ensuring gutter icons and placeholder widgets are never rendered redundantly.

---

## 3. Strict Hierarchical Nesting

To build a valid fold tree:
1. Ranges are sorted: primary `startLine ASC`, secondary `endLine DESC` (outermost structures first).
2. A stack-based algorithm checks each range against the top of the stack:
   - If `top.startLine <= current.startLine && current.endLine <= top.endLine`: `current` is added as a child of `top`.
   - Bounded by `MAX_NESTING_DEPTH = 50` to eliminate pathological stack exhaustion.

---

## 4. Non-Nested Overlapping Range Resolution

If range A starts at line 1 and ends at line 10, while range B starts at line 5 and ends at line 15:
- Range B partially intersects range A without being strictly enclosed.
- In editor folding, partial overlaps are structurally impossible to render cleanly.
- `LspFoldingTreeBuilder` detects this condition (`current.endLine > top.range.endLine`), logs a warning, and safely discards the conflicting range B while preserving outer range A.
