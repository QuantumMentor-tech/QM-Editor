# QM Editor — Global Accessibility, Focus Management & Keyboard Architecture

## 1. Overview & Architectural Principles

The QM Editor Accessibility, Focus Management, and Keyboard Navigation architecture provides an application-wide interaction foundation ensuring every essential workflow is operable without exclusive dependence on a mouse or color cues.

Key principles:
- **Centralized Focus Owner**: Focus state transitions are managed deterministically rather than scattered across ad-hoc element queries.
- **Hierarchical Focus Scopes**: Active focus resides in explicit scopes (`application`, `dialog`, `menu`, `contextmenu`, `commandpalette`, `quickopen`, `settings`, `terminal`, `editor`, `explorer`, `problems`).
- **Safe Restoration**: Opening transient overlays (dialogs, menus, palettes) saves previous focus and restores it reliably on exit. If target elements unmount, the focus manager falls back gracefully without throwing or leaving an orphaned focus target.
- **Modal Containment Without Traps**: True modal surfaces (`FocusTrap`) contain keyboard navigation cleanly within the active container, while non-modal surfaces allow normal focus progression.
- **Input Field Protection**: Native browser text entry inside `<input>` and `<textarea>` is strictly preserved. Global editing shortcuts (Select All, Copy, Cut, Paste, Undo, Redo) are not hijacked by code buffer commands.

---

## 2. Core Subsystems

```
                                      +--------------------------+
                                      |     DOM User Input       |
                                      +--------------------------+
                                                   |
                     +-----------------------------+-----------------------------+
                     |                                                           |
           [ShortcutManager]                                               [FocusManager]
     - Input Field Protection (Rule 43)                              - Push/Pop Focus Scope Stack
     - Scope & Category Filtering                                    - Focus Restoration (LIFO)
     - Global vs Component Commands                                  - Modal Focus Trapping
                     |                                               - Region Discovery & Focusing
                     v                                               - ARIA Live Announcements
           [CommandRegistry]                                                     |
                     |                                                           v
                     v                                              [Screen Reader / LiveRegion]
            Active Subsystem                                           - polite: Status & toasts
     (Editor, Explorer, Terminal, etc.)                                - assertive: Alerts & errors
```

### 2.1 FocusManager (`src/core/accessibility/FocusManager.ts`)
The `FocusManager` provides a singleton runtime (`globalFocusManager`) and scoped React Context integration (`useAccessibility()`):
- `pushScope(scope, returnElement?)`: Pushes a scope to the stack and records the currently focused DOM node.
- `popScope()`: Pops the active scope and returns focus to the recorded return element if still mounted.
- `trapFocus(container, options)`: Intercepts Tab, Shift+Tab, and Escape key events to create accessible modal boundaries with wrap-around focus cycling.
- `findFocusableElements(container)`: Identifies all naturally focusable elements (`button`, `a[href]`, `input`, `select`, `textarea`, `[tabindex="0"]`, `[role="tab"]`, `[role="treeitem"]`, etc.) while filtering out disabled or visually hidden nodes.
- `registerRegion(scope, getter)` / `focusRegion(scope)`: Connects global workbench commands (`workbench.action.focusEditor`, `workbench.action.focusExplorer`, `workbench.action.focusTerminal`, etc.) to specific DOM targets.
- `announce(message, mode)`: Posts announcements to centralized ARIA live regions.

### 2.2 Shortcut & Input Field Protection (`src/core/commands/ShortcutManager.ts`)
The `ShortcutManager` enforces Rule 43:
- Inspects `e.target` using `isEditableElement()`.
- If active within an `<input>` (type text, search, password, number, etc.) or `<textarea>`:
  - Native browser keys `Mod+A`, `Mod+C`, `Mod+V`, `Mod+X`, `Mod+Z`, `Mod+Y` are passed directly to the browser for text editing.
  - Commands with category `'editor'` or IDs starting with `editor.` or `document.` are skipped, ensuring editor buffer shortcuts do not interfere with input queries or setting fields.

