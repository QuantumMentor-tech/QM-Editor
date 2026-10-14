# QM Editor — Data & Storage Architecture Specification
**Phase 05 — Data & Storage Architecture**
**Step 46 of 135 — Foundation, Persistence Boundaries & Schema Governance**

---

## 1. Executive Overview

The **Data & Storage Architecture** of QM Editor establishes the authoritative foundation for durable persistence across the application lifecycle. Built upon the principle that **storage is durable infrastructure, not a second source of domain truth**, this architecture defines:

- What data is persisted versus what remains strictly in-memory.
- Which domain service owns each persistent dataset.
- Where data is stored physically and how namespaces are isolated.
- How schemas are governed, versioned, validated, and migrated.
- How atomic persistence, concurrency serialization, optimistic versioning, and corruption recovery operate.

```text
  UI / Commands / Panels
            │ (User Interaction)
            ▼
  Domain / Application Services (SettingsService, WorkspaceEngine, SessionService)
            │ (Domain Authority)
            ▼
  Persistence Repositories (SettingsRepository, WorkspaceStateRepository, SessionStateRepository)
            │ (Persistence Contracts & DTOs)
            ▼
  Storage Service (Lifecycle, Validation, Concurrency Queues, Checksums)
            │ (Envelope & Migrations)
            ▼
  Storage Adapters (LocalStorageAdapter, MemoryStorageAdapter, IndexedDB/SQLite)
            │ (Physical I/O)
            ▼
  Physical Storage (Local Browser Storage / OS AppData Filesystem)
```

---

## 2. Core Architectural Principles

### 2.1 Domain Authority Primacy
Storage engines and databases never decide what a document, workspace, or setting "is". The respective Phase 04 engines (`DocumentEngine`, `WorkspaceEngine`, `SettingsService`) remain the sole domain authorities. The storage subsystem provides persistence infrastructure under contract to these services.

### 2.2 Strict UI Storage Isolation
UI components (`React`, panels, dialogs, widgets) are strictly forbidden from performing raw database queries or direct filesystem writes for application state. UI components interact exclusively with Domain Services; Domain Services interact with Repositories.

### 2.3 Local-First & Privacy Guarantee
All persistent data resides strictly on the local machine. QM Editor requires zero network connectivity to save configuration, workspace state, or history metadata. No telemetry databases, cloud synchronizers, or external data pipelines exist.

### 2.4 Secrets & Sensitive Data Boundary
Sensitive credentials (passwords, API secrets, private keys, auth tokens) are strictly prohibited from plaintext storage records. The `StorageSerializer` actively scans serialization payloads and rejects sensitive keys with `StorageSensitiveDataError`.

---

## 3. Storage Hierarchy & Physical Layout

### 3.1 Logical Storage Structure
```text
QM Editor Storage Root
│
├── app/ (Application-Scoped Storage)
│   ├── app:user_settings        (Global user preferences & editor configurations)
│   ├── app:recent_workspaces    (Bounded list of MRU workspaces)
│   └── app:recent_documents     (Bounded list of recently opened files)
│
├── ws:<workspaceId>/ (Workspace-Scoped Storage Partition)
│   ├── ws:<id>:metadata         (Workspace identity, roots, creation timestamp)
│   ├── ws:<id>:settings         (Workspace-scoped setting overrides)
│   └── ws:<id>:session          (Open tabs, active tab, last cursor locations)
│
├── cache/ (Discardable, Rebuildable Data - Non-Authoritative)
│   ├── symbol_cache             (Parsed document symbols, index cache)
│   └── search_cache             (Transient search tokens)
│
├── temporary/ (Transient Operational Files)
│   └── atomic_swap_temp         (Safe write staging)
│
└── quarantine/ (Corrupted Record Isolation)
    └── qm_corrupted_<key>_<ts>  (Isolated corrupt records preserving user data)
```

