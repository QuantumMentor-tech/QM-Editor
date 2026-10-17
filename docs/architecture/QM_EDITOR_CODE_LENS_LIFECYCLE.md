# QM Editor — Code Lens Lifecycle & Stale Protection
**Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration**

---

## 1. Lifecycle Events & Trigger Matrix

| Event | Action Taken | Rationale |
| :--- | :--- | :--- |
| **Document Opened** | Immediate request dispatched | Provide symbols and references as soon as document renders |
| **Document Changed** | Invalidate active lenses; debounce request (250ms) | Avoid flooding LSP server during rapid keystroke typing |
| **Document Saved** | Refresh lenses | Ensure lenses align with post-save build or diagnostics state |
| **Document Closed** | Cancel in-flight requests; clear cache; clear lines | Prevent memory leaks and dangling DOM widgets |
| **Workspace Switched** | Invalidate all lenses; increment workspace generation | Ensure workspace A lenses never bleed into workspace B |
| **Server Restarted** | Clear all session lenses; re-request on server `ready` | Avoid stale command references from dead server processes |
| **Language Changed** | Invalidate provider cache; re-negotiate capability | Re-bind to correct language server session |
| **Settings Changed** | If disabled, clear decorations immediately | Respect user privacy/preference toggles without delay |

---

## 2. Double Revision Guard & Stale Protection

Due to network and JSON-RPC latency, a server response might arrive after the user has continued typing or navigated away. Applying outdated ranges would position lenses on the wrong lines or wrong symbols.

The **Double Revision Guard** operates as follows:

```ts
// 1. Dispatch time snapshot
const requestRevision = docRecord.contentRevision;
const requestWorkspaceGen = workspaceEngine.getGeneration();

// 2. Transmit request to LSP server over JSON-RPC...
const response = await session.getClient().sendRequest(...);

// 3. Arrival check
const currentDoc = documentEngine.getByResource(uri);
const currentWorkspaceGen = workspaceEngine.getGeneration();

if (
  !currentDoc ||
  currentDoc.contentRevision !== requestRevision ||
  currentWorkspaceGen !== requestWorkspaceGen
) {
  // Stale result: silently discard without updating editor decorations
  return null;
}
```

---

## 3. Resource Cleanup & Memory Safety

1. **Weak / Managed References**:
   Decorations and cache entries are indexed strictly by document URI and content revision. When a document is closed, `clearLenses(uri)` explicitly deletes the entry from `activeLines`, `activeLenses`, and `LspCodeLensProvider` cache.
2. **Debounce Timer Cancellation**:
   Any pending debounce timers for a URI are cleared immediately on document change, close, or coordinator disposal.
3. **Cancellation Tokens**:
   Each document URI maintains a `CancellationTokenSource`. Starting a new request cancels any outstanding in-flight request for that URI.
