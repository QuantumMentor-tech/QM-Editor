# QM Editor — Call Hierarchy UX & Accessibility Specifications

## 1. Visual Hierarchy & Aesthetic Standard
In accordance with QM Editor design principles:
- **Card Modal Layout (`CallHierarchyModal`):**
  - Acrylic backdrop blur with floating shadow (`0 16px 40px rgba(0, 0, 0, 0.55)`).
  - High-contrast responsive styling utilizing `--bg-card`, `--bg-surface`, `--accent`, `--border-color`.
- **Direction Switching:**
  - Segmented toggle between **Incoming Calls (Callers)** and **Outgoing Calls (Callees)**.
  - Direction badges indicate caller vs callee relationship semantics clearly.
- **Tree Row Presentation:**
  - Depth-based indenting (`depth * 18 + 8px`).
  - Canonical `SymbolIcon` mapping (function, method, class, constructor).
  - Identifier label with optional signature detail.
  - Cycle indicator badge: `[Cycle]` with `Repeat` icon.
  - Sub-items for multiple call sites (`Call site #1 at line 12:4`, `Call site #2 at line 48:4`).

## 2. Keyboard Navigation
| Key | Action |
| :--- | :--- |
| **Arrow Down** | Move selection to next visible node row |
| **Arrow Up** | Move selection to previous visible node row |
| **Arrow Right** | Expand selected node |
| **Arrow Left** | Collapse selected node |
| **Enter** | Jump to symbol definition via Navigation Coordinator |
| **Escape** | Dismiss Call Hierarchy modal |

## 3. Screen Reader & Accessibility Compliance
- Outer container tagged with `role="dialog"` and `aria-label="Call Hierarchy"`.
- Tree container marked with `role="tree"`, individual rows marked with `role="treeitem"`.
- `aria-expanded` and `aria-selected` accurately reflect current selection and expansion.
- Clear textual indicators for empty and loading states (`No incoming calls`, `No outgoing calls`, `Loading...`).
