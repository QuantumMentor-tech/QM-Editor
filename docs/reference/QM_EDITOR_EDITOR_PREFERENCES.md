# QM EDITOR — USER PREFERENCES REFERENCE GUIDE

This reference guide documents all user-configurable editor settings available in **QM Editor**, their default values, allowed ranges, keyboard shortcuts, and visual effects.

---

## ⚙️ AVAILABLE EDITOR SETTINGS

| Setting Name | Type / Values | Default | Description | Affects Document Content? |
|---|---|---|---|---|
| `fontSize` | number (`8`–`32` px) | `14` | Sets the editor font size in pixels. | ❌ No |
| `fontFamily` | string | `'Fira Code', ...` | Specifies the monospaced code font stack. | ❌ No |
| `lineNumbers` | boolean (`true` / `false`) | `true` | Toggles the line numbers gutter on the left. | ❌ No |
| `wordWrap` | `'on'` / `'off'` | `'on'` | Wraps long lines to avoid horizontal scrolling. | ❌ No |
| `tabSize` | number (`2`, `4`, `8`) | `2` | Number of spaces per tab stop or indentation level. | ❌ No |
| `insertSpaces` | boolean (`true` / `false`) | `true` | Inserts space characters instead of hard tab characters. | ❌ No |
| `bracketMatching` | boolean (`true` / `false`) | `true` | Highlights matching delimiter pairs `()`, `[]`, `{}`. | ❌ No |
| `autoClosingBrackets` | boolean (`true` / `false`) | `true` | Automatically inserts matching brackets/quotes when typing. | ❌ No |
| `highlightActiveLine` | boolean (`true` / `false`) | `true` | Highlights the current cursor line and line number gutter. | ❌ No |
| `whitespace` | `'none'` / `'all'` / `'trailing'` | `'none'` | Controls rendering of whitespace symbols. | ❌ No |
| `folding` | boolean (`true` / `false`) | `true` | Toggles code folding gutter markers for block regions. | ❌ No |

---

## ⌨️ KEYBOARD SHORTCUTS FOR EDITOR PREFERENCES

| Action | Shortcut (Windows/Linux) | Shortcut (macOS) | Command ID |
|---|---|---|---|
| Zoom In (Increase Font Size) | `Ctrl` + `=` | `Cmd` + `=` | `editor.zoomIn` |
| Zoom Out (Decrease Font Size) | `Ctrl` + `-` | `Cmd` + `-` | `editor.zoomOut` |
| Reset Zoom | `Ctrl` + `0` | `Cmd` + `0` | `editor.zoomReset` |
| Toggle Word Wrap | `Alt` + `Z` | `Option` + `Z` | `editor.toggleWordWrap` |
| Open Preferences Modal | `Ctrl` + `,` | `Cmd` + `,` | `workbench.action.openSettings` |

---

## 🔒 ZERO-DIRTY STATE GUARANTEE

All settings listed above govern **editor view presentation only**. Changing any preference dynamically reconfigures the editor surface immediately without altering document content or triggering an unsaved (`isDirty`) state.
