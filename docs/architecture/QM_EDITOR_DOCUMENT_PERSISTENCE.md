# QM Editor — Persistent Document Metadata & Resource State Architecture
**Phase 05 — Data & Storage Architecture | Step 48 of 135**

---

## 1. Executive Summary

Step 48 establishes the durable persistence boundary for **document-related metadata and resource state** in QM Editor.
The primary architectural imperative of this step is:

> **Persist document knowledge, not document authority.**
> **Store the map of the document; never mistake the map for the document itself.**

Persistent metadata preserves useful non-content document attributes (such as manual language overrides, manual encodings, line-ending styles, last opened/saved timestamps, read-only classifications, and cursor positions) across application restarts without violating the foundational distinction:

```text
Persisted Document Metadata != Authoritative Saved File Content
```

Actual file content remains strictly governed by the **Filesystem**, while the runtime live document model is authoritatively governed by the **Document Engine**.

---

## 2. Core Authority Chain

QM Editor maintains a strict 4-tier authority hierarchy for documents:

```text
┌──────────────────────────────────────────────┐
│                  Filesystem                  │
│       = Authoritative Saved File Content     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│             File System Service              │
│       = Low-level I/O & Platform Bridge      │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│               Document Engine                │
│       = Live Runtime State & Revision Owner  │
└──────────────┬───────────────────────────────┘
               │
               ├─────────────────────────────────┐
               ▼                                 ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│        Editor Engine         │ │    Persistence Coordinator   │
│   = Text-model & View State  │ │   = Durable Metadata Writer  │
└──────────────────────────────┘ └──────────────┬───────────────┘
                                                │
                                                ▼
                                 ┌──────────────────────────────┐
                                 │  DocumentMetadataRepository  │
                                 │   = Storage Service Bridge   │
                                 └──────────────┬───────────────┘
                                                │
                                                ▼
                                 ┌──────────────────────────────┐
                                 │       Storage Service        │
                                 │  = Versioned Payload Records │
                                 └──────────────────────────────┘
```

Under no circumstances does persistent storage act as a secondary cache for saved file contents or override filesystem ground truth during application startup.

---

## 3. Identity Model & Triad Separation

Step 48 maintains a strict separation among the three foundational identifiers:

| Identifier | Durability Scope | Authority & Purpose | Example |
| :--- | :--- | :--- | :--- |
| `documentId` | Runtime Only | Generated per active document instance in `DocumentRegistry`. Survives only within the live session. | `doc-1791988589730-hm4xw` |
| `resourceUri` | Durable | Canonical backing resource identity across restarts, file watchers, and storage. | `file:///C:/projects/app/src/index.ts` |
| `workspaceId` | Durable | Containing workspace context identity ensuring zero cross-workspace metadata leakage. | `ws-test-alpha` |

### Key Namespacing & URL Encoding

Storage keys are formatted with URL-encoded canonical resource URIs to ensure platform independence, collision avoidance, and reversible lookup:

- **Document Metadata Key:** `ws:${workspaceId}:doc:${encodeURIComponent(resourceUri)}`
- **Resource State Key:** `ws:${workspaceId}:res:${encodeURIComponent(resourceUri)}`
- **Recent Documents Key:** `ws:${workspaceId}:recent_documents` and `app:recent_documents`

---

## 4. Metadata vs. Content Strict Boundary

| Allowed in Persistent Metadata | Strictly Forbidden (Out of Scope for Step 48) |
| :--- | :--- |
| `workspaceId`, `resourceUri` | Buffer text / raw source code |
| Detected & manual `languageId` | Unsaved edits / edit buffers |
| Detected & manual `encoding` | Complete file contents / snapshots |
| `lineEnding` (`lf`, `crlf`, `cr`) | Undo/redo edit stacks |
| `isReadOnly`, `readOnlyReason` | AST / token trees |
| `lastKnownSize`, `lastKnownModifiedTime` | Live DOM elements or editor instances |
| `lastOpenedAt`, `lastSavedAt` | Promises / cancellation controllers |
| Last known `cursorPosition` | Memory-heavy indexing caches |

---

## 5. Lifecycle Coordination & Invariants

The `DocumentPersistenceCoordinator` orchestrates metadata lifecycle in response to canonical `DocumentEngine` events:

### 1. Document Open Lifecycle
1. Document is opened via `DocumentEngine.openResource()`.
2. Existing metadata is queried from `DocumentMetadataRepository`.
3. If a manual language override (`isManualLanguage: true`) or manual encoding override (`isManualEncoding: true`) was previously chosen by the user, it is restored onto the live document model.
4. Up-to-date metadata DTO is persisted with an updated `lastOpenedAt` timestamp.
5. Resource state DTO is updated (`exists: true`).
6. Recent document entry is appended and deduplicated within the workspace and global retention bounds.

### 2. Document Save Lifecycle
1. On successful filesystem save, `document.saved` is dispatched by `DocumentEngine`.
2. Coordinator updates `lastSavedAt: timestamp`, `lastKnownSize`, and `lastKnownModifiedTime`.
3. **Save Failure Invariant:** If `document.saveFailed` is emitted, metadata persistence is **suppressed**. Under no circumstances is `lastSavedAt` updated when the disk write fails.

### 3. Save As & Rename Lifecycle
1. On `document.resourceChanged` (dispatched on Save As or rename):
   - Existing metadata is migrated from `oldResourceUri` to `newResourceUri`.
   - New `ResourceStateDTO` is recorded for `newResourceUri`.
   - If `oldResourceUri` was not an untitled buffer, old metadata and resource state records are atomically deleted to eliminate orphaned duplicates.
   - Recent document history is updated to reflect the new URI.

### 4. External Changes (Modify / Delete)
1. On `document.externalChanged` with `type: 'modify'`: `lastKnownSize` and `lastKnownModifiedTime` are updated.
2. On `document.externalChanged` with `type: 'delete'`: `ResourceStateDTO.exists` is updated to `false`, preserving descriptive history without blindly deleting identity.

### 5. Untitled Document Handling
Buffers with `untitled:` URIs are explicitly **excluded** from persistent document metadata and resource state storage. Untitled documents are non-filesystem scratchpads and are only managed by session continuity where appropriate.

---

## 6. Concurrency & Stale Write Protection

All repository writes support optimistic concurrency via `expectedRecordVersion`:
- When updating metadata where race conditions could occur, callers provide the known record version.
- If storage has advanced (e.g. concurrent save or external reconciliation), stale updates are rejected with `StorageConcurrencyError`, protecting newer state against older writes.

---

## 7. Migration Pipeline

Document metadata adheres to the Phase 05 schema governance infrastructure:
- Schema ID: `qm.document.metadata` (Version 1).
- Schema ID: `qm.resource.state` (Version 1).
- `MigrationRegistry` supports forward schema migrations (e.g. v1 -> v2) with automatic payload transformation and schema validation upon retrieval.
