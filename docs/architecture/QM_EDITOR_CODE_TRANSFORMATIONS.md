# QM Editor — Code Transformations & Workspace Edits Architecture

## Phase 04 — Core Application Engine | Step 44

---

## 1. Executive Summary

This specification establishes the **Code Transformation Model** for QM Editor. It defines how text edits and structured workspace edits are modeled, validated, simulated for preview, and executed safely through the **Edit Transaction System**.

---

## 2. Transformation Hierarchy

```
                            WorkspaceEdit
                                  │
          ┌───────────────────────┴───────────────────────┐
          ▼                                               ▼
   Text Edits by URI                            Resource Operations
  { [uri]: TextEdit[] }                       [ createFile, renameFile, deleteFile ]
          │                                               │
          ▼                                               ▼
   1-Based Range & Text                         File Service Execution
(startLine, startCol, endLine, endCol)       (Path validation, workspace root sandboxing)
          │
          ▼
   0-Based Character Offsets
   (from, to, insertText)
          │
          ▼
   Edit Transaction System
(applyTransaction({ source: 'codeAction' }))
          │
          ▼
   Editor Model & Buffer Mutation
```

---

## 3. Data Models

### 3.1 `TextEdit`
Represents a replacement within a specific document using canonical 1-based coordinates:
```typescript
export interface TextEdit {
  readonly resourceUri: string;
  readonly range: Range; // startLine, startColumn, endLine, endColumn (1-based)
  readonly newText: string;
}
```

### 3.2 `WorkspaceEdit`
Groups multi-document edits and optional resource lifecycle operations:
```typescript
export interface WorkspaceEdit {
  readonly changes?: { readonly [uri: string]: TextEdit[] };
  readonly resourceOperations?: ResourceEditOperation[];
}
```

### 3.3 `ResourceEditOperation`
Defines explicit, future-compatible resource operations:
```typescript
export type ResourceEditOperation =
  | {
      readonly type: 'createFile';
      readonly uri: string;
      readonly options?: { readonly overwrite?: boolean; readonly ignoreIfExists?: boolean };
    }
  | {
      readonly type: 'renameFile';
      readonly oldUri: string;
      readonly newUri: string;
      readonly options?: { readonly overwrite?: boolean; readonly ignoreIfExists?: boolean };
    }
  | {
      readonly type: 'deleteFile';
      readonly uri: string;
      readonly options?: { readonly recursive?: boolean; readonly ignoreIfNotExists?: boolean };
    };
```

---

## 4. Coordinate Conversion & Range Validation

Text edits generated in 1-based coordinates are converted into 0-based character offsets (`from`, `to`) using `codeActionRangeToOffsets(content, range)`:

```typescript
export function codeActionRangeToOffsets(content: string, range: Range): { from: number; to: number } {
  const lines = content.split('\n');
  let from = 0;
  for (let i = 0; i < range.startLine - 1 && i < lines.length; i++) {
    from += lines[i].length + 1;
  }
  from += Math.max(0, range.startColumn - 1);
  from = Math.min(from, content.length);

  let to = 0;
  for (let i = 0; i < range.endLine - 1 && i < lines.length; i++) {
    to += lines[i].length + 1;
  }
  to += Math.max(0, range.endColumn - 1);
  to = Math.min(to, content.length);

  return { from, to: Math.max(from, to) };
}
```

### Validation Invariants:
1. **Range Boundary Invariant:** `0 <= from <= to <= content.length`. Any edit exceeding text length or inverted (`from > to`) is rejected with `'invalid_range'`.
2. **Non-Overlapping Invariant:** Multiple edits affecting the same document are sorted ascending by starting offset:
   ```
   sorted[i].to <= sorted[i + 1].from
   ```
   If any edit end offset strictly exceeds the next edit's start offset, the entire transaction is rejected with `'invalid_range'`.

---

## 5. Preview Simulation (Zero-Mutation Guarantee)

The transformation preview engine simulates edits purely in memory:
1. Retrieves a read-only snapshot of document content.
2. Converts edits to offsets and sorts in **descending** offset order (`b.from - a.from`).
3. Slices strings in reverse order so character offsets remain invariant:
   ```typescript
   proposed = proposed.slice(0, ch.from) + ch.insertText + proposed.slice(ch.to);
   ```
4. Generates a `CodeActionPreview` summary.
5. **Guarantee:** `doc.content`, `doc.contentRevision`, `doc.isDirty`, and the undo stack remain 100% untouched.

---

## 6. Multi-Document Execution & Atomicity

In web and hybrid editor environments, OS-level multi-file distributed transactions do not exist. Therefore:
1. Open documents are updated via `globalEditorCoordinationService.applyTransaction({ documentId, changes, expectedRevision, source: 'codeAction' })`.
2. Closed files are safely written through `fileService.writeFile`.
3. If one document fails (e.g. disk write failure), applied changes are preserved and reported as `partial_failure` with complete error details.
4. Atomicity is never falsely claimed where underlying storage cannot guarantee it.
