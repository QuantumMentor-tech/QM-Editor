# QM Editor — LSP Symbol Mapping & Normalization
**Phase 06, Step 61 of 135 — Advanced Features**

---

## 1. Overview

This document details the mapping rules between external LSP `SymbolInformation` / `WorkspaceSymbol` objects and QM Editor's canonical `Symbol` model defined in `SymbolTypes.ts`.

---

## 2. Symbol Kind Mapping Table

LSP defines 26 integer symbol kinds. All 26 map 1-to-1 to QM Editor's canonical `SymbolKind` taxonomy:

| LSP Integer | LSP Enum Value | QM Canonical `SymbolKind` |
|:---|:---|:---|
| 1 | File | `'file'` |
| 2 | Module | `'module'` |
| 3 | Namespace | `'namespace'` |
| 4 | Package | `'package'` |
| 5 | Class | `'class'` |
| 6 | Method | `'method'` |
| 7 | Property | `'property'` |
| 8 | Field | `'field'` |
| 9 | Constructor | `'constructor'` |
| 10 | Enum | `'enum'` |
| 11 | Interface | `'interface'` |
| 12 | Function | `'function'` |
| 13 | Variable | `'variable'` |
| 14 | Constant | `'constant'` |
| 15 | String | `'string'` |
| 16 | Number | `'number'` |
| 17 | Boolean | `'boolean'` |
| 18 | Array | `'array'` |
| 19 | Object | `'object'` |
| 20 | Key | `'key'` |
| 21 | Null | `'null'` |
| 22 | EnumMember | `'enumMember'` |
| 23 | Struct | `'struct'` |
| 24 | Event | `'event'` |
| 25 | Operator | `'operator'` |
| 26 | TypeParameter | `'typeParameter'` |
| Other | Unrecognized | Defaults safely to `'variable'` |

---

## 3. Location & Coordinate Normalization

- **Protocol Coordinates:** LSP uses 0-based lines and characters.
- **Canonical Coordinates:** QM Editor uses 1-based lines and columns (`Range`):
  - `startLine = lspRange.start.line + 1`
  - `startColumn = lspRange.start.character + 1`
  - `endLine = lspRange.end.line + 1`
  - `endColumn = lspRange.end.character + 1`
- **URI Mapping:** Server-provided URIs (`file:///...`) are converted to canonical paths using `LspUriMapper.uriToPath()`.

---

## 4. Tags & Deprecation

- LSP `SymbolTag.Deprecated` (`1`) or legacy `deprecated: true` properties map to `tags: ['deprecated']`.
- UI renders deprecated items with standard strikethrough styling.

---

## 5. Container & Display Normalization

- `containerName` is preserved and sanitized.
- Symbol display renders as:
  ```text
  UserService · AuthModule
  ```
- No speculative class hierarchy is synthesized from raw container strings.

---

## 6. Deduplication Strategy

Symbols are deduplicated using a deterministic canonical key:
```text
${location.uri}#${name}#${kind}#${startLine}:${startColumn}-${endLine}:${endColumn}
```
Exact duplicate declarations emitted by servers across multiple compilation units are discarded while preserving overloaded or distinct symbols at different coordinates.
