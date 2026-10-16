# QM Editor Rename Safety
**Phase 06 | Step 62**

A language-server `WorkspaceEdit` is an untrusted *proposal*. It passes this chain before any mutation:

URI validation → workspace/resource validation → revision validation → range/overlap validation → read-only check → canonical mapping → `CodeActionCoordinator` validation → `EditorCoordinationService` / Edit Transaction.

## Stale protection
- Each request records document revision, workspace generation and server session. Any mismatch before or after the server responds yields `stale`; nothing is applied.
- Versioned `documentChanges` are checked against the LSP sync version, which is distinct from the QM document revision.

## Dirty / open documents
- Edits to open documents go through the transaction layer with expected revision, so unsaved content is never overwritten. Incompatible edits abort the whole rename.
- Rename never auto-saves; modified documents become dirty and Save remains the user's action.

## Read-only, permissions, workspace boundaries
- Any read-only target blocks the entire rename before any change.
- Only `file:`, `untitled:`, `qm:` targets inside the workspace are accepted; traversal (`..`), malformed encodings and executable schemes (`javascript:`, `command:`, `shell:` ...) are rejected.

## Resource operations
- Create/delete file operations are rejected as `unsupported_operation`. File **rename** operations are validated and mapped into the canonical `WorkspaceEdit.resourceOperations`; they are never executed by LSP code (no raw filesystem calls). Application of resource operations is left to the existing code-action/resource layer, and end-to-end file-rename application was not exercised against a real filesystem in this step.

## Transaction safety / rollback
- Whole edit set is validated first; overlapping edits are rejected rather than reordered.
- Edits per document are applied in descending offset order, grouped for one undo step.
- Cross-file atomicity is **not** claimed: if apply fails midway, rollback uses the transaction infrastructure and any residual partial state is reported explicitly.
- Escape/cancel never mutates documents.
