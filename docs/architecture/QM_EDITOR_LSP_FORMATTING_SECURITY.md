# QM Editor — LSP Formatting Security & Safety (Step 63)

## 1. Threat Model & Security Boundaries

Language servers run external binaries that transmit structured text edits back to QM Editor. An unvalidated formatting response could attempt:
1. **Denial of Service (DoS)**: Overwhelming memory and CPU with tens of thousands of microscopic edits or multi-gigabyte string payloads.
2. **Buffer Overflows / Text Inversion**: Delivering inverted, overlapping, or out-of-bounds ranges that corrupt source code structure.
3. **Data Loss via Race Conditions**: Returning edits against an outdated document revision while the user continues typing.
4. **Read-Only / Protected File Mutation**: Mutating locked, read-only, or virtual files.

---

## 2. Validation & Quarantine Controls (`LspFormattingValidator`)

### 2.1 Payload Limits
- **Maximum Edit Count**: Default `1,000` edits per single formatting response (hard capped at `5,000`). Responses exceeding this threshold are rejected immediately.
- **Maximum Text Length**: Single edit text length is capped at `1,000,000` characters. Total response text payload is capped at `10,000,000` characters.

### 2.2 Range Integrity Validation
- All range coordinates must be non-negative integers.
- Start position must precede or equal end position (`start.line < end.line` or `start.line === end.line && start.character <= end.character`).
- Position coordinates cannot exceed actual document line count or line length.

### 2.3 Strict Non-Overlapping Invariant
The validator converts all edits to document character offsets and sorts them in ascending order. Any overlap (`curr.startOffset < prev.endOffset`) triggers an immediate validation failure (`status: 'overlap'`).

---

## 3. Concurrency & Revision Guards

1. **Document Revision Barrier**: The document revision is captured before the request is dispatched. When the response arrives, `currentDoc.contentRevision` must equal `request.documentRevision`. If any user keypress intervened, the response is discarded as `stale`.
2. **Workspace Generation Guard**: If the active workspace changes during request execution, the formatting operation is rejected as `workspace_mismatch`.
3. **Read-Only Enforcement**: Documents marked `doc.metadata.isReadOnly` are rejected at both provider and coordinator levels.
