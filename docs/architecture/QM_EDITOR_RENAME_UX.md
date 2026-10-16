# QM Editor Rename UX
**Phase 06 | Step 62**

- **Command:** the user-facing action is "Rename Symbol" (F2, editor context menu, Command Palette). The LSP provider is an implementation detail; there is no "LSP Rename" command.
- **Input:** `RenameModal` (existing modal primitives) pre-fills the `prepareRename` placeholder, selects it, confirms on Enter, cancels on Escape, and shows inline validation (empty, whitespace-only, control characters, multi-line, unchanged name). Language-specific identifier rules are left to the server.
- **No live edits:** the document is untouched while the user types.
- **Unavailable / not renameable:** quiet feedback via the Feedback Service; no empty dialog, no protocol errors.
- **Preview / confirmation:** a structured summary lists affected files and edit counts, plus conflicts and warnings, before multi-file changes apply. All server-provided strings are rendered as escaped text.
- **Conflicts:** stale state, dirty-document conflicts, read-only targets and unsupported operations abort with a message naming the cause; nothing is changed.
- **Progress & cancellation:** stages (preparing, validating, previewing, applying) without fake percentages; cancel is available until apply begins.
- **Accessibility:** labelled input, keyboard-only operation, focus restored to the editor on close, validation messages announced.
- **Undo:** one Undo restores previous names; Redo reapplies.
