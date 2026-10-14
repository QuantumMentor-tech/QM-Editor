# QM Editor — Completion Engine Architecture
**Phase 04 — Core Application Engine (Step 42 of 135)**

---

## 1. Executive Summary

The **Completion Engine** coordinates the retrieval, normalization, deduplication, ranking, and application of code completions in QM Editor. It connects the interactive editor UI with registered language intelligence providers while ensuring strict transaction safety and document integrity.

---

## 2. Completion Data Models

### 2.1. Completion Request
```typescript
export interface CompletionRequest {
  requestId: string;
  documentId: string;
  uri: string;
  languageId: string;
  revision: number;
  position: Position; // 1-based line & column
  offset: number;     // 0-based character offset
  triggerKind: CompletionTriggerKind; // 'invoked' | 'triggerCharacter' | 'automatic'
  triggerCharacter?: string;
  workspaceId?: string;
  linePrefix?: string;
}
```

### 2.2. Completion Item
```typescript
export interface CompletionItem {
  id: string;
  label: string;
  kind: CompletionItemKind;
  insertText?: string;
  detail?: string;
  documentation?: string;
  filterText?: string;
  sortText?: string;
  range?: Range; // Exact replacement range in document coordinates
  additionalTextEdits?: Array<{ range: Range; newText: string }>;
  providerId?: string;
  priority?: number;
}
```

---

## 3. Deduplication & Ranking Foundation

1. **Deduplication Identity**:
   Items are deduplicated by composite key:
   `normalized_label : normalized_insert_text : semantic_kind`
   When duplicates occur across providers, the item with the higher provider priority is preserved. Items with different replacement text or ranges are preserved as distinct completions.
2. **Deterministic Ranking**:
   Items are ordered by:
   - Provider Priority (descending)
   - `sortText` (ASCII alphabetical order)
   - `label` (ASCII alphabetical order)
3. **Filtering**:
   Client-side interactive filtering matches prefix characters against `filterText` or `label`.

---

## 4. Acceptance & Edit Transaction Pipeline

When a user selects a completion item, the coordinator applies it using the authoritative Edit Transaction System:

```text
User Selects Completion
         │
         ▼
Validate Document & Revision
         │
         ▼
Enforce Read-Only Capability (Reject if read-only)
         │
         ▼
Resolve Replacement Range to Character Offsets
         │
         ▼
Build Atomic SingleTextEdit Change List
         │
         ▼
EditorCoordinationService.applyTransaction({
  documentId,
  changes,
  expectedRevision,
  source: 'completion'
})
         │
         ▼
DocumentEngine Updates Text, Advances Revision & Dirty State
         │
         ▼
Native Undo / Redo Stack Updated Transparently
```

No provider can bypass this pipeline or mutate editor buffers directly.

---

## 5. Security & Privacy Guarantees

1. **Local Execution**: Core completion processing is 100% local in-memory.
2. **No Data Exfiltration**: Source code and completion requests are never logged or transmitted over networks.
3. **Safe Rendering**: Completion documentation is rendered as sanitized plain text / safe markup; executable HTML or script tags are strictly prohibited.
4. **Command Execution Guard**: Completion items cannot trigger arbitrary system commands upon acceptance.
