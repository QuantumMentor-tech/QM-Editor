# QM Editor — LSP Problems & Editor Markers Integration

**Phase 06 — Advanced Features**  
**Step 57 of 135: LSP Diagnostics Integration, Problems Synchronization & Diagnostic Lifecycle**

---

## 1. Downstream Integration Architecture

LSP diagnostics integrate seamlessly into existing UI surfaces without introducing a single line of LSP-specific rendering logic to the UI components:

```
                  DiagnosticService
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
   ProblemsPanel                     EditorSurface
(src/components/problems/)        (src/components/editor/)
         │                                 │
         ▼                                 ▼
- Tree by File/Severity           - CodeMirror Linter Extension
- Summary Badge Counts            - Underline Wave Markers
- Filter by Severity              - Gutter Lint Icons
- Click -> NavigationCoordinator  - Diagnostic Hover Tooltips
```

---

## 2. Problems Panel Integration (`ProblemsPanel.tsx`)

The Problems panel queries `globalDiagnosticService.getDiagnostics()` and listens to `globalDiagnosticService.subscribe(...)`:
- **Unified Listing:** LSP diagnostics appear alongside Task Runner diagnostics and built-in syntax errors in a single, coherent tree.
- **Attribution Display:** The `source` column clearly identifies the source (e.g. `typescript`, `eslint`, `pyright`, or `tasks`), allowing users to discern the producer of every warning or error.
- **Badge & Summary Counts:** Error and warning counts update instantly across the Status Bar and Problems tab header via `DiagnosticService.getSummary()`.
- **Keyboard & Click Navigation:** Selecting any diagnostic triggers `NavigationCoordinator.navigateToLocation()`.

---

## 3. Editor Markers & CodeMirror Coordination (`EditorSurface.tsx`)

`EditorSurface` integrates diagnostics using CodeMirror 6's `@codemirror/lint` framework:
- **Decoration Generation:** Canonical diagnostic ranges (converted to 0-based document offsets) produce standard CodeMirror diagnostic markers.
- **Severity Styling:**
  - `error`: Red wavy underline & error gutter icon.
  - `warning`: Amber wavy underline & warning gutter icon.
  - `info`: Blue underline.
  - `hint`: Dotted subtle underline.
- **Hover Diagnostics:** Hovering over marked text displays the diagnostic message, source, code, and documentation link without executing arbitrary scripts.

---

## 4. Diagnostic Navigation & Stale Protection

When a diagnostic is clicked in the Problems panel or marker tooltip:
1. `NavigationCoordinator` validates the file URI and opens the target document through `DocumentEngine.openResource()`.
2. The target range (`startLine`, `startColumn`, `endLine`, `endColumn`) is clamped against the document's actual line count and line lengths (`validateAndNormalizeRange()`).
3. If code was edited and lines moved after the diagnostic was published, clamping prevents index out-of-bounds errors or editor crashes, revealing the nearest valid line safely.
