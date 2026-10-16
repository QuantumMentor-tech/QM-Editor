# QM Editor — Workspace Symbol Search UX & Interaction Architecture
**Phase 06, Step 61 of 135 — Advanced Features**

---

## 1. Interaction Surfaces & Commands

Workspace symbol search uses the existing application-level Quick Open / Symbol Modal (`GoToSymbolModal`):

- **Command Palette:** `workbench.action.showAllSymbols` ("Go to Symbol in Workspace...")
- **Global Keybinding:** `Mod+T` (or typing `#` in Quick Open)
- **Document Scope vs Workspace Scope:**
  - `@` or `Mod+Shift+O`: Document Outline / Document Symbols
  - `#` or `Mod+T`: Cross-File Workspace Symbols

Workspace symbol search does NOT replace Quick Open (`Mod+P` for files) or Workspace Text Search (`Mod+Shift+F`).

---

## 2. Query Lifecycle & UX States

1. **Initial / Empty State:**
   - Prompt: "Type to search symbols across workspace..."
   - Unbounded queries are blocked by default to protect language server responsiveness.
2. **Loading State:**
   - Non-blocking indicator displayed while awaiting language server responses.
3. **Empty Results State:**
   - Display: "No symbols matching '{query}'"
   - Clean, friendly message with zero modal flashing.
4. **Result Ranking & Grouping:**
   - Exact query matches appear first.
   - Prefix query matches appear second.
   - Alphabetical order by symbol name, container name, and URI.
5. **Clamping & Performance Safeguards:**
   - Results are capped to `lsp.workspaceSymbols.maxResults` (default: 1,000, absolute max: 5,000).

---

## 3. Result Selection & Navigation Flow

When the user selects a symbol:
1. Modal closes and keyboard focus returns to the active editor.
2. Target `location` routes to `globalNavigationCoordinator.navigateToLocation(loc, { recordHistory: true })`.
3. If the resource is closed, `DocumentEngine` loads and opens it cleanly in a new or existing editor tab.
4. Editor cursor moves to the exact 1-based start line/column and reveals the target range with highlight animation.
5. Navigation history updates, allowing the user to press `Alt+Left` / `Navigate Back` to return to their prior location.
