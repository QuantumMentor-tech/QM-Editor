# QM Editor — LSP Selection Ranges

## 1. Overview & Protocol Specification

The **LSP Selection Range** subsystem implements the Language Server Protocol 3.17 method `textDocument/selectionRange`. It enables language-aware structural selection expansion, allowing users to progressively expand selections from local lexical constructs (identifiers, expressions) up through semantic code hierarchies (arguments, statements, blocks, functions, classes, modules, and documents).

```
Editor / Cursor
        │
        ▼
Selection Request Context
        │
        ▼
Language Intelligence Coordinator
        │
        ▼
LSP Selection Range Provider
        │
        ▼
textDocument/selectionRange
        │
        ▼
LSP Selection Range Response
        │
        ▼
Validation / Position Mapping
        │
        ▼
Canonical QM Selection Range Model
        │
        ▼
Selection Coordinator
        │
        ▼
Existing Editor Selection State
        │
        ▼
User Selection Expansion
```

## 2. Capability Negotiation

During the language server initialization handshake:
- **Client Capability:** Advertised in `capabilities.textDocument.selectionRange = { dynamicRegistration: false }`.
- **Server Capability:** Detected from `serverCapabilities.selectionRangeProvider` (can be `boolean` or `{ workDoneProgress?: boolean }`).

The system explicitly distinguishes:
- `supported`: Server advertised capability and session is in `ready`/`running` state.
- `unsupported`: Server did not advertise capability; seamlessly falls back to native editor expansion without error banners.
- `temporarily unavailable`: Server restarting or initializing.

## 3. Protocol Request & Response

### Request (`textDocument/selectionRange`)
```json
{
  "textDocument": { "uri": "file:///path/to/file.ts" },
  "positions": [
    { "line": 10, "character": 15 }
  ]
}
```

### Response (`SelectionRange[] | null`)
```json
[
  {
    "range": { "start": { "line": 10, "character": 12 }, "end": { "line": 10, "character": 20 } },
    "parent": {
      "range": { "start": { "line": 10, "character": 4 }, "end": { "line": 10, "character": 25 } },
      "parent": {
        "range": { "start": { "line": 8, "character": 0 }, "end": { "line": 12, "character": 1 } }
      }
    }
  }
]
```

## 4. Architectural Boundaries & Ownership

- **LSP Client (`LspClient`)**: Protocol transport and JSON-RPC dispatch.
- **Selection Range Provider (`LspSelectionRangeProvider`)**: Capability checks, in-flight tracking, and stale revision gating.
- **Selection Range Validator (`LspSelectionRangeValidator`)**: Defensive bounding, parent containment, cycle detection, and duplicate removal.
- **Selection Range Mapper (`LspSelectionRangeMapper`)**: 0-based LSP coordinate to 1-based canonical ranges and buffer character offsets.
- **Selection Range Coordinator (`LspSelectionRangeCoordinator`)**: Runtime selection expansion and shrink history coordination.
- **Editor Engine (`EditorAdapter` / `EditorSurface`)**: Strictly authoritative over user selection and viewport rendering.
- **Document Engine (`DocumentEngine`)**: Content authority and revision tracking.

Zero text mutation guarantee: Selection expansion is pure view state and never mutates document text, changes undo history, marks buffers dirty, or triggers saving.
