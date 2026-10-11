# QM Editor — Accessibility & Interaction UX Design Specification

## 1. Interaction Philosophy

QM Editor is designed keyboard-first. Every user interface element must communicate state, purpose, and keyboard operability without relying on mouse pointers, visual hover, or color alone.

---

## 2. Visual States & Non-Color Redundancy

Color must never be the sole conveyor of information (Rule 8):

| Subsystem / Control | Visual State | Non-Color Indicator | Accessible Label Pattern |
| :--- | :--- | :--- | :--- |
| **Git File Status** | Modified (`M`) | Letter badge `M` + text tag | `[filename], modified` |
| **Git File Status** | Untracked (`U`) | Letter badge `U` + text tag | `[filename], untracked` |
| **Git File Status** | Deleted (`D`) | Strikethrough + letter badge `D` | `[filename], deleted` |
| **Problem Diagnostic** | Error | Octagonal `x` icon + prefix `Error:` | `Error: [message], line [L], col [C]` |
| **Problem Diagnostic** | Warning | Triangular `!` icon + prefix `Warning:` | `Warning: [message], line [L], col [C]` |
| **Problem Diagnostic** | Information | Circular `i` icon + prefix `Info:` | `Info: [message], line [L], col [C]` |
| **Document Tab** | Dirty / Modified | Dot badge `*` + text indicator | `[filename], modified, active document` |
| **Focus Indicator** | Focused | High-contrast 2px focus ring with 2px offset | Exposed via native `:focus-visible` |
| **Selection** | Selected | Background highlight + outline border | `aria-selected="true"` |
| **Task Status** | Running / Failed | Spinner / cross icon + text label | `Build failed`, `Running tests` |

---

## 3. Keyboard Navigation Model

### 3.1 Global Focus Region Navigation
Users can jump between major workspace regions using keyboard commands:
- **Focus File Explorer**: `Mod+Shift+E` (`workbench.action.focusExplorer`)
- **Focus Editor**: `Mod+1` (`workbench.action.focusEditor`)
- **Focus Terminal**: `Mod+\`` (`workbench.action.focusTerminal`)
- **Focus Problems**: `Mod+Shift+M` (`workbench.action.focusProblems`)
- **Focus Settings**: `Mod+,` (`workbench.action.focusSettings` / `workbench.action.openSettings`)
- **Command Palette**: `Mod+Shift+P`
- **Quick Open**: `Mod+P`

### 3.2 Component-Local Navigation
- **Menus & Menubars**:
  - `Left` / `Right`: Navigate top-level menu categories.
  - `Up` / `Down`: Navigate menu items.
  - `Enter` / `Space`: Activate menu item.
  - `Escape`: Close menu and restore focus to triggering menubar button.
- **Document Tabs**:
  - `Left` / `Right`: Switch between document tabs using roving tabindex.
  - `Mod+W`: Close active document tab.
  - Tab close button is keyboard-focusable with `aria-label="Close [tab title]"`.
- **File Explorer Tree**:
  - `Up` / `Down`: Navigate items in tree order.
  - `Right`: Expand folder if collapsed; move to first child if expanded.
  - `Left`: Collapse folder if expanded; move to parent if collapsed.
  - `Enter`: Open selected file into editor.
  - `Shift+F10` / `ContextMenu`: Open context menu anchored to focused item.
- **Secondary Panel Resizer**:
  - `Up` / `Down`: Incrementally adjust panel height by 20px.
  - `Home` / `End`: Jump to minimum / maximum supported panel heights.
- **Modal Dialogs & Focus Traps**:
  - `Tab` / `Shift+Tab`: Cycle exclusively through focusable elements inside dialog.
  - `Escape`: Cancel dialog and safely restore focus to original trigger.

---

## 4. Typography & Scaling Guidelines

- Scalable font units (`rem` / `px` tokens) ensure text scales gracefully up to 200% zoom without clipping or overlapping.
- Line heights maintain a minimum ratio of 1.4 for body content and 1.5 for code text.
- Icon buttons include visible tooltip labels on hover and persistent `aria-label` attributes for screen readers.

---

## 5. Screen Reader Announcements Reference

Centralized live region announcements (`LiveRegion.tsx`):
- Polite announcements:
  - `"File saved: [filename]"`
  - `"Workspace refreshed: [N] files indexed"`
  - `"Git repository status refreshed"`
- Assertive announcements:
  - `"Error: Unable to save file: [reason]"`
  - `"Task [Task Name] failed with exit code [Code]"`
  - `"Destructive action requires confirmation"`
