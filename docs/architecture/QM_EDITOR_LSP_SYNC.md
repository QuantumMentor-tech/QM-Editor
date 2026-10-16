# QM Editor — Language Server Document Synchronization

**Phase 06 — Advanced Features**  
**Step 56 of 135: Language Server Protocol Foundation, Server Lifecycle & Client Architecture**

---

## 1. Document Authority & Event Bridging

`DocumentEngine` remains the authoritative source of truth for text content, revisions, and dirty states. `LspDocumentSync` acts as a passive consumer of document events:

```
DocumentEngine Event            LSP Notification
───────────────────────────     ───────────────────────────
document.opened           ───►  textDocument/didOpen
document.saved            ───►  textDocument/didSave
document.closed           ───►  textDocument/didClose
content change / edit     ───►  textDocument/didChange
```

---

## 2. Version Mapping & Monotonic Ordering

LSP requires a strictly increasing integer `version: number` on each document state transmission.
- **Revision Decoupling:** QM Editor document revisions (`document.revision`) are distinct from LSP synchronization versions.
- **Tracking State:** `LspDocumentSync` maintains a `Map<DocumentId, LspTrackedDocState>` with monotonic counters:
  - `didOpen`: Initializes `version = 1`.
  - `didChange`: Increments `version = ++state.version`.
  - `didSave`: Uses current `version`.
  - `didClose`: Untracks document and releases tracking state.

---

## 3. Stale Result Rejection

To ensure that late-arriving responses (e.g. from an asynchronous server computation) are never applied to updated document buffers:
1. Every LSP request records:
   - `documentRevision`
   - `modelVersion`
   - `workspaceGeneration`
2. When the server response arrives, `LspRequestManager.checkStaleness(req, activeRev, activeGen)` verifies:
   - If `activeRev > req.documentRevision`, the response is flagged as stale and rejected with `LspStaleResponseError`.
   - If `activeGen !== req.workspaceGeneration`, the response is immediately dropped.

---

## 4. Multi-Document & Multi-Workspace Scoping

- Multiple documents within the same workspace and language share the same `LspServerSession`.
- Closing a document triggers `didClose` and decrements session tracking count.
- The server session remains alive and serving other active documents until the last dependent document is closed or the workspace itself is closed.
- Documents from separate workspaces are never routed to the same language server session.
