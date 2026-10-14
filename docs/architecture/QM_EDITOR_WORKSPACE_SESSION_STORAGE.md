# QM Editor — Workspace Session Storage Architecture

## Phase 05 — Data & Storage Architecture (Step 47)

### 1. Architectural Scope & DTO Schema

Workspace session storage preserves runtime continuity across application restarts. The authoritative session schema (`WorkspaceSessionDTO`) contains:

```typescript
export interface WorkspaceSessionDTO {
  version: number;               // Schema version (currently 1)
  openFilePaths: string[];       // Ordered list of open document paths/URIs
  activeFilePath?: string;       // Active document path/URI
  lastLocations?: Record<string, { line: number; column: number }>;
  timestamp: number;
}
```

### 2. Restored vs Non-Restored State

To preserve data safety and avoid storing fictional runtime state, persistence boundaries are rigorously enforced:

| Field / State | Restored? | Reason & Behavior |
| :--- | :--- | :--- |
| **Open Disk Documents** | Yes | Saved file paths inside workspace roots are durably stored and re-opened. |
| **Active Document Tab** | Yes | Re-activated if valid and contained within workspace. |
| **Cursor Position** | Yes | Restored and safely clamped to file line/column boundaries. |
| **Dirty Document Edits** | **No** | **Open file reference != unsaved content**. Unsaved text is NOT claimed to be recovered until Phase 05 document history/crash recovery (Step 48+). Live filesystem remains authoritative for file content. |
| **Untitled Documents** | **No** | Untitled buffers without filesystem paths are excluded from session storage to prevent orphaned references. |
| **File Explorer Expansion**| Session-only | Stored in transient UI state or settings; not bloated into workspace session records. |
| **Editor Instances / DOM** | **No** | Runtime objects are completely regenerated on startup. |

### 3. Safe & Resilient Restoration Sequence

When reopening a workspace, `restoreSession(workspaceId, expectedGeneration)` executes with individual safety shields:

```
Stored Session Loaded
         │
         ▼
[1] Generation Check ─── (Mismatch?) ───> Abort (status: 'stale_generation')
         │
         ▼ (Match)
[2] Iterate openFilePaths
         │
         ├── Check Resource Containment (isResourceInRoot)
         │       └── Outside boundary? ───> Skip & log warning
         │
         ├── DocumentEngine.openResource()
         │       └── File missing/deleted? ───> Skip safely without crashing session
         │
         └── Clamp & Restore Cursor Location
         │
         ▼
[3] Activate Last Active Document (if valid)
         │
         ▼
Report Result: { restoredCount, skippedPaths, activeRestored }
```

- **Partial Restoration Guarantee:** Missing, deleted, or permission-denied files are safely skipped without halting the restoration of remaining valid files.
- **Race Condition & Workspace Switch Protection:** Every asynchronous file opening rechecks the WorkspaceEngine generation. If the user rapidly switches to another workspace, pending restoration promises immediately abort and discard late results.

### 4. Strict Workspace Isolation

A session record for Workspace A is keyed by `ws-alpha` in the `workspace_session` partition.
- During session persistence, `persistCurrentSession()` filters out any open documents that do not belong to the roots of the active workspace.
- Opening Workspace B will never restore Workspace A's files.
- Clearing Workspace A's persistent state has zero impact on Workspace B's session.
