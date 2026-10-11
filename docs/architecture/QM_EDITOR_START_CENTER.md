# QM Editor — Start Center & Welcome Experience Architecture

## 1. Overview & Architectural Role

The **Start Center** serves as the initial landing surface and workspace entry point for QM Editor when:
1. No workspace folder is open,
2. No documents/buffers are currently open, or
3. The user explicitly invokes `Help: Welcome (Start Center)` via the menu bar, command palette (`workbench.action.openWelcome`), or shortcut.

It provides intentional and structured guidance for navigating local development workflows, opening or creating files, picking recent projects, and accessing core tools without adding unnecessary complexity or bloat.

```text
               Application Startup
                       ↓
               Workspace Resolution
                       ↓
         ┌─────────────┴─────────────┐
         ▼                           ▼
  Active Workspace            No Workspace
         │                           │
  Restored Editor             Start Center
         │                     ├── Open Workspace (workspace.open)
         │                     ├── New File (file.new)
         │                     ├── Open File (file.open)
         │                     ├── Recent Workspaces
         │                     └── Quick Access Cards
         │                           │
         └─────────────┬─────────────┘
                       ▼
                 Active Editor
```

---

## 2. Welcome Surface vs Document Model Separation

A non-negotiable architectural invariant of QM Editor is:

> **The Welcome Experience is NOT an editable document or tab.**

- **No Document Registry Pollution:** The Start Center does NOT register into `DocumentRegistry`, has no document ID (`docId`), no file URI, and no edit buffer.
- **No Dirty State:** It cannot trigger dirty indicators or unsaved changes warnings.
- **No Save Interception:** It does not intercept file saving, formatting, or serialization commands.
- **Clean Transitions:** Opening or creating a document automatically transitions the workspace view away from `StartCenter` to the active document editor without requiring manual dismissal.

---

## 3. Workspace Entry Flow

All actions invoked from the Start Center route directly through the canonical **Command Registry** and underlying platform services:

1. **Open Workspace (`workspace.open`):**
   - Dispatches through `ExplorerContext` / `WorkspaceService`.
   - Opens local directory selector.
   - On success, updates `workspaceRoot`, indexes files, logs to `RecentWorkspacesService`, and transitions the UI to the editor workspace.

2. **Open File (`file.open`):**
   - Routes through `file.open` command.
   - Activates file picker and mounts the opened file in the `DocumentRegistry`.

3. **New File (`file.new`):**
   - Creates an in-memory document (`Untitled-X`) managed by `WorkspaceContext`.
   - Mounts the document in the tab bar and opens the editor buffer.

---

## 4. Recent Workspaces Service (`RecentWorkspacesService`)

The `RecentWorkspacesService` manages recent workspace history with safety and privacy:

### 4.1 Bounded Storage & Deterministic Ordering
- **Storage Limit:** Maximum 10 entries (`MAX_RECENT_WORKSPACES = 10`).
- **MRU Ordering:** Most recently opened workspace is placed at index 0. Re-opening moves the entry to the front without duplicates.
- **Deduplication:** Normalizes paths (case-insensitive on Windows) to prevent duplicate items.

### 4.2 Safe Persistence & Fault Isolation
- Persisted under `qm_editor_recent_workspaces_v1` in `localStorage`.
- Includes an in-memory fallback for environments where persistent web storage is unavailable or disabled.
- Validates data against corruption, malformed JSON, and unexpected schemas.

### 4.3 Safe Removal vs Destruction
- Removing an entry via `RecentWorkspacesService.removeRecentWorkspace(path)` **only** clears the metadata record from history.
- It **never** invokes filesystem deletion APIs and cannot delete physical directories or files.

### 4.4 Privacy & Local Isolation
- Recent workspace paths are strictly local to the client.
- Paths are never transmitted over the network, included in telemetry, or shared with cloud services.

---

## 5. Standardized Empty-State System

QM Editor enforces strict semantic differentiation across all empty, loading, and error states using the reusable Step 26 `EmptyState` component:

```text
Empty ≠ Loading
Empty ≠ Error
Empty ≠ Unavailable
No Results ≠ Error
```

| Surface | Condition | Icon / Variant | Description |
|---|---|---|---|
| **File Explorer** | No folder opened | `FolderOpen` (Accent) | Guides user to open a workspace directory with action button. |
| **File Explorer** | Folder open, 0 files | `Folder` (Muted) | Explains that directory contains no files matching display criteria. |
| **Editor Canvas** | Workspace open, 0 tabs | `FileCode` (Muted) | Offers quick actions: New File, Open File, Quick Open. |
| **Source Control** | Checking status | `RotateCw` (Spinner) | Active loading state, not empty. |
| **Source Control** | Error occurred | `AlertCircle` (Error) | Factual error display with "Retry" action. |
| **Source Control** | Not a Git repository | `AlertCircle` (Muted) | Explains workspace is not a git repo without false error. |
| **Source Control** | Clean working tree | `CheckCircle2` (Success) | Confirms working tree is clean with 0 uncommitted changes. |
| **Tasks** | No tasks defined | `Play` (Muted) | Informs user no tasks are configured. |
| **Problems** | 0 problems | `CheckCircle2` (Success) | Confirms zero diagnostics recorded in current session. |
| **Problems** | Filter yields 0 | `Filter` (Muted) | Informs user that no issues match the active filter. |
| **Terminal** | 0 sessions | `Terminal` (Muted) | Provides "Create Terminal" primary action button. |
| **Search** | No query entered | `Search` (Muted) | Prompts user to type a query. |
| **Search** | 0 query matches | `Search` (Muted) | States no occurrences found for query. |

---

## 6. Accessibility & Responsive UX

- **Semantic Landmarks:** Rendered with `role="region"` and `aria-label="QM Editor Start Center"`.
- **Keyboard Navigation:** All cards, action buttons, and recent entries are fully reachable via standard `Tab` / `Shift+Tab` and activated with `Enter` / `Space`.
- **Theme Awareness:** Uses semantic CSS design tokens (`--bg-editor`, `--text-primary`, `--accent-primary`, `--border-color`) to render consistently in Dark and Light themes.
- **Responsive Layout:** Automatically adapts from a multi-column grid on desktop displays to a stacked vertical flow on compact viewports without horizontal clipping.
