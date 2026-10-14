# QM Editor — Code Action & Quick Fix Architecture

## Phase 04 — Core Application Engine | Step 44

---

## 1. Executive Architectural Summary

The **Code Action and Quick Fix Engine** in QM Editor establishes an asynchronous, provider-driven, revision-aware, transaction-safe, and preview-capable framework for proposing and executing safe code transformations.

It extends the centralized **Language Intelligence Architecture** (Step 42 & 43) without creating competing provider registries or direct mutation side-channels.

```
+----------------------------------------------------------------------------------+
|                   Diagnostics / Cursor Context / Manual Shortcut                 |
|                   (Triggered by Mod+. / Alt+Enter / Problems panel)              |
+----------------------------------------------------------------------------------+
                                         │
                                         ▼
+----------------------------------------------------------------------------------+
|                              CodeActionCoordinator                               |
|  - Cancels prior in-flight requests (CancellationTokenSource)                    |
|  - Validates document revision, model ID, and workspace generation               |
|  - Queries compatible providers concurrently within isolated try/catch shields   |
|  - Normalizes and sorts actions: preferred first, priority descending, title     |
+----------------------------------------------------------------------------------+
                                         │
                                         ▼
+----------------------------------------------------------------------------------+
|                                CodeActionWidget                                  |
|  - Floating accessible menu positioned at cursor via coordsAtPos                 |
|  - Shows category icons, preferred badge, provider source, disabled reason       |
|  - Keyboard navigation: ArrowUp/ArrowDown, Enter to apply, Preview button        |
+----------------------------------------------------------------------------------+
                                         │
                                         ▼
+----------------------------------------------------------------------------------+
|                             Double Validation Rule                               |
|  - Revalidates document existence, read-only flag, and conflict state            |
|  - Revalidates workspace generation (blocks cross-workspace application)         |
|  - Revalidates document contentRevision against action.documentRevision          |
|  - Validates all edit ranges are in-bounds and non-overlapping                   |
+----------------------------------------------------------------------------------+
                                         │
                                         ▼
+----------------------------------------------------------------------------------+
|                            Edit Transaction System                               |
|  - Dispatches to globalEditorCoordinationService.applyTransaction(...)           |
|  - Origin: 'codeAction'                                                          |
|  - Automatically integrates with native editor history (Undo/Redo)               |
|  - Increments contentRevision and sets isDirty = true                            |
+----------------------------------------------------------------------------------+
```

---

## 2. Core Principles & Design Invariants

1. **Proposals, Not Mutations:** Providers return *proposals* for code transformations (`CodeAction`). Providers are strictly prohibited from calling direct mutation APIs (e.g. `editor.executeEdits`).
2. **Double Validation Rule:**
   - *At presentation:* Ensure the action applies to the active context.
   - *At execution:* Revalidate document identity, model identity, workspace generation, document revision, read-only flags, and non-overlapping edit ranges immediately before applying.
3. **Stale Action Protection:** Actions are bound to `documentRevision`. If user edits advance the revision while an action is pending or displayed, attempting to execute the stale action is immediately blocked with status `'stale'`.
4. **Workspace Boundary Isolation:** Actions generated in Workspace A are permanently rejected if the active workspace generation advances or switches to Workspace B (`'workspace_mismatch'`).
5. **Read-Only & Conflict Safety:** Actions targeting read-only documents or documents in an external file-conflict state are blocked from text mutation (`'read_only'`, `'conflict'`).
6. **Non-Mutating Previews:** The preview engine simulates transformations on pure string copies. Previews NEVER mutate document buffers, alter dirty flags, modify files on disk, or push undo records.
7. **Native History Integration:** Executed code actions apply through `EditorCoordinationService.applyTransaction({ source: 'codeAction' })` and automatically integrate into the standard undo/redo history stack.
8. **Provider Error Shielding:** Provider failures execute within dedicated `try/catch` boundaries. An exception or crash in one provider never impacts the host editor or other providers.

---

## 3. Data Models & Contracts

### 3.1 `CodeActionRequest`
```typescript
export interface CodeActionRequest {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly workspaceGeneration: number;
  readonly documentId: string;
  readonly resourceUri: string;
  readonly editorModelId: string;
  readonly documentRevision: number;
  readonly range: Range; // 1-based line & column
  readonly diagnostics: Diagnostic[]; // Overlapping diagnostics
  readonly languageId: string;
  readonly triggerKind: CodeActionTriggerKind; // 'invoked' | 'automatic'
}
```

### 3.2 `CodeAction`
```typescript
export interface CodeAction {
  readonly id: string;
  readonly providerId: string;
  readonly title: string;
  readonly kind: CodeActionKind;
  readonly diagnostics?: Diagnostic[];
  readonly edit?: WorkspaceEdit;
  readonly isPreferred?: boolean;
  readonly disabledReason?: string;
  readonly documentRevision?: number;
  readonly metadata?: Record<string, unknown>;
}
```

### 3.3 `CodeActionKind`
Normalized categories follow standard language intelligence conventions:
- `quickfix`: Automated fixes associated with compiler/linter diagnostics.
- `refactor`, `refactor.extract`, `refactor.inline`, `refactor.rewrite`: Code restructuring.
- `source`, `source.organizeImports`, `source.fixAll`: Whole-document source transforms.
- `format`: Code formatting transformations.

---

## 4. Execution Pipeline

```text
User selects Action in CodeActionWidget / Command
   │
   ▼
CodeActionCoordinator.applyCodeAction(action, options)
   │
   ├─► Resolves lazy edits via provider.resolveCodeAction() if needed
   │
   ├─► Double Validation Rule:
   │     ├─ Action not disabled
   │     ├─ Workspace generation matches active workspace
   │     ├─ Target document open and writable (!isReadOnly, !hasConflict)
   │     ├─ Document revision matches action.documentRevision
   │     └─ Edit ranges are in-bounds and non-overlapping
   │
   ├─► Optional Preview / Confirmation Modal if multi-file or resource operations
   │
   ├─► Converts 1-based Ranges to 0-based character offsets
   │
   ├─► globalEditorCoordinationService.applyTransaction({
   │     documentId,
   │     changes: matchEdits,
   │     expectedRevision: doc.contentRevision,
   │     source: 'codeAction',
   │     description: action.title
   │   })
   │
   ├─► DocumentEngine updates revision & marks isDirty = true
   ├─► DocumentHistoryStack records entry for native Undo/Redo
   │
   ▼
Returns CodeActionExecutionResult ({ status: 'applied', appliedEditsCount, affectedDocuments })
```

---

## 5. Security & Privacy Controls

- **Zero Shell Execution:** Code actions cannot invoke arbitrary OS commands or scripts.
- **Strict Path Sandboxing:** Resource operations and edits must stay strictly within active workspace boundaries.
- **Privacy Assurance:** Source code, proposed edits, and diagnostic context are processed strictly on the local client (never logged or exfiltrated).
