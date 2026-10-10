# QM EDITOR — LANGUAGE SYSTEM & SYNTAX HIGHLIGHTING ARCHITECTURE

**Version:** 1.0.0  
**Status:** Approved Language Subsystem Specification  
**Last Updated:** October 10, 2026  

---

## 1. ARCHITECTURAL OBJECTIVE & SEPARATION OF CONCERNS

QM Editor owns the definition and resolution of **document languages**, keeping language identity distinct from physical file paths, file extensions, and third-party editor engine internals.

```text
┌──────────────────────────────────────────────────────────────────┐
│                   PHYSICAL FILE / USER INPUT                     │
│                (file.ts, Dockerfile, Untitled.txt)               │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                    LANGUAGE RESOLUTION ENGINE                    │
│   (1. Override → 2. Special Filename → 3. Extension → 4. Plaintext)│
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Resolves LanguageDefinition
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                QM EDITOR CENTRAL LANGUAGE REGISTRY               │
│     (typescript, javascript, json, html, css, python, etc.)      │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Configures Language Compartment
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                    EDITOR ADAPTER INTEGRATION                    │
│        (Dispatches CodeMirror 6 Language Compartment Mode)       │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ Theme Syntax Token Styling
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                      EDITOR SURFACE VIEW                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. DOMAIN MODEL & CONTRACT (`src/types/index.ts`)

```typescript
export interface LanguageDefinition {
  id: string;               // Stable internal ID (e.g. 'typescript', 'python')
  displayName: string;      // User-facing display name (e.g. 'TypeScript', 'Python')
  aliases: string[];        // Recognized aliases (e.g. ['ts', 'tsx'])
  extensions: string[];     // File extensions without dot (e.g. ['ts', 'tsx'])
  filenames?: string[];     // Special exact filenames (e.g. ['tsconfig.json', 'Dockerfile'])
}
```

---

## 3. DETERMINISTIC RESOLUTION ORDER

When a document is opened or updated, language resolution follows a strict priority chain:

1. **Explicit User Override:** If a manual language override is set on the document session, that language is used.
2. **Known Special Filename:** Matches exact filenames (case-insensitive for OS compatibility, e.g. `Dockerfile`, `Makefile`, `package.json`, `.gitignore`).
3. **Known File Extension:** Extracts final extension after last dot (e.g. `component.test.ts` -> `ts` -> `typescript`).
4. **Plain Text Fallback (`plaintext`):** If no extension or unknown extension, falls back to `Plain Text`.

---

## 4. MANUAL LANGUAGE OVERRIDE DISCIPLINE

- Changing the active document's language mode (e.g. `Plain Text` -> `Python`) modifies ONLY the document presentation configuration (`document.language`).
- **File Integrity Protection:** Manual language override does NOT alter file content, rename the file, change file extensions, or mark the document dirty.
- Read-only documents permit manual syntax language switching for viewing purposes without mutating physical storage.

---

## 5. EDITOR ENGINE & THEME INTEGRATION

- CodeMirror 6 language modes are managed via an isolated `Compartment()` inside `CodeMirrorEditorAdapter`.
- Reconfiguring language mode dispatches a compartment update without re-mounting the editor DOM or losing cursor/scroll state.
- Syntax token colors adapt dynamically to active `ThemeMode` (Dark / Light) while ensuring Search match highlights (`cm-search-match`, `cm-search-match-current`) remain visible over syntax-colored text.

---

## 6. BRACKET BEHAVIOR, CODE FOLDING & SMART INDENTATION INTEGRATION

Step 13 connects language intelligence with professional editing features:

1. **Delimiter Matching (`bracketMatching`):** CodeMirror 6 `bracketMatching()` highlights matching pair delimiters `()`, `[]`, `{}` based on syntax structure.
2. **Auto-Closing Brackets & Quotes (`autoClosingBrackets`):** Intercepts typed opening delimiters, automatically inserts closing pairs, wraps text selections when typing quotes/brackets, and skips duplicate closing characters.
3. **Code Folding (`folding`):** `foldGutter()` renders code folding controls for block regions, functions, and object literals. Commands `editor.foldAll` and `editor.unfoldAll` invoke engine-native fold operations.
4. **Smart Indentation (`indentUnit`, `indentOnInput`):** Respects configurable tab sizes (`2`, `4`, `8`) and space/tab preferences while enforcing language-aware auto-indentation on newline.

