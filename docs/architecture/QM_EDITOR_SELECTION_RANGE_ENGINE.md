# QM Editor — Selection Range Engine

## 1. Structural Range vs. Actual Selection State

A fundamental architectural principle of QM Editor is the strict distinction:

```
Selection Range
    = language-provided structural boundary metadata

Actual Selection
    = editor-owned authoritative user state
```

The language server describes **what larger structural boundaries exist**. The editor engine decides **what text region is actually selected**.

## 2. Canonical Range Representation

The subsystem normalizes untrusted server payloads into `CanonicalSelectionRange`:

```typescript
export interface CanonicalSelectionRange {
  id: string;
  documentId: string;
  resourceId: string;
  workspaceId: string;
  range: Range;              // 1-based (startLine, startColumn, endLine, endColumn)
  offsetRange: OffsetRange;  // 0-based character offsets { from, to }
  parent?: CanonicalSelectionRange;
  providerId: string;
  providerGeneration: number;
  documentRevision: number;
  source: 'lsp' | 'native';
}
```

## 3. Hierarchy Normalization Pipeline

Raw server responses pass through a multi-stage validation and normalization pipeline before entering editor state:

```
LSP Response
    │
    ▼
Coordinate Bounds Check (non-negative, integers, start <= end)
    │
    ▼
Cycle & Self-Reference Guard (visited Set fingerprinting)
    │
    ▼
Duplicate Range Elimination (collapses identical adjacent levels)
    │
    ▼
Parent Containment Verification (parent.start <= child.start && parent.end >= child.end)
    │
    ▼
Depth Limiting (MAX_DEPTH = 50 clamp)
    │
    ▼
Fast Offset Mapping via Precomputed Line Offsets
    │
    ▼
Canonical Hierarchy Model
```

## 4. Multi-Cursor Coordination

When the active editor contains multiple selection ranges:
1. `positions: LspPosition[]` queries all cursor head locations in a single batch request.
2. The validator maintains strict 1-to-1 index correspondence with the requested positions.
3. Partial failures are isolated: if one cursor's structural data is invalid or exhausted, that cursor remains intact while other valid cursors expand cleanly.
4. Ordering and anchor/head direction are preserved according to editor settings (`editor.selectionExpansion.preserveAnchor`).
