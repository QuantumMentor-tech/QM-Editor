# QM Editor LSP Rename Security, Sanitization & Double Validation
**Phase 06 — Advanced Features | Step 62 of 135**

---

## 1. Security Architecture & Threat Model

Language servers are treated as untrusted external processes. A malicious or compromised LSP server might return dangerous workspace edits targeting files outside the workspace or overlapping ranges designed to corrupt source trees.

QM Editor enforces strict **Double Validation** before applying any edit.

---

## 2. Security Safeguards in `LspWorkspaceEditValidator`

1. **Protocol URI Sanitization**:
   - Only `file:`, `untitled:`, and `qm:` URI schemes are permitted.
   - Dangerous schemes such as `javascript:`, `command:`, `shell:`, `data:`, or `http:` are rejected with status `unsupported_scheme`.
2. **Path Traversal Protection**:
   - Edits targeting `..`, `../..`, or directory traversals outside the canonical root are blocked.
3. **Identifier Sanitization**:
   - Proposed symbol names cannot exceed 256 characters.
   - Control characters (`\x00` - `\x1F`, `\x7F` - `\x9F`) and multi-line breaks are strictly rejected.
4. **Range & Coordinate Clamping**:
   - Ranges must have `from >= 0`, `to >= from`, and coordinates within the line counts and column lengths of the document.
   - Overlapping edit ranges on the same file are detected and rejected (`overlapping_edits`).
5. **Read-Only Document Protection**:
   - Read-only documents cannot be targeted by rename edits.
6. **Payload Clamping**:
   - Max 2,000 files affected per transaction.
   - Max 10,000 text edits total per transaction.
