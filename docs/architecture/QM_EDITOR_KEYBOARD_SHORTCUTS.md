# QM EDITOR — KEYBOARD SHORTCUTS SPECIFICATION

**Version:** 1.0.0  
**Status:** Approved Shortcut Mappings  
**Last Updated:** October 10, 2026  

---

## 1. PLATFORM SHORTCUT CONVENTIONS

QM Editor uses `Mod` as the primary platform modifier key:
- **Windows / Linux:** `Mod` resolves to `Ctrl`.
- **macOS:** `Mod` resolves to `Cmd` (`⌘`).

---

## 2. OFFICIAL SHORTCUT MAPPINGS

| Command ID | Action Title | Shortcut | Scope |
|---|---|---|---|
| `document.save` | Save Active Document | `Mod+S` | Workspace |
| `document.new` | New Document | `Mod+N` | Workspace |
| `document.close` | Close Active Document | `Mod+W` | Workspace |
| `shell.toggleSidebar` | Toggle Sidebar Explorer | `Mod+B` | Shell |
| `shell.togglePanel` | Toggle Console Panel | `Mod+J` | Shell |
| `shell.toggleTheme` | Toggle Dark / Light Theme | `Mod+Shift+T` | Shell |

---

## 3. SHORTCUT RESOLUTION RULES

1. **Focus Scoping:** Shortcuts evaluate the active focus scope (`global`, `editor`, `shell`).
2. **Editor Native Shortcuts:** Editing actions inside the editor surface (e.g. `Ctrl+Z` undo, `Ctrl+C` copy) are handled natively by CodeMirror 6's history and keymap extensions to maintain optimal typing latency.
