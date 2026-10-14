# QM Editor — Persistent Document Metadata Schema Specification
**Phase 05 — Data & Storage Architecture | Step 48 of 135**

---

## 1. Schema Overview

- **Schema ID:** `qm.document.metadata`
- **Current Version:** `1`
- **Scope:** `workspace`
- **Key Pattern:** `ws:${workspaceId}:doc:${encodeURIComponent(resourceUri)}`
- **Governance:** Managed and validated by `SchemaRegistry` and `MigrationRegistry`.

---

## 2. Document Metadata DTO Specification (`DocumentMetadataDTO`)

```typescript
export interface DocumentMetadataDTO {
  /**
   * Version of the persisted metadata DTO schema (currently 1).
   */
  readonly version: number;

  /**
   * Canonical normalized URI of the backing resource.
   * Example: 'file:///C:/projects/app/src/index.ts'
   */
  readonly resourceUri: string;

  /**
   * Identifier of the containing workspace context.
   * Ensures strict cross-workspace metadata isolation.
   */
  readonly workspaceId: string;

  /**
   * Language identifier assigned to the document.
   * Example: 'typescript', 'markdown', 'plaintext'
   */
  readonly languageId: string;

  /**
   * Flag indicating whether the languageId was explicitly selected by the user.
   * If true, this preference is restored over file extension detection on reopen.
   */
  readonly isManualLanguage?: boolean;

  /**
   * Character encoding used or remembered for the document.
   * Example: 'utf-8', 'utf-16le', 'windows-1252'
   */
  readonly encoding: string;

  /**
   * Flag indicating whether the encoding was manually selected by the user.
   */
  readonly isManualEncoding?: boolean;

  /**
   * Line-ending preference or last observed format.
   * Options: 'lf' | 'crlf' | 'cr'
   */
  readonly lineEnding?: 'lf' | 'crlf' | 'cr';

  /**
   * Whether the document is marked read-only.
   */
  readonly isReadOnly?: boolean;

  /**
   * Descriptive reason for read-only status (e.g. 'locked by VCS', 'filesystem').
   */
  readonly readOnlyReason?: string;

  /**
   * Last known file size on disk in bytes (advisory only).
   */
  readonly lastKnownSize?: number;

  /**
   * Last known modification timestamp on disk (advisory only).
   */
  readonly lastKnownModifiedTime?: number;

  /**
   * Timestamp in epoch milliseconds when the document was last opened.
   */
  readonly lastOpenedAt: number;

  /**
   * Timestamp in epoch milliseconds when the document was last successfully saved.
   * Must never be set or updated on failed save operations.
   */
  readonly lastSavedAt?: number;

  /**
   * Last active cursor coordinates for view restoration.
   */
  readonly cursorPosition?: {
    readonly line: number;
    readonly column: number;
  };

  /**
   * Pinned document status flag.
   */
  readonly pinned?: boolean;
}
```

---

## 3. Validation Rules

A record is rejected with `StorageValidationError` if:
1. `version` is not a number.
2. `resourceUri` is not a non-empty string.
3. `workspaceId` is not a non-empty string.
4. `languageId` is not a string.
5. `encoding` is not a string.
6. `lineEnding` is defined but not one of `'lf'`, `'crlf'`, `'cr'`.
7. `lastOpenedAt` is not a number.

---

## 4. Migration Rules

When evolving `qm.document.metadata`:
1. Increment `currentVersion` in `SchemaRegistry`.
2. Register a forward migration step in `MigrationRegistry` from `N` to `N+1`.
3. Migrations must be pure, deterministic functions without side effects.
4. Older records read by `StorageService.read` are automatically migrated and atomically written back to storage.
