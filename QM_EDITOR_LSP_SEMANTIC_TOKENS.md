# QM Editor — LSP Semantic Tokens Architecture & Protocol Specification
**Phase 06 — Advanced Features | Step 64 of 135**

---

## 1. Executive Architecture Overview

QM Editor's Language Server Protocol (LSP) Semantic Tokens subsystem enhances baseline syntax highlighting with deep semantic awareness computed dynamically by language servers.

Lexical syntax highlighting (powered by Lezer grammars in CodeMirror 6) provides the foundational, immediate highlighting baseline. LSP Semantic Tokens provide a supplementary, asynchronous layer that distinguishes variables, functions, classes, type parameters, interfaces, properties, and modifiers such as `readonly`, `static`, and `deprecated`.

```text
Source Document
      │
      ├──────────────► Lexical Syntax Highlighting (Immediate Baseline)
      │
      └──────────────► LSP Synchronization (didChange)
                             │
                             ▼
                       Language Server
                             │
                             ▼
                       Semantic Tokens
                             │
                             ▼
                     Token Validation
                             │
                             ▼
                   Canonical Token Model
                             │
                             ▼
                  Editor Decoration Layer (CodeMirror 6 RangeSet)
```

---

## 2. Supported LSP Protocol Operations

QM Editor implements the full semantic tokens protocol surface defined by the LSP 3.17 specification:

### 2.1 `textDocument/semanticTokens/full`
- **Method**: `textDocument/semanticTokens/full`
- **Params**: `{ textDocument: { uri: DocumentUri } }`
- **Response**: `{ resultId?: string, data: number[] }`
- **Purpose**: Retrieves all semantic tokens for the entire document buffer. Returned as a delta-encoded 5-tuple integer array.

### 2.2 `textDocument/semanticTokens/range`
- **Method**: `textDocument/semanticTokens/range`
- **Params**: `{ textDocument: { uri: DocumentUri }, range: Range }`
- **Response**: `{ data: number[] }`
- **Purpose**: Requests tokens specifically for the active viewport or visible text range to optimize initial load or rapid scrolling.

### 2.3 `textDocument/semanticTokens/full/delta`
- **Method**: `textDocument/semanticTokens/full/delta`
- **Params**: `{ textDocument: { uri: DocumentUri }, previousResultId: string }`
- **Response**: `{ resultId?: string, edits: SemanticTokensEdit[] } | { resultId?: string, data: number[] }`
- **Purpose**: High-efficiency incremental token synchronization. Instead of retransmitting thousands of tokens on every keystroke, the server transmits only splice edits against the cached base token set.

---

## 3. Server Capability Negotiation & Legend Session Boundary

During the `initialize` handshake, QM Editor advertises semantic token capabilities in `ClientCapabilities`:

```json
{
  "textDocument": {
    "semanticTokens": {
      "dynamicRegistration": false,
      "requests": {
        "range": true,
        "full": { "delta": true }
      },
      "tokenTypes": [
        "namespace", "type", "class", "enum", "interface",
        "struct", "typeParameter", "parameter", "variable",
        "property", "enumMember", "event", "function",
        "method", "macro", "keyword", "modifier", "comment",
        "string", "number", "regexp", "operator", "decorator", "label"
      ],
      "tokenModifiers": [
        "declaration", "definition", "readonly", "static",
        "deprecated", "abstract", "async", "modification",
        "documentation", "defaultLibrary"
      ],
      "formats": ["relative"],
      "overlappingTokenSupport": false,
      "multilineTokenSupport": false,
      "augmentsSyntaxTokens": true
    }
  }
}
```

### Session Legend Invariant
- Token type and modifier indices are **strictly server-session specific**.
- Token indices from Session A can never be evaluated against Session B's legend.
- `LspSemanticTokenLegendRegistry` maintains session-scoped legends identified by `sessionKey` (`serverDefinitionId::workspaceId`).
- Legend generation counters monotonically increment on actual legend revisions; server restart or disconnect invalidates legend generation and purges cached result IDs immediately.

---

## 4. Delta-Encoded Token Representation & Decoding

The protocol returns semantic tokens as flat 5-tuple integers:
`[deltaLine, deltaStartChar, length, tokenTypeIndex, tokenModifiersMask]`

### Protocol Decoding Invariant
- When `deltaLine === 0`:
  `startChar = previousStartChar + deltaStartChar`
- When `deltaLine > 0`:
  `line = previousLine + deltaLine`
  `startChar = deltaStartChar` (relative to character 0 of the new line)

`LspSemanticTokenDecoder` validates all 5 tuples:
1. All coordinates and lengths must be non-negative integers.
2. `length > 0` (zero-length tokens are rejected).
3. `tokenTypeIndex` must be within the server's legend bounds.
4. Modifier bitmasks are mapped to modifier names. Unknown bits are masked away.

---

## 5. Incremental Delta Synchronization Safety

When `textDocument/semanticTokens/full/delta` returns edits (`{ start, deleteCount, data }`):
1. `applyDeltaEdits` validates splice bounds: `start >= 0`, `deleteCount >= 0`, and `start + deleteCount <= baseLength`.
2. If any edit in the delta array violates buffer boundaries, the entire delta edit payload is rejected.
3. The provider automatically falls back to dispatching a fresh `textDocument/semanticTokens/full` request.

---

## 6. Stale Token Protection & Revision Guarantees

Before applying decoded semantic tokens to the editor surface, the subsystem enforces the double-revision guard:

```text
Request Dispatched
  ├── Record Request Content Revision (Primitive number)
  ├── Record Workspace Generation
  └── Record Server Session ID & Legend Generation
          │
          ▼ [In-flight Async LSP Roundtrip]
          │
Response Received
  ├── Validate Workspace Generation hasn't changed
  ├── Validate Document still exists in DocumentEngine
  ├── Validate DocumentEngine.getByResource(uri).contentRevision === requestDocRevision
  └── Validate Session & Legend Generation match
          │
    Pass ──┴── Fail
     │          │
     ▼          ▼
   Apply     Discard Stale Result
```

If the user types while a token request is in flight, the content revision advances and the late-arriving response is safely dropped, preventing stale colors from overwriting current text.

---

## 7. Fallback & Crash Resilience

1. **Server Crash / Unavailability**: If a language server crashes, times out, or fails to initialize, `LspSemanticTokenCoordinator` clears the semantic token decoration set. Normal lexical syntax highlighting continues uninterrupted.
2. **Pathological Payload Protection**: Payloads exceeding 50,000 tokens are truncated defensively by `LspSemanticTokenDecoder` to prevent main-thread UI freezing.
3. **Non-Persistence**: Semantic token caches, raw integer arrays, and decorations exist exclusively in transient runtime memory and are never serialized into workspace storage or local history.
