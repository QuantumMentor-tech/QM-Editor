# QM Editor — LSP Semantic Token Mapping & Theming Architecture
**Phase 06 — Advanced Features | Step 64 of 135**

---

## 1. Authority Hierarchy

Semantic styling flows through a strictly controlled pipeline. Language servers classify code elements; QM Editor strictly determines styling and colors.

```text
LSP Token Type Index
        │
        ▼ (Session Legend)
Server Token Type String
        │
        ▼ (Sanitization & Mapping)
QM Semantic Token Category
        │
        ▼
Design Token / CSS Variable
        │
        ▼
Editor Theme (Dark / Light / High Contrast)
        │
        ▼
CodeMirror 6 Mark Decoration
```

---

## 2. Token Type Mapping Table

Server-provided token types are mapped to controlled QM Editor CSS classes. Raw server strings are never evaluated as arbitrary CSS classes.

| LSP Token Type | QM Semantic Category | CodeMirror Decoration Class | Default Dark Theme Token | Default Light Theme Token |
| :--- | :--- | :--- | :--- | :--- |
| `namespace` | `namespace` | `cm-semantic-namespace` | `#4ec9b0` (Teal) | `#1b7a6d` |
| `type` | `type` | `cm-semantic-type` | `#4ec9b0` (Teal) | `#267f99` |
| `class` | `class` | `cm-semantic-class` | `#4ec9b0` (Teal) | `#267f99` |
| `enum` | `enum` | `cm-semantic-enum` | `#4ec9b0` (Teal) | `#267f99` |
| `interface` | `interface` | `cm-semantic-interface` | `#b8d7a3` (Mint) | `#348a58` |
| `struct` | `struct` | `cm-semantic-struct` | `#4ec9b0` (Teal) | `#267f99` |
| `typeParameter` | `typeParameter` | `cm-semantic-typeParameter` | `#20b2aa` (Light Teal) | `#17746c` |
| `parameter` | `parameter` | `cm-semantic-parameter` | `#9cdcfe` (Light Sky Blue) | `#2a5d7c` |
| `variable` | `variable` | `cm-semantic-variable` | `#9cdcfe` (Light Sky Blue) | `#001080` |
| `property` | `property` | `cm-semantic-property` | `#dcdcaa` (Soft Yellow) | `#795e26` |
| `enumMember` | `enumMember` | `cm-semantic-enumMember` | `#4fc1ff` (Bright Cyan) | `#0070c1` |
| `event` | `event` | `cm-semantic-event` | `#dcdcaa` (Soft Yellow) | `#795e26` |
| `function` | `function` | `cm-semantic-function` | `#dcdcaa` (Yellow) | `#795e26` |
| `method` | `method` | `cm-semantic-method` | `#dcdcaa` (Yellow) | `#795e26` |
| `macro` | `macro` | `cm-semantic-macro` | `#bd63c5` (Magenta) | `#af00db` |
| `keyword` | `keyword` | `cm-semantic-keyword` | `#c586c0` (Purple) | `#af00db` |
| `modifier` | `modifier` | `cm-semantic-modifier` | `#569cd6` (Blue) | `#0000ff` |
| `comment` | `comment` | `cm-semantic-comment` | `#6a9955` (Green) | `#008000` |
| `string` | `string` | `cm-semantic-string` | `#ce9178` (Orange) | `#a31515` |
| `number` | `number` | `cm-semantic-number` | `#b5cea8` (Light Green) | `#098658` |
| `regexp` | `regexp` | `cm-semantic-regexp` | `#d16969` (Coral) | `#811f3f` |
| `operator` | `operator` | `cm-semantic-operator` | `#d4d4d4` (Light Gray) | `#383838` |
| `decorator` | `decorator` | `cm-semantic-decorator` | `#dcdcaa` (Soft Yellow) | `#795e26` |
| `label` | `label` | `cm-semantic-label` | `#c8c8c8` (Off-White) | `#000000` |

---

## 3. Token Modifier Mapping Table

Semantic token modifiers represent orthogonal attributes (e.g., `readonly`, `deprecated`, `static`). Modifiers are combined into class lists alongside the base token type.

| LSP Modifier | Decoration Class | Visual Styling Effect |
| :--- | :--- | :--- |
| `deprecated` | `cm-semantic-mod-deprecated` | `text-decoration: line-through; opacity: 0.72;` |
| `readonly` | `cm-semantic-mod-readonly` | Preserves base color, flags immutability in inspection |
| `static` | `cm-semantic-mod-static` | `font-style: italic;` |
| `declaration` | `cm-semantic-mod-declaration` | Applied to symbol defining declarations |
| `definition` | `cm-semantic-mod-definition` | Applied to implementation definitions |
| `abstract` | `cm-semantic-mod-abstract` | `font-style: italic;` |
| `async` | `cm-semantic-mod-async` | Enhanced keyword/method styling |
| `defaultLibrary` | `cm-semantic-mod-defaultLibrary`| Enhanced standard library type styling |
| `documentation` | `cm-semantic-mod-documentation` | Doc comment symbol highlighting |

---

## 4. Unsupported or Custom Server Types

If a language server provides custom or unmapped token types (e.g. `rust_lifetime`, `custom_annotation`):
1. The type string is sanitized against injection attacks (`/^[a-zA-Z0-9_-]+$/`).
2. If unrecognized, it is safely styled with standard neutral tokens or falls back to the underlying lexical grammar token.
3. Language servers cannot inject arbitrary CSS styles or execute client-side scripts.
