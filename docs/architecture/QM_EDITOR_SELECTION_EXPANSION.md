# QM Editor — Smart Selection Expansion

## 1. Expansion Semantics

Smart selection expansion allows developers to intuitively grow a selection along language-aware syntactical contours.

The hierarchy follows:
```
cursor
  ↓
word / identifier
  ↓
expression
  ↓
argument / parameter
  ↓
statement
  ↓
block / compound statement
  ↓
function / method
  ↓
class / type
  ↓
module / file
```

## 2. Containment-Aware Progressive Expansion

`LspSelectionRangeMapper.findNextContainingRange` checks the active selection `[curFrom, curTo]`:
- **Cursor (empty selection):** Selects the smallest non-empty structural range enclosing the cursor.
- **Active Range:** Selects the next range in the hierarchy that is strictly larger than `[curFrom, curTo]`:
  `range.from <= curFrom && range.to >= curTo && (range.from < curFrom || range.to > curTo)`.
- **Exhausted Hierarchy:** If the selection already covers the outermost range, expansion safely yields no-op without clearing or shrinking the selection.

## 3. Shrink Selection & Runtime History

To provide instant, zero-latency shrinking without redundant network round trips to the language server:
1. `LspSelectionRangeCoordinator` maintains a runtime-only selection history stack per document ID:
   `selectionHistory: Map<string, SelectionHistoryEntry[]>`.
2. Every expansion pushes the preceding selection state onto the history stack.
3. Triggering **Shrink Selection** pops the top entry from the history stack and applies the previous selection.
4. History stacks are runtime-only and never written to disk or serialized into session storage.
5. Edits to the document immediately clear the history stack for that document to prevent applying stale selections.

## 4. Fallback Architecture

If the language server is unavailable, disabled, crashes, or returns an empty payload:
The system automatically falls back to native editor expansion:
- Empty cursor → expands to word boundary under cursor.
- Word selected → expands to current line bounds (excluding line breaks).
- Line selected → expands to the full document text.
- Full document selected → no-op.
