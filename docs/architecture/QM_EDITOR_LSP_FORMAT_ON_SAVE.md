# QM Editor — LSP Format on Save Architecture (Step 63)

## 1. Overview

Format on Save automatically executes document formatting whenever a user initiates a file save (via `Mod+S`, Save All, or workbench commands). In QM Editor, format on save is governed strictly by user settings, cancellation timeouts, and document consistency barriers.

---

## 2. Configuration Settings

The following settings in `SettingsRegistry.ts` control format on save:

| Setting Key | Default | Description |
|---|---|---|
| `editor.formatOnSave` | `false` | When true, automatically formats the document before saving |
| `editor.formatOnSaveTimeout` | `2500` (ms) | Maximum wait duration before aborting format on save and continuing to save |
| `editor.formatOnSaveMode` | `'file'` | Formatting scope: `'file'` (entire document) or `'modifications'` |
| `lsp.formatting.enabled` | `true` | Master switch for LSP formatting capabilities |

---

## 3. Execution Pipeline & Save Lifecycle

```mermaid
sequenceDiagram
    participant User as User (Ctrl+S)
    participant Cmd as Workbench Save Command
    participant Coord as LspFormattingCoordinator
    participant DocEngine as DocumentEngine
    participant Disk as FileSystem / Storage

    User->>Cmd: Save Document
    Cmd->>Coord: formatOnSave(docId)
    alt formatOnSave enabled
        Coord->>Coord: Create CancellationToken with formatOnSaveTimeout
        Coord->>DocEngine: Format Document via applyTransaction()
        alt Formatting succeeds within timeout
            DocEngine-->>Coord: Transaction Applied (Content updated)
            Coord-->>Cmd: Success
        else Timeout or Server Error
            Coord-->>Cmd: Aborted / Skipped (Save continues)
        end
    end
    Cmd->>Disk: Persist clean document content to disk
    Cmd->>DocEngine: Mark document as clean (isDirty: false)
```

---

## 4. Timeout & Fallback Safeguards

1. **Short Timeout**: The default format-on-save timeout is clamped (between 250ms and 10,000ms, default 2500ms).
2. **Non-Blocking Persistence**: If a language server hangs, crashes, or exceeds the timeout, the save command logs a warning and proceeds with persisting the user's unformatted document. Save operations are **never blocked or prevented** by server latency.
3. **No Save Recurse**: The formatting transaction applied during format-on-save is marked with origin `'lsp.formatting'`, preventing secondary save triggers or infinite loops.
