# QM Editor — Workspace Persistence Architecture

## Phase 05 — Data & Storage Architecture (Step 47)

### 1. Architectural Authority & Overview

In QM Editor, the **Workspace Engine** (`WorkspaceEngine`) remains the sole runtime authority for active workspace models, root lifecycles, and generation tracking. Persistent storage serves purely as the durable snapshot mechanism to preserve approved workspace state across application restarts without turning the storage layer into a secondary workspace manager.

```
+-------------------------------------------------------+
|                 WorkspaceEngine                       |
|   (Authoritative Runtime Lifecycle & Generations)     |
+---------------------------+---------------------------+
                            | Lifecycle Events
                            v
+-------------------------------------------------------+
|         WorkspacePersistenceCoordinator               |
|      (Debounced Scheduling, Generational Safety)       |
+---------------------------+---------------------------+
                            | Normalized DTOs
                            v
+-------------------------------------------------------+
|             WorkspaceStateRepository                  |
|               SessionStateRepository                  |
+---------------------------+---------------------------+
                            | Records & Checksums
                            v
+-------------------------------------------------------+
|                    StorageService                     |
|           (Atomic Writes, Version Governance)         |
+-------------------------------------------------------+
```

### 2. Stable Workspace Identity Strategy

A workspace name or display title is never used as a persistent identifier. Workspace identity is strictly derived from canonical root URIs through `normalizeWorkspacePath()`, ensuring that:
- Variations in slash direction (`\` vs `/`), redundant dots (`.` and `..`), and Windows drive letter casing (`c:` vs `C:`) collapse into the exact same canonical ID: `ws-${canonicalNormalizedRoot.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`.
- If a workspace directory is moved or renamed on disk, the new path represents a distinct canonical identity unless re-associated through project migration.
- UI components and services query `WorkspaceEngine.getWorkspaceId()`. No competing storage IDs are ever introduced.

### 3. Persisted Workspace Metadata Model

Workspace metadata stored in `workspace_metadata` partition includes:
- `id`: Canonical workspace identifier.
- `name`: Display name derived from folder basename or user override.
- `roots`: List of configured roots (`rootId`, canonical `uri`, `name`). Multi-root readiness is preserved.
- `createdAt`: Timestamp of first opening.
- `lastActiveAt`: Timestamp of latest access.

Transient runtime properties (such as file handles, event listeners, active promises, editor view state trees, cancellation tokens, or UI component references) are strictly prohibited from persistence.

### 4. Lifecycle Boundaries & Persistence Scheduling

Writing workspace state on every micro-interaction causes disk churn and degrades performance. Persistence boundaries are partitioned:
1. **Workspace Open (`workspace.opened`):** Immediate persistence of workspace metadata and updating of bounded recent workspaces.
2. **Document Modification / Tab Switch:** Controlled debounced save (default `300ms`) coalesces rapid sequential actions.
3. **Workspace Switch (`workspace.changing`):** Immediate synchronous flush of outgoing workspace session before switching context.
4. **Workspace Close (`workspace.closing`):** Immediate synchronous flush of current session before memory teardown.
5. **Application Shutdown:** Immediate shutdown flush coordinated via ApplicationRuntime `workspacePersistence` service.

### 5. Multi-Root Readiness

While the current UI is single-root primary, the persistent metadata model (`WorkspaceMetadataDTO.roots`) stores an array of roots. Roots are normalized independently and validated against the physical filesystem upon reload. If a secondary root becomes unavailable, the workspace enters degraded mode without failing the entire workspace.

### 6. Failure Recovery & Error Handling

Storage failures during session save or metadata persistence never crash the WorkspaceEngine or corrupt runtime state. Errors are logged with contextual diagnostics. If storage corruption is detected (invalid checksum or malformed record), the underlying StorageService quarantines the corrupted entry and initializes a clean baseline.
