# Phase 05: Data & Storage Architecture Index

## 1. Overview & Architectural Scope
Phase 05 establishes a unified, durable, secure, and recoverable Data & Storage Architecture for QM Editor across Steps 46 through 55.

```text
Application Services / UI
         │
         ▼
Authoritative Domain Coordinators
(WorkspaceEngine, DocumentEngine, SettingsService, LocalHistoryCoordinator, DocumentRecoveryCoordinator, BackupCoordinator)
         │
         ▼
Persistence Repositories
(SettingsRepo, WorkspaceStateRepo, DocumentMetadataRepo, ResourceStateRepo, NavigationHistoryRepo, RecentResourceRepo, ResourceIndexRepo, RecoveryRepo, LocalHistoryRepo)
         │
         ▼
Storage Service (Validation, Concurrency Queues, Secret Scanning, Checksumming)
         │
         ▼
Storage Adapters (Memory, LocalStorage, IndexedDB)
```

---

## 2. Step-by-Step System Breakdown

### Step 46: Foundation & Persistence Boundaries
- Established `StorageService`, `IStorageAdapter`, `StoredRecord<T>`.
- Core adapters: `MemoryStorageAdapter`, `LocalStorageAdapter`, `IndexedDBStorageAdapter`.
- `SchemaRegistry`: Central versioned schema registry with programmatic schema validation.
- `MigrationRegistry`: Monotonic, ordered, forward migration pipeline.
- `StorageSerializer`: JSON serialization with runtime object rejection (functions, symbols) and proactive sensitive credential scanning.
- Core schemas: `qm.settings.user`, `qm.settings.workspace`.

### Step 47: Persistent Workspace State, Metadata & Session Storage
- `WorkspaceStateRepository`: Workspace identity, multi-folder roots, and lifecycle metadata under `qm.workspace.metadata` (v1).
- Session state persistence: Active editor tabs, cursor coordinates, and split layout under `qm.session.workspace` (v1).
- Recent workspaces: MRU workspace directory tracking under `app:recent_workspaces` (v1).

### Step 48: Persistent Document Metadata & Resource State
- `DocumentMetadataRepository`: Durable document preferences, language mode, line ending (`lf` | `crlf` | `cr`), encoding, read-only flags under `qm.document.metadata` (v1).
- `ResourceStateRepository`: Filesystem existence tracking and path fingerprints under `qm.resource.state` (v1).
- Canonical URI normalization and cross-session document preference binding.

### Step 49: Persistent Settings, Preferences & Configuration
- Layered settings hierarchy: System Defaults -> Global User Settings -> Workspace Settings Overrides -> In-Memory Ephemeral.
- Strict isolation of sensitive settings (passwords, tokens, keys) with automatic exclusion.
- Setting category governance and reactive settings change events.

### Step 50: Persistent Recent Resources, Navigation History & User Activity
- `RecentResourceRepository`: MRU recent document tracking under `qm.navigation.recent` (v1) with bounded capacity (20 entries).
- `NavigationHistoryRepository`: Back/forward navigation location stacks under `qm.navigation.history` (v1).
- Stale location detection and missing file pruning upon navigation.

### Step 51: Persistent Workspace Indexes, Search Cache & Derived Data
- `ResourceIndexRepository`: Derived workspace index and candidate cache under `qm.workspace.index` (v1).
- Clear classification: Authoritative (disk) vs Derived (rebuildable index).
- Incremental synchronization via file watcher events with 300ms debouncing.
- Instant warm startup for Quick Open (`Ctrl+P`) and Workspace Search (`Ctrl+Shift+F`).
- Self-healing invalidation: corrupted or stale indexes are discarded and rebuilt cleanly from disk.

### Step 52: Document Recovery, Autosave & Crash-Safe Unsaved Work Foundation
- `DocumentRecoveryCoordinator` & `DocumentRecoveryRepository`: Crash recovery protection under `qm.recovery.manifest` (v1), `qm.recovery.snapshot` (v1), and `qm.recovery.session` (v1).
- Strict separation: Recovery is crash protection, NOT Local History or Git.
- Zero silent disk overwrite: Restoring recovery content loads into memory via `DocumentEngine` and sets `isDirty = true`; disk is untouched until manual user save.
- Monotonic generation race protection and debounced write coalescing (default 1000ms).

### Step 53: Local History, Document Snapshots & Versioned Content Persistence
- `LocalHistoryCoordinator` & `LocalHistoryRepository`: Durable, bounded historical timeline of document revisions under `qm.history.manifest` (v1) and `qm.history.snapshot` (v1).
- Cryptographic SHA-256 content deduplication and coalescing of identical saves.
- Pre-restore safety invariant: Restoring an entry creates a `preRestore` safety snapshot.
- Bounded retention quotas (50 entries per file, 30 days retention, 100MB cap).
- UI: `LocalHistoryModal` (`Ctrl+Alt+H`) with diff inspection and timeline browsing.

### Step 54: Application Backup, Export, Import & Safe Data Portability
- `BackupCoordinator`, `PackageValidator`, `PackageMigrator`: Safe portability under `qm.portability.manifest` (v1) and `qm.portability.package` (v1).
- Strict concept separation: Backup ≠ Export ≠ Import ≠ Restore.
- Untrusted package staging sandbox: Path traversal protection (`../`, `..\`, absolute paths, drive letters, UNC paths), quota bounds (max 5,000 files, 10MB per file, 50MB package), integrity checksum verification.
- Pre-restore safety backups and controlled conflict resolution (`merge`, `replace`, `skip`).
- UI: `BackupPortabilityModal` (`Ctrl+Alt+B`).

### Step 55: Integration, Hardening & Completion Audit
- Verification of cross-domain authority boundaries, data loss prevention, degraded mode resiliency, and zero memory leaks.
- Cross-domain integration test suite (`Phase05IntegrationAudit.test.ts`).
- Release readiness verification across all 16 Phase 05 schemas.
