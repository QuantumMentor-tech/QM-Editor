# QM Editor — LSP Formatting Mapping Architecture (Step 63)

## 1. Scope & Purpose

Formatting transforms external LSP protocol structures into QM Editor's internal canonical coordinate systems and edit transactions. This document specifies the conversion rules for:
1. `FormattingOptions` translation.
2. Canonical 1-based range translation to 0-based LSP ranges.
3. LSP `TextEdit[]` translation to transactional `SingleTextEdit[]`.

---

## 2. Formatting Options Resolution

Formatting options are resolved dynamically by `LspFormattingMapper.resolveFormattingOptions()`:
- **`tabSize`**: Extracted from editor configuration (`editor.tabSize`, default `2`). Clamped between `1` and `8`.
- **`insertSpaces`**: Extracted from editor configuration (`editor.insertSpaces`, default `true`).
- **`trimTrailingWhitespace`**: Boolean flag indicating if servers should strip trailing spaces.
- **`insertFinalNewline`**: Boolean flag indicating if a terminal newline is enforced.
- **`trimFinalNewlines`**: Boolean flag indicating if surplus terminal newlines are collapsed.

Callers may supply manual overrides when triggering formatting programmatically.

---

## 3. Coordinate System Conversions

### 3.1 1-Based to 0-Based (LSP Range)
Canonical ranges in QM Editor use 1-based `startLine`, `startColumn`, `endLine`, `endColumn`.
LSP expects 0-based line and character offsets:
```typescript
const lspRange: LspRange = {
  start: {
    line: Math.max(0, canonicalRange.startLine - 1),
    character: Math.max(0, canonicalRange.startColumn - 1),
  },
  end: {
    line: Math.max(0, canonicalRange.endLine - 1),
    character: Math.max(0, canonicalRange.endColumn - 1),
  },
};
```

### 3.2 0-Based LSP Range to Offset-Based SingleTextEdit
QM Editor's `DocumentEngine` transactional editing model expects `SingleTextEdit` items with byte/character offsets (`rangeOffset`, `rangeLength`, `text`):
1. Convert 0-based line/char to absolute string character offset via line-break indexing.
2. Verify offset boundaries against document length.
3. Sort edits strictly in ascending offset order to facilitate atomic transaction application.
4. Calculate `rangeLength = endOffset - startOffset`.

---

## 4. Overlap Detection & Invariant Verification

Before edits are submitted to `DocumentEngine`:
1. **Inverted Range Check**: If `start.line > end.line` or (`start.line === end.line` and `start.character > end.character`), the edit is discarded and the payload fails validation.
2. **Overlap Check**: If any edit starts before a preceding edit ends (`curr.startOffset < prev.endOffset`), the entire formatting response is quarantined and rejected with an explicit error to prevent text transposition or corrupted syntax.
3. **Identity Edits**: Edits where `originalSubstring === edit.newText` are filtered out as no-ops.
