# QM Editor — Unified Settings & Configuration UX Specification
## Phase 03, Step 21 — Unified Settings, Preferences & Configuration System

---

### 1. UX Goals & Interaction Principles

1. **Single Source of Truth**: All configurable options across Appearance, Editor, Terminal, Source Control, Tasks, Files, Search, and Accessibility are organized in one unified settings dialog.
2. **Instant Search & Highlighting**: Developers can find any setting by typing keywords, titles, keys (e.g. `editor.tabSize`), or descriptions with instant ranked filtering.
3. **Transparent Scope Control**: A clear scope switch enables toggling between `User` preferences and `Workspace` overrides.
4. **Safety & Instant Reset**: Every modified setting displays a `Modified` badge and an inline `Reset` button to restore its documented default value.
5. **Portability**: Developers can export configuration to a JSON file or import settings across environments.

---

### 2. Unified Settings Modal Layout

```text
+-----------------------------------------------------------------------------------------+
| [Search Settings...]                                              [ User | Workspace ]  |
+---------------------+-------------------------------------------------------------------+
| [Sliders] All       | Font Size [editor.fontSize] [Modified]                    [Reset] |
| [Palette] Appearance| Controls the font size of the code editor in pixels.              |
| [Code] Editor       | [-] [ 14 ] [+]  (8 - 32)                                          |
| [Terminal] Terminal +-------------------------------------------------------------------+
| [Git] Source Control| Tab Size [editor.tabSize]                                         |
| [Play] Tasks        | The number of spaces equal to a single tab indentation.           |
| [File] Files        | [-] [ 2 ] [+]  (1 - 8)                                            |
| [Search] Search     +-------------------------------------------------------------------+
| [Eye] Accessibility | Word Wrap [editor.wordWrap]                                       |
|                     | Controls how lines should wrap in the editor surface.             |
|                     | [ On (Wrap lines to viewport) v ]                                 |
+---------------------+-------------------------------------------------------------------+
| [Reset Category]  [Export JSON]  [Import JSON]                                   [Done] |
+-----------------------------------------------------------------------------------------+
```

---

### 3. Reusable Control Types

- **Boolean**: Accessible Switch toggle showing `Enabled` / `Disabled`.
- **Number**: Stepper controls (`-` and `+` buttons) with direct numerical input and min/max bound hints.
- **Enum**: Native select dropdown populated with human-readable labels and typed values.
- **String**: Monospace-compatible text inputs with inline validation error banners.

---

### 4. Keyboard Navigation & Accessibility

- `Mod+,` (`Ctrl+,` on Windows/Linux, `Cmd+,` on macOS): Opens the Unified Settings dialog from anywhere in the application.
- `Escape`: Closes the Settings dialog and restores focus to the previously active editor or panel.
- Fully compatible with screen readers with labeled inputs, visible focus rings, and high-contrast color tokens in both dark and light modes.