### 2.3 ARIA Live Region Subsystem (`src/components/accessibility/LiveRegion.tsx`)
QM Editor mounts polite and assertive live regions:
- `polite`: Used for background status changes, file saved notifications, git sync completion, and minor feedback.
- `assertive`: Reserved for critical errors, build failures, and destructive confirmation prompts.

---

## 3. Focus Scopes Reference Table

| Scope | Type | Behavior on Enter | Behavior on Exit |
| :--- | :--- | :--- | :--- |
| `application` | Root | Default base scope | N/A |
| `dialog` | Modal | Traps focus within modal container; initial focus on primary/cancel action | Restores focus to trigger button or active editor |
| `menu` | Transient | Focuses first menu item; arrow keys navigate items | Restores focus to triggering menu bar or header |
| `contextmenu` | Transient | Focuses first menu item; Shift+F10 / context menu key activates | Restores focus to active tree node or editor selection |
| `commandpalette` | Modal | Focuses search input; arrow keys navigate command list | Restores focus to active editor or prior view |
| `quickopen` | Modal | Focuses search query input; arrow keys navigate resource list | Restores focus to active editor or prior view |
| `settings` | Subsystem | Focuses category list or search box | Restores focus to previous workbench surface |
| `terminal` | Subsystem | Focuses terminal input stream | Restores focus via workbench navigation commands |
| `editor` | Subsystem | Focuses active CodeMirror editing surface | Restores focus via workbench navigation commands |
| `explorer` | Subsystem | Focuses active/selected tree node | Restores focus via workbench navigation commands |
| `problems` | Subsystem | Focuses problem list item; Enter jumps to source | Restores focus via workbench navigation commands |

---

## 4. Semantic Controls & Roving Tabindex

Composite widgets implement roving tabindex or accessible ARIA roles:
- **Document Tabs**: Container has `role="tablist"` and `aria-label="Open Document Tabs"`. Each tab has `role="tab"`, `aria-selected`, `aria-label="${title}, ${modified ? 'modified, ' : ''}${active ? 'active document' : 'document'}"`. ArrowLeft / ArrowRight switch active tabs with roving `tabIndex={isActive ? 0 : -1}`.
- **File Explorer Tree**: Container has `role="tree"` and `aria-label="Workspace File Tree"`. Each node has `role="treeitem"`, `aria-expanded` (for folders), `aria-level={depth}`, and `aria-selected`.
- **Secondary Panel Resizer**: Control has `role="separator"`, `aria-orientation="horizontal"`, `aria-label="Resize Bottom Panel"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and supports ArrowUp / ArrowDown keyboard resizing.
- **Problem Diagnostics**: Container has `role="list"` and `aria-label="Diagnostics Problems List"`. Items have `role="listitem"`, full severity naming (`Error: `, `Warning: `, `Info: `), and Enter / Space activation.

---

## 5. Visual Accessibility & Theming

- **Focus Ring Standard**: Outlines use `outline: 2px solid var(--border-focus); outline-offset: 2px;` via `:focus-visible`.
- **High Contrast Support**: `@media (forced-colors: active)` overrides borders and indicators with `CanvasText` and `Highlight`.
- **Reduced Motion Support**: `@media (prefers-reduced-motion: reduce)` disables animations and sets `transition-duration: 0.01ms !important`.

---

## 6. Known Limitations

1. **Terminal ANSI Output Screen Reader Parsing**: Terminal ANSI terminal emulation (PtyAdapter / xterm) renders character grids in virtualized buffers. While terminal container focus, session switching, and action controls are fully keyboard and screen-reader accessible, continuous streaming character updates rely on terminal status announcements rather than reading every character buffer stream.
2. **Virtual Tree Scrolling on Massive Hierarchies**: Virtualized tree nodes not yet in DOM view cannot be directly read by assistive technology until scrolled or expanded into view.
