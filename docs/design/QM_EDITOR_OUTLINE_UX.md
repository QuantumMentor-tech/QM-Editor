# QM Editor — Document Outline UX & Interaction Specification
**Phase 04 — Core Application Engine (Step 41 of 135)**

---

## 1. Overview & Purpose

The **Outline Panel** provides a hierarchical view of the active document's structural symbols (classes, functions, interfaces, methods, properties, headings). It enables rapid code comprehension and instant navigation through the centralized `NavigationCoordinator`.

---

## 2. States & Visual Feedback

The Outline Panel cleanly distinguishes five operational states:

1. **Loading State**:
   - Displays when an asynchronous symbol provider is actively analyzing document structure.
   - Shows an animated spinner with the message: *"Analyzing document symbols..."*.
   - Prevents flashing empty states during fast re-computations.

2. **Active Tree State**:
   - Renders the hierarchical symbol tree with kind-specific SVG icons (`SymbolIcon`).
   - Reflects the active cursor position by highlighting the enclosing symbol in `var(--accent-primary)`.
   - Supports expanding and collapsing nested containers (e.g. classes containing methods).

3. **Filter Active State**:
   - Live text input in the toolbar filters symbols recursively.
   - Preserves parent-child hierarchies if a child matches the search query.

4. **Empty State**:
   - **No Active Document**: When no editor tab is open, prompts the user to open a file.
   - **No Symbols Detected**: When a file contains no recognizable outline elements (e.g. plaintext file or empty script).
   - **No Filter Matches**: Informs the user when the current search query returns 0 matches.

5. **Error State**:
   - Displays an empty state banner if a language provider fails or encounters syntax errors: *"Symbol Analysis Failed"*.

---

## 3. Keyboard Navigation & Accessibility (a11y)

The Outline Panel adheres to WCAG 2.1 AA accessibility guidelines:

- **Semantic Tree Roles**: The container is decorated with `role="tree"` and items with `role="treeitem"`.
- **Keyboard Traversal**:
  - `Enter` / `Space`: Navigates to the selected symbol via `NavigationCoordinator`.
  - `ArrowRight`: Expands a collapsed parent node.
  - `ArrowLeft`: Collapses an expanded parent node.
  - `Tab`: Moves focus through actionable toolbar elements without keyboard traps.
- **Screen Reader Labels**: Items include comprehensive ARIA labels describing the symbol kind, name, and line location (e.g. `aria-label="function: calculateTotal, line 42"`).
- **Reduced Motion**: Respects system preferences for reduced animations.

---

## 4. Navigation Flow

```text
User Click / Enter on Outline Node
               │
               ▼
   handleSymbolClick(sym)
               │
               ▼
   globalNavigationCoordinator.navigateToLocation({
     uri: activeDoc.uri,
     range: sym.range,
     selectionRange: sym.selectionRange
   }, { origin: 'outline' })
               │
               ▼
   Editor Coordinates Revealed & Cursor Positioned
```
