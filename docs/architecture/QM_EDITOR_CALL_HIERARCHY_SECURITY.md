# QM Editor — Call Hierarchy Security & Threat Mitigation

## 1. Threat Model & Untrusted Inputs
LSP server outputs are untrusted external inputs. Malicious, buggy, or compromised language servers could send:
- Malformed URIs (e.g. `javascript:`, `command:`, `data:`, `vbscript:`)
- Malformed or inverted range coordinates
- Disjoint `selectionRange` outside enclosing `range`
- Unbounded string lengths for names and details
- Infinite recursive cycles designed to cause stack overflow or memory exhaustion
- Deep graphs and oversized call lists designed to freeze the rendering UI

## 2. Defensive Validation Pipeline
`LspCallHierarchyValidator` provides multiple security guardrails:

```text
LSP Raw Payload
     │
     ▼
[1] URI Scheme Filter: Blocks non-whitelisted schemes (javascript, command, vbscript, data)
     │
     ▼
[2] Coordinate Validation: Enforces non-negative integers where start <= end
     │
     ▼
[3] Enclosure Check: Enforces selectionRange ⊆ range (normalizes to range if disjoint)
     │
     ▼
[4] String Sanitization: Clamps symbol name and detail to MAX_STRING_LENGTH (1024 chars)
     │
     ▼
[5] Call Site Filtering: Strips malformed call-site ranges in fromRanges
     │
     ▼
[6] Cycle Detection: Checks fingerprint against ancestral branch set; halts recursion
     │
     ▼
[7] Max Depth Enforcement: Clamps expansion to editor.callHierarchy.maxDepth (default 20)
     │
     ▼
[8] Max Call Count Clamping: Caps visible call relations per node to prevent DOM freeze
```

## 3. Sandboxing & Process Boundaries
- Call Hierarchy does not invoke `child_process`, `exec`, `spawn`, `fs.readFile`, or `fs.writeFile`.
- Opening a document is exclusively performed through `DocumentEngine.openResource()`.
