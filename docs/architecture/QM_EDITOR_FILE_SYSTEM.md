# QM EDITOR — FILE SYSTEM SERVICE & SAFE SAVE ARCHITECTURE

**Version:** 1.0.0  
**Status:** Approved Document Storage & I/O Architecture  
**Last Updated:** October 10, 2026  

---

## 1. ARCHITECTURAL OBJECTIVE & SEPARATION OF CONCERNS

QM Editor enforces a strict separation between the **in-memory editing session** (Document Model) and **physical storage** (File Resource & File Service). No UI component or editor surface interacts directly with raw filesystem APIs or window storage primitives.

```text
┌──────────────────────────────────────────────────────────────────┐
│                           QM EDITOR UI                           │
│           (Tabs, Editor Surface, Command Palette, Dialogs)       │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Triggers Commands
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                         COMMAND SYSTEM                           │
│        (file.new, file.open, file.save, file.saveAs)             │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Invokes Application Actions
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                   DOCUMENT / WORKSPACE SERVICE                   │
│   (Manages open documents, active tab, dirty state & revisions)   │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Requests I/O Operations
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                    FILE SERVICE ABSTRACTION                      │
│ (Handles path normalization, File System Access API, safe writes)│
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Native / Platform Bridge
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                  OPERATING SYSTEM / FILESYSTEM                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. DOCUMENT MODEL vs. FILE RESOURCE MODEL

| Domain Concept | Owner | Purpose & Attributes |
| :--- | :--- | :--- |
| **Document Model** | Document Workspace Service | Represents the active in-memory text buffer, cursor/selection context, edit revision counters (`contentRevision`, `savedRevision`), dirty state, and tab identity. |
| **File Resource** | File Service Abstraction | Represents physical disk storage metadata (`uri`/`path`, `name`, `extension`, `readOnly`, `exists`, `size`, `modifiedTime`, file handle). |

---

## 3. SAFE ATOMIC WRITE & REVISION SNAPSHOT ALGORITHM

To guarantee data integrity and prevent corruption during write operations or asynchronous save race conditions:

1. **Snapshot Stage:** When a Save action begins, the active document's `contentRevision` is captured into `targetRevision = contentRevision`.
2. **Physical Write Stage:** Content is written to physical storage via atomic browser/native write primitives (using file handles or validated atomic temporary swaps).
3. **Verification & Clean State Stage:**
   - **Success:** On confirmed write success, `savedRevision` is set to `targetRevision`.
   - **Dirty State Evaluation:** `isDirty` is calculated as `contentRevision !== savedRevision`. If the user typed new characters while the save operation was in-flight (`contentRevision > targetRevision`), the document automatically remains dirty until another save occurs.
   - **Failure:** On write error, `savedRevision` is NOT updated, the document remains dirty, and unsaved content is fully preserved in memory.

```text
DOCUMENT REVISION N
       │
   START SAVE  ────► Captured targetRevision = N
       │
WRITE TO DISK (Async) ◄── [User Types Edit: contentRevision becomes N+1]
       │
WRITE SUCCESS
       │
  UPDATE savedRevision = N
       │
EVALUATE: contentRevision (N+1) !== savedRevision (N)
       │
RESULT: Document remains DIRTY (Unsaved content N+1 protected!)
```

---

## 4. PATH NORMALIZATION & SECURITY BOUNDARY

1. **Path Normalization:** File paths and URIs are sanitized to use consistent forward slashes, strip redundant parent directory traversals (`..`), and validate URI scheme consistency.
2. **Access Control:** User file selection occurs strictly through explicit native/browser file pickers (`showOpenFilePicker`, `showSaveFilePicker`) or approved service APIs. UI components cannot access arbitrary disk locations.
3. **Directory Guard:** Opening a directory or special device node is safely rejected before attempting document creation.
4. **Large File & Binary Guard:** Files exceeding safe size thresholds (e.g. >10MB) or containing binary null-byte sequences trigger clear warnings/rejections to prevent editor thread locks.

---

## 5. ERROR HANDLING MODEL

File operations map raw I/O failures to structured `QMEditorError` instances:

| Error Code | Category | User Message |
| :--- | :--- | :--- |
| `FILE_NOT_FOUND` | Warning | The requested file could not be found on disk. |
| `PERMISSION_DENIED` | Error | Permission denied while accessing the target file. |
| `INVALID_PATH` | Warning | The specified path is invalid or unreadable. |
| `READ_FAILED` | Error | Failed to read file content. |
| `WRITE_FAILED` | Error | Failed to write file to disk. Unsaved edits preserved. |
| `SAVE_CONFLICT` | Warning | File was modified externally since last read. |
| `FILE_TOO_LARGE` | Warning | File size exceeds safe in-memory editing threshold. |
| `BINARY_NOT_SUPPORTED` | Warning | Binary files cannot be opened as text documents. |

---

## 6. WORKFLOW SEQUENCES

### Open Document Workflow
```text
User → Open Command (Ctrl+O)
  → FileService.showOpenPicker()
  → FileService.readFile(fileHandle/path)
  → Normalization & Duplicate Open Check
      ├─ If already open: Activate existing tab
      └─ If new: Register DocumentModel, attach FileResource, activate tab
```

### Save / Save As Workflow
```text
User → Save Command (Ctrl+S)
  → Check if Document has associated FileResource
      ├─ If Untitled: Route to Save As workflow
      └─ If File-backed:
           1. Snapshot content & contentRevision (N)
           2. FileService.writeFile(handle, content)
           3. On Success: set savedRevision = N, calculate isDirty
           4. On Failure: notify user, preserve dirty state & content
```

---

## 7. TESTING STRATEGY

1. **Unit Tests (`FileService.test.ts`):** Path normalization, mock file reads/writes, error code mapping, directory/binary file guard behavior.
2. **Revision Race Tests (`document.test.ts`):** Verification that edits performed during in-flight save keep `isDirty: true` after write completes.
3. **Workspace Integration Tests (`WorkspaceContext.test.tsx`):** Verification of New, Open, Save, Save As, Close workflows, duplicate open prevention, and dirty close protection.
