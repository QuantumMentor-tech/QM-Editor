# QM EDITOR — EDITOR SETTINGS & PREFERENCE ARCHITECTURE

**Specification Version:** 1.0.0  
**Phase:** 01 — Discovery, Architecture & Scaffolding  
**Step:** Step 13 — Professional Editor Behavior, Editing Preferences & Productivity Foundation  
**Authors:** QM Editor Engineering Team  

---

## 1. EXECUTIVE OVERVIEW

This document specifies the architectural design, preference model ownership, validation strategy, and CodeMirror 6 engine integration for **Editor Settings and Presentation Preferences** in QM Editor.

The central design principle governing editor settings is the strict separation between **presentation state** and **document model state**:

```
QM Editor User Preference
        ↓
PreferencesService (Validation & Normalization)
        ↓
ShellContext (React State Flow)
        ↓
EditorAdapter (CodeMirror 6 Reconfigurable Compartments)
        ↓
CodeMirror 6 View State
```

---

## 2. SETTINGS MODEL & TYPES

Editor settings are defined by the `EditorSettings` interface in [`src/types/index.ts`](file:///d:/App%20Winrar%20Files/QM%20Editor%20%28working%29/src/types/index.ts):

```typescript
export type WordWrapMode = 'off' | 'on';
export type WhitespaceMode = 'none' | 'all' | 'trailing';

export interface EditorSettings {
  fontSize: number;             // Allowed range: 8 to 32px (default: 14)
  fontFamily: string;           // CSS font-family string
  lineNumbers: boolean;         // Show/hide line numbers gutter
  wordWrap: WordWrapMode;       // 'on' (wrap long lines) | 'off' (horizontal scroll)
  tabSize: number;              // Tab width (2, 4, 8)
  insertSpaces: boolean;        // true = spaces, false = tab characters
  bracketMatching: boolean;     // Highlight matching delimiter pairs
  autoClosingBrackets: boolean; // Auto-close brackets/quotes and handle text wrapping
  highlightActiveLine: boolean; // Highlight active line and line number gutter
  whitespace: WhitespaceMode;   // 'none' | 'all' | 'trailing'
  folding: boolean;             // Show/hide code folding gutter
  minimap: boolean;             // Minimap toggle (reserved presentation toggle)
}
```

---

## 3. PREFERENCE OWNERSHIP & DOMAIN SEPARATION

To prevent conflicting configuration states, QM Editor enforces single-ownership for preferences:

- **App-level Preferences:** Owned by `PreferencesService` and stored in `localStorage` (`qm_editor_user_preferences_v1`).
- **Editor Presentation Settings:** Nested under `UserPreferences.editor`.
- **Document Model:** Completely decoupled from presentation settings. Changing font size, word wrap, tab size, line numbers, or folding **NEVER** marks a document dirty (`isDirty = false`) and **NEVER** modifies file contents.

---

## 4. VALIDATION & SANITIZATION

All loaded settings are treated as untrusted data and validated by `PreferencesService.validateEditorSettings`:

1. **Font Size:** Clamped to range `[8, 32]`, rounded to nearest integer (default: 14).
2. **Font Family:** Sanitized non-empty string fallback to `'Fira Code', 'Cascadia Code', Consolas, monospace`.
3. **Tab Size:** Clamped to `[1, 16]`, rounded (default: 2).
4. **Booleans & Enums:** Strict type checking with automatic fallback to safe defaults.

---

## 5. ENGINE INTEGRATION VIA RECONFIGURABLE COMPARTMENTS

`CodeMirrorEditorAdapter` ([`src/components/editor/EditorAdapter.ts`](file:///d:/App%20Winrar%20Files/QM%20Editor%20%28working%29/src/components/editor/EditorAdapter.ts)) wraps all editor engine configuration inside CodeMirror 6 `Compartment` instances:

- `fontSizeCompartment`
- `fontFamilyCompartment`
- `lineNumbersCompartment`
- `highlightActiveLineCompartment`
- `wordWrapCompartment`
- `tabSizeCompartment`
- `bracketMatchingCompartment`
- `autoClosingCompartment`
- `whitespaceCompartment`
- `foldingCompartment`

When settings update in `ShellContext`, `EditorSurface` calls `adapter.setSettings(newSettings)`. The adapter dispatches state effects reconfiguring only the affected compartments without re-mounting the editor view or dispatching document content changes.

---

## 6. ACCESSIBILITY & PERFORMANCE

- **Accessibility:** All settings controls include accessible labels, keyboard focus states, and native HTML semantics (`<input type="checkbox">`, `<select>`, button controls).
- **Performance:** Setting updates execute atomically in `< 5ms` without recreating application layout or re-reading files from disk.
