# QM Editor LSP Location & Range Mapping

## Phase 06, Step 60 — Technical Specification

---

## 1. Overview

Language Server Protocol represents coordinates using 0-based lines and character offsets in UTF-16, UTF-8, or UTF-32 code units.
QM Editor represents coordinates canonically using **1-based** numbers across Diagnostics, Symbols, Navigation, and Editor views.

`LspLocationMapper` performs deterministic coordinate translation, range normalization, and deduplication.

---

## 2. Coordinate Mapping

| Model | Coordinates | Types |
| :--- | :--- | :--- |
| **LSP** | 0-based lines, 0-based characters | `LspPosition { line, character }`, `LspRange { start, end }` |
| **QM Editor** | 1-based lines, 1-based columns | `Position { line, column }`, `Range { startLine, startColumn, endLine, endColumn }` |

```typescript
export function mapLspRange(lspRange: LspRange): Range {
  return {
    startLine: Math.max(1, lspRange.start.line + 1),
    startColumn: Math.max(1, lspRange.start.character + 1),
    endLine: Math.max(1, lspRange.end.line + 1),
    endColumn: Math.max(1, lspRange.end.character + 1),
  };
}
```

---

## 3. LocationLink Support

LSP 3.14+ introduced `LocationLink`, separating the full context range from the identifier selection range:
- `targetUri`: Mapped via `LspUriMapper.uriToPath()` to canonical local URI.
- `targetRange`: Mapped to `Location.range` (determines viewport reveal and document boundary).
- `targetSelectionRange`: Mapped to `Location.selectionRange` (focused identifier cursor selection).
- `originSelectionRange`: Preserved during request origin analysis for back navigation.

---

## 4. Range Normalization & Deduplication

1. **Inverted Ranges**: If a language server returns inverted coordinates where `start > end`, `LspLocationValidator` swaps them deterministically so `start <= end`.
2. **Deduplication**: When language servers return duplicate targets (e.g. from multiple inheritance or re-exports), `LspLocationMapper.mapToCanonicalLocations()` uses a deterministic composite key:
   ```text
   ${uri}#${range.startLine}:${range.startColumn}-${range.endLine}:${range.endColumn}
   ```
   Duplicates are filtered out while preserving the server's primary order.
