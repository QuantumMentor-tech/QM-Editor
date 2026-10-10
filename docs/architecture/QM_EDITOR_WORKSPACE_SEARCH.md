# QM Editor — Workspace Search Architecture

## 1. Overview
The Workspace Search subsystem enables fast content searching across multiple files within the authorized QM Editor workspace scope (`Ctrl+Shift+F`). It operates asynchronously without blocking the UI thread and cleanly separates active-document search from multi-file workspace content searching.

```text
WORKSPACE RESOURCE INDEX
       ↓
GLOB PATTERN FILTERING (Include / Exclude)
       ↓
BINARY & FILE SIZE SAFETY GAURDS (Max 5MB, Binary / NUL byte skip)
       ↓
ASYNC BATCH CONTENT READ (Bounded Concurrency = 5-10)
       ↓
SEARCH ENGINE (Regex, Whole Word, Case Sensitive)
       ↓
GROUPED FILE SEARCH RESULTS (Line previews & 1-indexed coordinates)
       ↓
DOCUMENT NAVIGATION (Jump to match line/col in editor surface)
```

## 2. Core Safety & Performance Principles
1. **Metadata & Content Scanning Separation:** Quick Open searches filename metadata only. Workspace Search scans file text contents asynchronously.
2. **Race Protection & Cancellation:** Searches use incrementing `searchId` tokens. Launching a new query or closing/switching workspaces immediately cancels in-flight batch reads and rejects stale responses.
3. **Binary & File Size Guards:** Files with binary extensions (`.png`, `.exe`, `.zip`, etc.) or containing NUL bytes in the first 1KB are skipped automatically. Files exceeding 5MB are skipped with a clear diagnostic message.
4. **No Remote or External Execution:** Queries operate 100% locally. Zero file content is transmitted to external AI endpoints or analytics.

## 3. Include / Exclude Pattern Semantics
- Glob wildcards: `*` (matches within single path segment), `**` (matches across directories), `?` (single char).
- Default excluded folders: `node_modules/**`, `.git/**`, `dist/**`, `.cache/**`.
- User include filter: e.g. `*.ts, *.tsx, src/**`.

## 4. Navigation & Explorer Integration
- Clicking a match line inside the Workspace Search results panel executes `openFilePath(uri)`, activates the document tab, navigates the cursor to the exact line/column, and reveals the file in the File Explorer tree.
