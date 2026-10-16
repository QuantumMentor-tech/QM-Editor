# QM Editor LSP WorkspaceEdit Architecture & Mapping
**Phase 06 — Advanced Features | Step 62 of 135**

---

## 1. Overview

LSP servers return edits in two structural forms:
1. `changes: { [uri: string]: TextEdit[] }`
2. `documentChanges: (TextDocumentEdit | CreateFile | RenameFile | DeleteFile)[]`

QM Editor maps both formats deterministically into canonical `WorkspaceEdit` objects defined in Step 44 (`CodeActionTypes.ts`), adhering to canonical 1-based coordinates and integrated directly with `CodeActionCoordinator` and `EditorCoordinationService`.

---

## 2. Coordinate Transformation (0-Based to 1-Based)

LSP positions are zero-based, UTF-16 character offsets:
```typescript
line: 0, character: 6  -->  startLine: 1, startColumn: 7
```

`LspWorkspaceEditMapper` translates every edit range:
- `startLine = e.range.start.line + 1`
- `startColumn = e.range.start.character + 1`
- `endLine = e.range.end.line + 1`
- `endColumn = e.range.end.character + 1`

---

## 3. Atomic Multi-File Transactions & Reverse-Offset Slices

When multiple edits target the same file:
1. The edits are sorted in **descending offset order** (`b.from - a.from || b.to - a.to`).
2. Slices are applied from bottom-to-top so earlier text replacements do not invalidate subsequent character offsets within the buffer.
3. Open documents are edited through `EditorCoordinationService.applyTransaction()` with revision checks and undo/redo history recording.
4. Closed documents are updated atomically via `fileService.writeFile()`.

---

## 4. Undo and Redo Integration

Because rename actions are routed through `CodeActionCoordinator` using `kind: 'refactor.rewrite'`:
- Every open file affected receives a discrete transactional step.
- Pressing `Mod+Z` immediately undoes the rename in the active buffer.
- Native history tracking ensures that multi-document mutations do not leave unsaved corrupted states.
