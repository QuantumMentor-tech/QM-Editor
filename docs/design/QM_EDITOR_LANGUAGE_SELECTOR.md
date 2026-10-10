# QM EDITOR — LANGUAGE SELECTOR UI/UX SPECIFICATION

**Version:** 1.0.0  
**Status:** Approved Language Selector UI & Design Tokens  
**Last Updated:** October 10, 2026  

---

## 1. VISUAL LAYOUT & DESIGN TOKENS

The Language Selector Modal is rendered as a clean, accessible palette overlay centered at the top of the shell when triggered via Status Bar click or Command Palette (`language.select`).

- **Background:** `var(--bg-card)` with `backdrop-filter: blur(8px)`.
- **Border:** `1px solid var(--border-color)` with `var(--radius-md)`.
- **Shadow:** `0 8px 24px rgba(0, 0, 0, 0.35)`.
- **Z-Index:** `200` (floats above workspace shell and search panels).

```text
┌────────────────────────────────────────────────────────────────────────┐
│ [ Search language mode... (e.g. Python, TypeScript) ]                 │
├────────────────────────────────────────────────────────────────────────┤
│  ✓ Plain Text                                              .txt, .text │
│    TypeScript                                                .ts, .tsx │
│    JavaScript                                                .js, .jsx │
│    Python                                                    .py, .pyw │
│    JSON                                                   .json, .jsonc│
│    HTML                                                    .html, .htm │
│    CSS                                                            .css │
│    Markdown                                                .md, .markdown│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. INTERACTION & ACCESSIBILITY

- **Status Bar Trigger:** Clicking the active language badge (e.g., `Plaintext`, `TypeScript`) in the Status Bar triggers `language.select`.
- **Search Filtering:** Live text filtering matches language display names, internal IDs, aliases, and extensions.
- **Keyboard Navigation:**
  - `ArrowDown` / `ArrowUp`: Navigates language options list.
  - `Enter`: Selects highlighted language and updates active document syntax mode.
  - `Escape`: Closes modal and restores editor focus.
