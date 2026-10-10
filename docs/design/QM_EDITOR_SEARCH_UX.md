# QM EDITOR — SEARCH & REPLACE UI/UX SPECIFICATION

**Version:** 1.0.0  
**Status:** Approved Search Interface & Design Tokens  
**Last Updated:** October 10, 2026  

---

## 1. VISUAL LAYOUT & DESIGN TOKENS

The Search & Replace Panel is rendered as a sleek, non-intrusive floating overlay anchored at the top-right of the active editing surface.

- **Background:** `var(--bg-card)` with `backdrop-filter: blur(8px)`.
- **Border:** `1px solid var(--border-color)` with `var(--radius-md)`.
- **Box Shadow:** `0 8px 24px rgba(0, 0, 0, 0.25)`.
- **Z-Index:** `100` (floats above line numbers and editor view).

```text
┌────────────────────────────────────────────────────────────────────────┐
│ [Find...] (1 of 8) [Aa] [\b] [.*]  [▲] [▼] [X]                        │
│ [Replace...]                       [Replace] [Replace All]             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. INTERACTIVE CONTROLS & HIGHLIGHTING

| Control | Icon / Label | Shortcut | Behavior |
| :--- | :--- | :--- | :--- |
| **Search Input** | Text placeholder | `Ctrl+F` | Updates match query live. |
| **Match Count Badge** | `1 of N` / `No results` | N/A | Displays active match index and total results. |
| **Case Sensitive** | `Aa` | Toggle | Toggles case-sensitive matching. |
| **Whole Word** | `\b` | Toggle | Toggles word boundary matching. |
| **Regex Mode** | `.*` | Toggle | Toggles regular expression search. |
| **Find Next** | `ChevronDown` / `Enter` | `F3` | Focuses and scrolls to next match. |
| **Find Previous** | `ChevronUp` / `Shift+Enter` | `Shift+F3` | Focuses and scrolls to previous match. |
| **Replace** | Button | Click | Replaces active match and advances to next. |
| **Replace All** | Button | Click | Atomically replaces all matches in active doc. |
| **Close** | `X` | `Escape` | Closes search panel and restores editor focus. |

---

## 3. MATCH DECORATIONS IN EDITOR

- **All Matches (`cm-search-match`):** Subtle yellow/amber background tint (`rgba(234, 179, 8, 0.35)`).
- **Current Match (`cm-search-match-current`):** Strong blue highlight (`rgba(59, 130, 246, 0.6)`) with bold white text.
