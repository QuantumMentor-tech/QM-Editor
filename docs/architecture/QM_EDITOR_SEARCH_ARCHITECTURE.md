# QM EDITOR — SEARCH & REPLACE ARCHITECTURE

**Version:** 1.0.0  
**Status:** Approved Active-Document Search & Replace Specification  
**Last Updated:** October 10, 2026  

---

## 1. ARCHITECTURAL OBJECTIVE & LAYER BOUNDARY

QM Editor provides a fast, accessible, and safe **Active-Document Search & Replace** system. Search operates on the active document's in-memory content model and CodeMirror 6 editor view. It does NOT invoke filesystem operations or expose raw editor engine internals directly to UI components.

```text
┌──────────────────────────────────────────────────────────────────┐
│                         SEARCH UI PANEL                          │
│     (Find Input, Replace Input, Option Toggles, Match Count)     │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Interacts with Search Context & Commands
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                     SEARCH SYSTEM CONTROLLER                     │
│    (Manages search query, option toggles, match navigation index)│
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Requests Query Execution & Replacement
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                     SEARCH SERVICE (ENGINE)                      │
│   (Executes plain, case-sensitive, whole-word, & regex search)   │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Triggers Document Edits & Highlights
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                   DOCUMENT SERVICE & ADAPTER                     │
│    (Updates DocumentModel content & dispatches CM6 decorations)  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. SEARCH DOMAIN MODEL

```typescript
export interface SearchQuery {
  text: string;               // Query search string
  caseSensitive: boolean;     // Match case flag
  wholeWord: boolean;         // Match whole word boundary flag
  regex: boolean;             // Regular expression mode flag
}

export interface SearchMatch {
  id: string;                 // Match identifier (`match-${from}-${to}`)
  from: number;               // Starting character offset in document
  to: number;                 // Ending character offset in document
  line: number;               // 1-indexed line number
  column: number;             // 1-indexed column number
  preview: string;            // Matched text snippet
}
```

---

## 3. SEARCH & REPLACEMENT ALGORITHMS

### 1. Query Execution & Regex Protection
- **Plain / Case-Insensitive Search:** Converts search text to lowercase unless `caseSensitive` is `true`.
- **Whole-Word Search:** Enforces word boundary matches using boundary checks (`\b`).
- **Regular Expression Search:** Evaluates regex pattern inside a protected `try/catch` block. If the pattern is syntactically invalid (e.g., `(` or `[`), the error is caught and exposed via `searchError: "Invalid regular expression"` without crashing the editor.

### 2. Atomic Replace All Algorithm
- Matches are collected first.
- Replacements are applied in **reverse character offset order** (`from` descending). This guarantees that modifying text earlier in the buffer does NOT invalidate the offsets of subsequent matches in the loop.
- Replace All is committed as an atomic document update and marks the document dirty if content changed.

---

## 4. READ-ONLY PROTECTION & STATE SAFETY

- Read-only documents permit searching, match counts, highlighting, and navigation (`Find Next`, `Find Previous`).
- `Replace` and `Replace All` controls are disabled on read-only documents.
- Document content modifications trigger dirty state updates and increment `contentRevision`.

---

## 5. ACCESSIBILITY & KEYBOARD NAVIGATION

- **`Ctrl+F` / `Cmd+F`:** Opens Find Panel and focuses search input.
- **`Ctrl+H` / `Cmd+H`:** Opens Find & Replace Panel and focuses replace input.
- **`F3` / `Enter`:** Navigates to Next Match.
- **`Shift+F3` / `Shift+Enter`:** Navigates to Previous Match.
- **`Escape`:** Closes Search Panel and restores editor focus.
