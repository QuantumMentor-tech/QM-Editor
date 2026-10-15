# QM Editor Data & Storage Integration Architecture

## 1. Integrated Persistence Model
QM Editor operates under a layered, unidirectional persistence model that establishes an unambiguous single source of truth for every domain:

```text
       ┌────────────────────────────────────────────────────────┐
       │                Application Services & UI               │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │            Domain Coordinators & Authorities           │
       │   DocumentEngine | WorkspaceEngine | SettingsService   │
       │   RecoveryCoord  | HistoryCoord    | BackupCoord       │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                Persistence Repositories                │
       │  SettingsRepo     | WorkspaceStateRepo | DocMetaRepo   │
       │  RecentRepo       | IndexRepo          | RecoveryRepo  │
       │  HistoryRepo      | NavigationRepo                     │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                 Storage Service Layer                  │
       │  - Schema Validation (SchemaRegistry)                  │
       │  - Forward Migrations (MigrationRegistry)              │
       │  - Serialization & Boundary Checks (StorageSerializer) │
       │  - Checksum Integrity (computeChecksum)                │
       │  - Concurrency Queues & Optimistic Versioning          │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                 Storage Adapter Layer                  │
       │  MemoryStorageAdapter | LocalStorageAdapter | IDB      │
       └────────────────────────────────────────────────────────┘
```

---

## 2. Inviolable Cross-Domain Boundaries

### Boundary 1: Document Buffer vs Filesystem
- In-memory editing authority belongs exclusively to `DocumentEngine`.
- Filesystem authority belongs to the underlying OS filesystem.
- Document text is never directly written to disk by Recovery, Local History, or Backup.
- An explicit user Save (`Ctrl+S`) or Save As action is the sole authorized path to modify physical project files on disk.

### Boundary 2: Recovery vs Local History
- **Recovery (Step 52)** represents crash-safe, temporary snapshots of unsaved editor content. Snapshots are tied to active process sessions and are pruned upon clean document save or clean shutdown.
- **Local History (Step 53)** represents durable historical checkpoints preserved across sessions for long-term user inspection and delta tracking.
- Local History snapshots are never pruned by recovery cleanup, and recovery snapshots are never converted into historical checkpoints.

### Boundary 3: Backup/Export vs Workspace Ownership
- QM Editor does not own external source repositories merely because it edits their files.
- Configuration backups and portable export packages contain QM Editor metadata, settings, definitions, and optionally Local History. They never silently duplicate external source files.

### Boundary 4: Derived Acceleration vs Authoritative Truth
- Search indexes and Quick Open caches (`ResourceIndexRepository`) are derived and disposable.
- Derived indexes never serve as authoritative sources of document existence or content.
- Corrupted or stale indexes are cleanly invalidated and rebuilt fresh from disk.

### Boundary 5: Untrusted Input & Staging
- All incoming packages from external sources (imports, migrations, restored archives) are treated as hostile untrusted input.
- Packages are validated inside an in-memory staging sandbox before touching persistent storage.
- Path traversal tokens (`..`, `/`, `\`, `C:`, `\\`) and executable files are rejected immediately.

---

## 3. Storage Degraded Mode & Fault Tolerance
The storage architecture provides resilience under failure:
- **Read-Only Storage:** Storage entering read-only mode (e.g. disk quota exhaustion) safely rejects writes with `StorageReadOnlyError` while allowing in-memory editing and reading of existing configurations to continue.
- **Corrupt Index Self-Healing:** Corruption in `qm.workspace.index` triggers safe invalidation and background disk rescan without halting UI or workspace operations.
- **Unsaved Work Safety:** If storage writes fail during keystrokes, `DocumentRecoveryCoordinator` logs an internal issue and keeps the dirty in-memory document intact, preserving the user's ability to save manually.
