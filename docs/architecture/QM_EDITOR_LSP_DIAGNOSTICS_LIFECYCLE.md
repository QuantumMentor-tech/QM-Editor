# QM Editor — LSP Diagnostics Lifecycle & Stale Protection

**Phase 06 — Advanced Features**  
**Step 57 of 135: LSP Diagnostics Integration, Problems Synchronization & Diagnostic Lifecycle**

---

## 1. Diagnostic Publication Lifecycle

```
Server Publishes Notification (textDocument/publishDiagnostics)
                       │
                       ▼
            Session Valid & Active?
           ├── No  ──► Discard (Silent Log)
           └── Yes
                       │
                       ▼
          Session Generation Fresh?
           ├── No  ──► Discard (Stale Notification)
           └── Yes
                       │
                       ▼
          Workspace Generation Match?
           ├── No  ──► Discard (Stale Workspace)
           └── Yes
                       │
                       ▼
        Deep Schema & Range Validation
           ├── Invalid Item ──► Quarantine Item
           └── Valid Items
                       │
                       ▼
          Empty Diagnostics Array?
           ├── Yes ──► collection.delete(resourceUri) (Clears Problems)
           └── No  ──► collection.set(resourceUri, canonicalDiagnostics)
                       │
                       ▼
       DiagnosticService Notifies Subscribers
                       ├──► ProblemsPanel Re-renders
                       └──► EditorSurface Updates Decorations
```

---

## 2. Event Lifecycle & Automatic Cleanup Rules

### A. Document Closed
When an editor tab is closed:
- Diagnostics remain associated with the resource URI in the `DiagnosticCollection`.
- The Problems panel continues to show the resource's problems.
- Editor decorations are cleanly unmounted along with the tab view.
- Opening the document again restores editor markers from the persistent collection.

### B. Resource Deleted
When a file is deleted from the workspace (`DiagnosticService.handleResourceDeleted(uri)`):
- The URI is removed from all diagnostic collections across all providers.
- Problem counts update and the file disappears from the Problems tree.

### C. Resource Renamed
When a file is renamed (`DiagnosticService.handleResourceRenamed(oldUri, newUri)`):
- Diagnostics are automatically reassigned to the new canonical URI across all collections without losing diagnostic state.

### D. Server Session Stop / Crash / Restart
When a server stops, crashes, or is manually restarted:
- `globalLspDiagnosticsBridge.clearForServer(serverDefinitionId)` is invoked.
- All diagnostics from that server are immediately cleared.
- Session generation is incremented on restart (`sessionGeneration++`).
- Any delayed/out-of-order notification from the old server run is rejected as stale.

### E. Workspace Closed / Switched
When the active workspace closes:
- All LSP server sessions are stopped and disposed.
- `LspDiagnosticsBridge.clearAll()` clears all collections.
- Diagnostics from the previous workspace never leak into the newly opened workspace.

---

## 3. Stale Response Protection & Generation Fencing

1. **Provider Generation Fencing:** Every `set()` operation passes `{ generation: sessionContext.generation }`. If an out-of-order publication arrives with a lower generation than already stored, `DiagnosticCollection` drops the publication.
2. **Workspace Generation Fencing:** Every `set()` operation checks active `workspaceGeneration`. Cross-workspace publications are discarded before touching memory stores.
3. **Document Version Mapping:** If the server publishes `params.version`, it is recorded as `documentRevision` on canonical diagnostics for auditability.
