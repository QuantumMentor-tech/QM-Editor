# QM Editor — Contextual Language Intelligence UX & Presentation Design

## Phase 04 — Core Application Engine | Step 43

---

## 1. Design Vision & Philosophy

Contextual Language Intelligence in QM Editor encompasses **Hover Information** and **Signature Help**.
The user experience must feel instantaneous, unobtrusive, visually refined, and rock-solid:

- **Zero Flickering:** Debounced mouse interactions and monotonic generation guards prevent jittery popup transitions.
- **Never Trap Focus:** Hover cards and parameter hints are lightweight informational overlays. Normal keyboard navigation and document typing are never interrupted.
- **Visual Hierarchy & Premium Typography:** Overlays use curated theme variables (`--bg-primary`, `--border-color`, `--text-primary`), high-contrast accent highlights, and clean typography.
- **Safe Rendering:** Rich markdown descriptions, code snippets, and parameter details render cleanly without security compromises.

---

## 2. Hover Information UX

### 2.1 Interaction Triggers
1. **Mouse Hover:** When the mouse hovers steadily over a symbol for 300ms, the hover pipeline executes. Minor pixel shifts within the symbol bounding box do not re-query or flicker.
2. **Keyboard Shortcut (`Mod+I`):** Manual hover trigger inspects the symbol at the current cursor position.
3. **Dismissal:** Mouse movement away from the hover range, typing any character, scrolling, or pressing `Escape` immediately closes the card.

### 2.2 Visual Anatomy of Hover Widget
```
+-------------------------------------------------------------------+
|  [Provider Badge: e.g. "TypeScript"]             [Go to Def ->]   |
|-------------------------------------------------------------------|
|  function calculateDistance(x1: number, y1: number): number       |
|                                                                   |
|  Calculates the Euclidean distance between two points in 2D space |
|                                                                   |
|  * `x1` - X coordinate of starting point                          |
|  * `y1` - Y coordinate of starting point                          |
+-------------------------------------------------------------------+
```
- **Code Block:** Highlighted in monospaced code styling with subtle background tint.
- **Documentation:** Formatted with bold, italic, lists, and safe external links (`target="_blank"`).
- **Navigation Action:** If the symbol provides a definition location, a "Go to Definition" button allows immediate one-click navigation via `NavigationCoordinator`.

---

## 3. Signature Help & Parameter Hints UX

### 3.1 Interaction Triggers
1. **Typing `(`:** When the user types an opening parenthesis following an identifier, parameter hints activate automatically.
2. **Typing `,`:** Advances active parameter highlighting to the next argument.
3. **Manual Shortcut (`Mod+Shift+Space`):** Re-opens parameter hints at the current cursor position.
4. **Dismissal:** Typing `)` or `;`, clicking elsewhere, or pressing `Escape` cleanly closes the widget.

### 3.2 Visual Anatomy of Signature Help Widget
```
+-------------------------------------------------------------------+
|  ( 1 of 3 ) [^] [v]                                               |
|  calculateDistance(x1: number, y1: number, options?: DistanceOpts) |
|                    ^^^^^^^^^^                                     |
|  x1: X coordinate of starting point                               |
+-------------------------------------------------------------------+
```
- **Overload Pagination:** Clearly displays `(1 of N)` with up/down cycling buttons.
- **Active Parameter Highlight:** The currently active parameter is bolded and highlighted with an accent color background.
- **Contextual Parameter Docs:** Shows specific documentation for the parameter currently being typed.

---

## 4. Accessibility & Theming

- **Theme Consistency:** Seamless support for all active themes (Dark, Light, High Contrast).
- **ARIA Standards:** Floating overlays carry `role="tooltip"`, `aria-live="polite"`, and `aria-describedby` associations.
- **No Focus Stealing:** Focus strictly remains inside the CodeMirror text editor.
- **Safe Contrast Ratios:** All text, badges, and highlighted parameters meet WCAG AA standards (> 4.5:1 contrast).
