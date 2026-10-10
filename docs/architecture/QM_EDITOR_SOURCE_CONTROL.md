# QM EDITOR — SOURCE CONTROL ARCHITECTURE
**Phase 1, Step 18 — Git Integration & Source Control Foundation**

---

## 1. ARCHITECTURAL OVERVIEW

The **Source Control Subsystem** introduces Git repository awareness and status tracking into QM Editor without destabilizing, rewriting, or bypassing any existing QM Editor core subsystems (File Service, Document Service, Workspace Model, Command Registry, Search, Quick Open).

### Key Architectural Principles:
1. **Read-Oriented & Observation-Only:** All Git operations in Step 18 are read-only inspection calls (`detectRepository`, `getStatus`, `getDiff`). The system never automatically stages, commits, resets, discards, or mutates repository files.
2. **Provider-Agnostic Abstraction:** Isolates Git-specific logic behind a generic `SourceControlProvider` interface, allowing future extensions without spreading Git details across UI components.
3. **Strict UI Execution Isolation:** UI components must **never** execute raw process commands (`git ...`). All interactions route through `SourceControlService` -> `SourceControlProvider`.
4. **Independent Domain Separation:** `Document Dirty State` ≠ `Git Working Tree Status`. An open file tab marked dirty in memory remains dirty regardless of Git working tree disk status.

---

## 2. SUBSYSTEM ARCHITECTURE & DATA FLOW

```text
┌────────────────────────────────────────────────────────┐
│                        UI LAYER                        │
│ ┌────────────────┐ ┌───────────────┐ ┌───────────────┐ │
│ │  SCM Panel UI  │ │ File Explorer │ │  Status Bar   │ │
│ └───────┬────────┘ └───────┬───────┘ └───────┬───────┘ │
└─────────┼──────────────────┼─────────────────┼─────────┘
          │                  │                 │
          ▼                  ▼                 ▼
┌────────────────────────────────────────────────────────┐
│                 SourceControlContext                   │
└────────────────────────────┬───────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────┐
│                 SourceControlService                   │
│  - Generation Token Safety & Debounced Status Refresh  │
└────────────────────────────┬───────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────┐
│               SourceControlProvider (Interface)        │
│                        GitProvider                     │
└────────────────────────────┬───────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────┐
│            Git Metadata & Working Tree Reader           │
│  - Reads .git/HEAD, .git/index & Workspace Handle Tree │
└────────────────────────────────────────────────────────┘
```

---

## 3. DOMAIN MODEL & INTERFACES

### `GitStatusType`
- `unmodified`: File is clean and matches Git HEAD index.
- `modified`: File is modified in working tree or index.
- `staged`: File is staged for commit in index.
- `untracked`: New file present in working tree not tracked by Git.
- `deleted`: Tracked file deleted from working tree.
- `renamed`: Tracked file renamed or moved.
- `conflict`: File contains merge conflicts or unmerged index entries.
- `ignored`: File matches `.gitignore` patterns.
- `unknown`: Status cannot be determined.

### `SourceControlFileStatus`
```typescript
export interface SourceControlFileStatus {
  path: string;
  relativePath: string;
  repositoryId: string;
  indexStatus: GitStatusType;
  workingTreeStatus: GitStatusType;
  displayStatus: GitStatusType;
  isConflict: boolean;
  isIgnored: boolean;
  isUntracked: boolean;
}
```

### `GitRepositoryState`
```typescript
export interface GitRepositoryState {
  repositoryId: string;
  providerId: string;
  repositoryRoot: string;
  displayName: string;
  isGitRepository: boolean;
  currentBranch: string | null;
  isDetachedHead: boolean;
  headCommit: string | null;
  fileStatuses: Map<string, SourceControlFileStatus>;
  stagedFiles: SourceControlFileStatus[];
  workingTreeFiles: SourceControlFileStatus[];
  untrackedFiles: SourceControlFileStatus[];
  conflictedFiles: SourceControlFileStatus[];
  isLoading: boolean;
  error: string | null;
  lastRefreshedTimestamp: number;
}
```

---

## 4. REPOSITORY & BRANCH DETECTION
1. **Repository Root:** Detects `.git` metadata at workspace root or parent folders.
2. **Branch Identification:** Parses `.git/HEAD` reference (e.g. `ref: refs/heads/main` -> `main`). Detached HEAD states extract the short 7-character commit SHA (`HEAD at a1b2c3d`).
3. **Git Unavailable / Non-Git Workspaces:** Safely degrades to `isGitRepository: false` without throwing unhandled UI exceptions.

---

## 5. DIFF INSPECTION & BINARY SAFETY
- **Working Tree Diff:** `GitProvider.getDiff(filePath)` retrieves the original base HEAD content and compares it against the working tree file text.
- **Binary File Guard:** Binary files (`.png`, `.exe`, `.zip`, etc.) or files containing NUL bytes in the first 1KB are rejected from text diff viewing with a clear binary file notification.
- **Non-Destructive Guarantee:** Opening a diff view is strictly read-only and never saves, stages, or modifies physical files.

---

## 6. ASYNCHRONOUS GENERATION SAFETY
- To prevent stale status updates during rapid workspace switching or heavy edits, `SourceControlService` assigns an incrementing `generationId` token to each status request batch.
- Outdated async status responses arriving after a workspace switch are automatically discarded.

---

## 7. FUTURE EXTENSION BOUNDARY
The following capabilities are deliberately **out of scope** for Phase 1 Step 18 and deferred to future phases:
- Stage / Unstage files
- Commit creation
- Push / Pull / Fetch / Remote operations
- Branch switching / creation / deletion
- Stash / Rebase / Merge resolution
- Cloud / Remote hosting integration