### 3.2 Workspace Partitioning & Isolation
To prevent cross-workspace data leakage, all workspace-scoped records are partitioned with the canonical prefix `ws:<workspaceId>:<key>`. Workspace A cannot read, mutate, or overwrite Workspace B's storage records. Clearing a workspace's persistent state via `StorageService.clearWorkspace(workspaceId)` removes only records belonging to that partition without affecting other workspaces or application-level settings.

---

## 4. Record Envelope Architecture

All persistent data is wrapped inside a typed envelope (`StoredRecord<T>`):

```typescript
export interface StoredRecord<T = unknown> {
  readonly key: string;              // Unique partitioned storage key
  readonly schemaId: string;         // Authoritative schema identifier (e.g. 'qm.settings.user')
  readonly schemaVersion: number;    // Schema structural version (integer)
  readonly recordVersion: number;    // Monotonically increasing revision for optimistic concurrency
  readonly scope: StorageScope;      // 'application' | 'workspace'
  readonly workspaceId?: string;     // Workspace ID (required if scope === 'workspace')
  readonly payload: T;               // Strongly typed, validated domain DTO
  readonly checksum?: string;        // CRC32 hash of serialized payload for corruption detection
  readonly createdAt: number;        // Creation timestamp (epoch ms)
  readonly updatedAt: number;        // Last updated timestamp (epoch ms)
}
```

---

## 5. Concurrency & Write Ordering

### 5.1 Per-Key Serialized Write Queues
To eliminate race conditions caused by asynchronous interleaving (e.g., rapid sequential user typing or preference updates), `StorageService` maintains a per-key Promise execution queue. Writes targeting the same storage key are serialized deterministically in arrival order.

### 5.2 Optimistic Concurrency Control
For operations requiring conflict protection, callers may provide `expectedRecordVersion`. If the record's current version in storage differs from `expectedRecordVersion`, the write is rejected immediately with `StorageVersionConflictError`. On every successful write, `recordVersion` increments monotonically (`(existing?.recordVersion ?? 0) + 1`).

---

## 6. Atomic Write & Crash Safety

1. **Staged Atomic Writes:** In filesystem and storage adapters, records are written to a temporary staging key (`<key>__tmp`), verified for integrity, committed to the authoritative key, and the temporary key is removed.
2. **Crash-Safe Quarantine:** Incomplete or interrupted writes resulting in malformed JSON or checksum mismatches are quarantined (`qm_corrupted_<key>_<timestamp>`). The corrupted record is isolated to prevent infinite crash loops while preserving raw data for forensic recovery.

---

## 7. Storage Lifecycle & Health Monitoring

The storage subsystem reports live health state via `StorageService.getHealth()`:
- `uninitialized`: Created but awaiting startup initialization.
- `initializing`: Adapter testing and environment validation in progress.
- `ready`: Read/write operational, schema validation active.
- `degraded`: Operating under read-only mode or in-memory fallback.
- `recoveryRequired`: Checksum mismatch or corrupted record quarantined.
- `failed`: Adapter initialization failed.
- `shuttingDown`: Flushing pending write queues before process exit.
- `disposed`: Adapter closed, file/storage handles released; subsequent calls reject with `StorageDisposedError`.

---

## 8. Repositories (Domain Contracts)

| Repository | Scope | Contract Methods |
|---|---|---|
| `SettingsRepository` | Application & Workspace | `getUserSettings()`, `saveUserSettings()`, `getWorkspaceSettings()`, `saveWorkspaceSettings()` |
| `WorkspaceStateRepository` | Workspace & Application | `getWorkspaceMetadata()`, `saveWorkspaceMetadata()`, `getRecentWorkspaces()`, `saveRecentWorkspaces()` |
| `SessionStateRepository` | Workspace | `getWorkspaceSession()`, `saveWorkspaceSession()`, `clearWorkspaceSession()` |

UI components and domain features access persistence strictly through these repositories, maintaining clean architectural boundaries.
