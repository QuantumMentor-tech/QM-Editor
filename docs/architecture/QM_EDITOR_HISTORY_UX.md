# QM Editor — Local History UX & Command Integration

## 1. User Interface: `LocalHistoryModal`

The Local History UI (`src/components/history/LocalHistoryModal.tsx`) provides an accessible, non-destructive interface for inspecting and restoring earlier versions:

### Split-Pane Layout
- **Left Pane (Chronological List)**:
  - Displays historical checkpoints ordered from newest to oldest.
  - Visual source badges: `Save`, `Manual Checkpoint`, `Pre-Restore Safety`, `External Sync`.
  - Timestamp display with relative time and full date tooltips.
  - Snapshot size and document revision indicators.
  - Per-entry delete action and document-level clear history action.
- **Right Pane (Preview & Differences)**:
  - Header showing selected version details, label, and creation time.
  - Comparison status: indicates whether historical version is identical or differs from active live content.
  - Monospace read-only diff/content inspection preview area.
  - Restore action bar with primary **Restore Version** button.

---

## 2. Command Palette & Keyboard Shortcuts

| Command ID | Title | Shortcut | Context Requirement |
| :--- | :--- | :--- | :--- |
| `history.open` | Local History: Open Document History | `Ctrl+Alt+H` / `Cmd+Alt+H` | Active open document |
| `history.createSnapshot` | Local History: Create Manual Checkpoint | — | Active writable document |
| `history.clearDocument` | Local History: Clear History for File | — | Active document with history |

---

## 3. Safe Restoration Semantics & Feedback

1. **User Action Required**: Selecting an entry in the list merely loads the preview; it never alters document content.
2. **Pre-Restore Snapshot**: Restoring automatically creates a `preRestore` snapshot of the live content, ensuring any accidental restore can immediately be reverted.
3. **In-Memory Mutation Only**: Restore executes through `DocumentEngine.applyTransaction()`, marking the document dirty (`isDirty = true`) and populating the native editor Undo stack. Physical disk contents remain untouched until the user issues an explicit Save command (`Ctrl+S`).
4. **Feedback Notifications**: Success confirmations and error alerts are dispatched through the centralized `FeedbackService`.
