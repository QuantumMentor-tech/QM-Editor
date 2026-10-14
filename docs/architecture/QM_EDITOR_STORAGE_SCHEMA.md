# QM Editor — Storage Schema Governance & Migration Specification
**Phase 05 — Data & Storage Architecture**
**Step 46 of 135 — Foundation, Persistence Boundaries & Schema Governance**

---

## 1. Schema Governance Framework

In QM Editor, every persistent structured record must be governed by an explicit, versioned, and validated schema. Arbitrary, untyped JSON blobs are strictly prohibited from durable storage.

### 1.1 Schema Identifier Conventions
Schema identifiers follow reverse-domain dot notation:
- `qm.settings.user`: Global user settings and preferences.
- `qm.settings.workspace`: Workspace-scoped configuration overrides.
- `qm.workspace.metadata`: Workspace identity, roots, and lifecycle metadata.
- `qm.session.workspace`: Active tabs, cursor locations, and view state.
- `qm.navigation.recent`: Recent workspace and document history metadata.

### 1.2 Schema Versioning Decoupling
Schema versions are strictly positive integers (`1, 2, 3...`) reflecting structural data compatibility. Schema versions are **completely decoupled** from application release numbers (e.g. QM Editor v1.2.0 does not imply schema v1.2.0).

---

## 2. Schema Registry (`SchemaRegistry.ts`)

The central `SchemaRegistry` maintains typed definitions:

```typescript
export interface StorageSchemaDefinition<T = unknown> {
  readonly schemaId: string;
  readonly currentVersion: number;
  readonly description: string;
  validate(data: unknown): data is T;
  sanitize?(data: T): T;
}
```

### 2.1 Validation on Read and Write
- **On Write:** Before writing any record, `StorageService` queries `SchemaRegistry.validate(schemaId, payload)`. Payloads failing validation are rejected with `StorageValidationError` and never written to physical storage.
- **On Read:** Upon reading, the payload is validated against the registered schema validator. If validation fails, `StorageCorruptDataError` is raised, health status updates to `recoveryRequired`, and the corrupted record is quarantined.

---

## 3. Migration Architecture (`MigrationRegistry.ts`)

Schema changes over time must be mediated through deterministic, ordered migrations rather than ad-hoc in-place mutations.

```text
  Stored Record (v1)
          │
          ▼
  Migration Registry (Finds Path: v1 -> v2 -> v3)
          │
          ├── Step 1: v1 -> v2 (Transformation + Step Validation)
          │
          ├── Step 2: v2 -> v3 (Transformation + Step Validation)
          │
          ▼
  Final Target Record (v3) (Validated against SchemaRegistry.validate())
          │
          ▼
  Atomic Commit to Storage (record.schemaVersion updated to 3)
```

### 3.1 Migration Contract
```typescript
export interface StorageMigration<TFrom = any, TTo = any> {
  readonly schemaId: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly description: string;
  migrate(from: TFrom): Promise<TTo> | TTo;
}
```

### 3.2 Automated Read-Time Migration
When `StorageService.read()` encounters a stored record with `schemaVersion < targetVersion` (and `autoMigrate !== false`):
1. `MigrationRegistry` executes a breadth-first search to compute the shortest migration path.
2. Each migration step transforms the payload sequentially.
3. The final payload is validated against `SchemaRegistry.validate()`.
4. The migrated record is persisted back to storage atomically with the updated `schemaVersion`.
5. The upgraded record is returned to the caller.

---

## 4. Failure Handling & Downgrade Policy

### 4.1 Migration Step Failure
If any migration step throws an error or fails validation:
- The migration process halts immediately.
- The physical storage record is **not** mutated or partially updated.
- `StorageMigrationError` is thrown with complete context (`schemaId`, `failedStep`, `originalRecord`).
- Storage health reports a warning issue.

### 4.2 Strict Downgrade Rejection
Downgrading schema versions is fundamentally unsupported. If an older version of QM Editor reads storage created by a newer version (`storedVersion > targetVersion`), `StorageService` immediately throws `StorageMigrationError`:

```text
[STORAGE_MIGRATION_FAILED] Downgrading schema is unsupported for "qm.settings.user" (stored v5 > target v1).
```
The application will never silently discard or overwrite newer schema fields.
