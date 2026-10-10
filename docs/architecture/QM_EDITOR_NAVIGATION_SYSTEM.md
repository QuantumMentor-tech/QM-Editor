# QM EDITOR — ADVANCED NAVIGATION & LOCATION HISTORY ARCHITECTURE

**Specification Version:** 1.0.0  
**Phase:** 01 — Discovery, Architecture & Scaffolding  
**Step:** Step 14 — Advanced Editor Navigation, Location History & Session Continuity Foundation  
**Authors:** QM Editor Engineering Team  

---

## 1. EXECUTIVE OVERVIEW

This document specifies the architectural design, location model, back/forward history stacks, and Go-to-Line navigation subsystem in QM Editor.

The core architectural principle enforces strict domain separation:

```text
DOCUMENT CONTENT (Text Buffer)
        ≠
EDITOR LOCATION ({ documentId, filePath, line, column })
        ≠
NAVIGATION HISTORY (BackStack / ForwardStack)
        ≠
RECENT DOCUMENTS METADATA
        ≠
APPLICATION SESSION METADATA
```

---

## 2. LOCATION MODEL (`src/types/index.ts`)

Every editor position is represented by a lightweight `EditorLocation` snapshot:

```typescript
export interface EditorLocation {
  documentId: string;       // Unique document model ID
  filePath?: string;        // Optional physical resource path
  documentTitle?: string;   // Human-readable title for UI tooltips
  line: number;             // 1-indexed line number
  column: number;           // 1-indexed column number
  timestamp?: number;       // Timestamp of navigation event
}
```

---

## 3. NAVIGATION HISTORY ENGINE (`src/services/NavigationService.ts`)

`NavigationService` manages two bounded stacks (`backStack` and `forwardStack` capped at a maximum of 50 entries):

1. **Jitter Deduplication:** Minor line movements (delta < 5 lines) within the same document update the current location pointer without flooding `backStack`.
2. **Branching Behavior:** Pushing a new location onto `backStack` clears `forwardStack` to preserve predictable linear history navigation.
3. **Stale Entry Cleanup:** When a tab/document closes, invalid history entries referencing the closed document ID are pruned safely.

---

## 4. GO TO LINE / COLUMN MODAL (`src/components/navigation/GoToLineModal.tsx`)

- Activated via command `navigation.goToLine` (`Ctrl+G` / `Cmd+G`) or clicking the status bar `Ln X, Col Y` indicator.
- Accepts inputs in `Line` or `Line:Column` format (e.g., `120` or `120:15`).
- Validates input bounds against active document total line count and clamps safely without throwing exceptions or corrupting text.
- Re-reveals line and moves cursor atomically via CodeMirror `goToLine(line, column)`.

---

## 5. UI CONTROLS & SHORTCUTS

- **Header Navbar Controls:** Back (`ChevronLeft`), Forward (`ChevronRight`), and Recent Files (`Clock`) buttons with aria-labels and disabled states.
- **Shortcuts:**
  - `Ctrl+G` / `Cmd+G` ➔ Go to Line
  - `Alt+Left` ➔ Navigate Back
  - `Alt+Right` ➔ Navigate Forward
  - `Ctrl+Shift+R` / `Cmd+Shift+R` ➔ Open Recent Files
