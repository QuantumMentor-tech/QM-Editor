# QM Editor — LSP Completion Protocol Mapping

## Phase 06 — Advanced Features (Step 58 of 135)

---

# 1. Overview

This document specifies the exact conversion and translation layer between external LSP completion protocol payloads (`textDocument/completion`, `completionItem/resolve`) and QM Editor's internal canonical completion model.

All mapping logic is encapsulated within `LspCompletionMapper` and defended by `LspCompletionValidator`.

---

# 2. Completion Item Kinds Mapping

LSP numeric CompletionItemKind values (1 through 25) map deterministically to QM Editor's normalized `CompletionItemKind` union:

| LSP Numeric Kind | LSP Specification Category | Canonical QM Editor Kind | Notes |
| :---: | :--- | :--- | :--- |
| **1** | `Text` | `'text'` | Generic plain text / token |
| **2** | `Method` | `'method'` | Member function |
| **3** | `Function` | `'function'` | Standalone function / procedure |
| **4** | `Constructor` | `'constructor'` | Class instantiation / constructor |
| **5** | `Field` | `'field'` | Object property / struct field |
| **6** | `Variable` | `'variable'` | Local or global variable |
| **7** | `Class` | `'class'` | Class definition |
| **8** | `Interface` | `'interface'` | Type interface / protocol |
| **9** | `Module` | `'module'` | Package, namespace, or module |
| **10** | `Property` | `'property'` | Getter/setter or attribute |
| **11** | `Unit` | `'value'` | Measured quantity / dimension |
| **12** | `Value` | `'value'` | Literal value or operand |
| **13** | `Enum` | `'enum'` | Enumeration type |
| **14** | `Keyword` | `'keyword'` | Language reserved word |
| **15** | `Snippet` | `'snippet'` | Code template / boilerplate |
| **16** | `Color` | `'value'` | Color literal |
| **17** | `File` | `'file'` | File system path / file reference |
| **18** | `Reference` | `'reference'` | Symbol reference / alias |
| **19** | `Folder` | `'file'` | Directory / namespace container |
| **20** | `EnumMember` | `'enum'` | Member item within enumeration |
| **21** | `Constant` | `'constant'` | Immutable constant identifier |
| **22** | `Struct` | `'class'` | Structured compound data type |
| **23** | `Event` | `'method'` | Event handler or listener |
| **24** | `Operator` | `'keyword'` | Mathematical / logical operator |
| **25** | `TypeParameter` | `'type'` | Generic / template type parameter |
| **Default** | *Unknown / Unset* | `'text'` | Fallback for non-standard kinds |

---

# 3. Text Edit & Insert Precedence

LSP servers may provide text mutation instructions in multiple formats. `LspCompletionMapper` resolves insertion instructions with strict precedence:

1. **Standard `TextEdit` (`{ range: LspRange, newText: string }`)**:
   - Converted from 0-based LSP coordinates to 1-based QM Editor document coordinates:
     ```typescript
     range: {
       startLine: edit.range.start.line + 1,
       startColumn: edit.range.start.character + 1,
       endLine: edit.range.end.line + 1,
       endColumn: edit.range.end.character + 1,
     }
     ```
   - `insertText` is set to `edit.newText`.

2. **Insert/Replace Edit (`InsertReplaceEdit` - `{ insert: Range, replace: Range, newText: string }`)**:
   - The `insert` range is mapped to canonical 1-based coordinates to support prefix-sensitive typing without over-deleting surrounding tokens.
   - `insertText` is set to `newText`.

3. **Plain `insertText`**:
   - When no explicit replacement range is supplied, `insertText` is used directly at the current editor cursor offset.

4. **Label Fallback**:
   - If neither `textEdit` nor `insertText` is declared, the display `label` serves as the inserted text.

---

# 4. Snippet Format Downgrading

If `insertTextFormat === 2` (`Snippet`), QM Editor protects inserted buffers from dollar-sign placeholder syntax when inserting into plain-text completion contexts:
- Placeholder substitutions: `${1:variableName}` $\rightarrow$ `variableName`.
- Choice placeholders: `${1|one,two,three|}` $\rightarrow$ `one,two,three`.
- Empty tabstops: `$0`, `$1`, `${1}` $\rightarrow$ `""`.
- Escaped characters: `\\$` $\rightarrow$ `$`.

This ensures that code suggestions insert functional identifier names rather than raw snippet syntax.

---

# 5. Documentation & Detail Formatting

- **Detail**: Plain string truncated to a defensive maximum of 500 characters.
- **Documentation**:
  - Plain string or LSP `MarkupContent` (`{ kind: 'plaintext' | 'markdown', value: string }`).
  - Passed through `LspCompletionValidator.sanitizeDocumentation()`.
  - Dangerous HTML elements (`<script>`, `<iframe>`, `<object>`, `<embed>`) and `javascript:` URLs are stripped.
  - Length is capped at 10,000 characters to prevent DOM denial-of-service in suggestion popups.

---

# 6. Additional Text Edits (Auto-Imports)

If `additionalTextEdits` are declared by the server (e.g. for automatic imports):
- Validated for non-negative, valid start/end coordinates.
- Translated to 1-based ranges.
- Capped at a maximum of 20 auxiliary edits per item.
- Applied atomically in the same `EditTransaction` as the primary completion item.
