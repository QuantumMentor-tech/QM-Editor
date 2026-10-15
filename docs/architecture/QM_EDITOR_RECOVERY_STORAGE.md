# QM Editor Recovery Storage Architecture
## Phase 05, Step 52 — Document Recovery, Autosave & Crash-Safe Unsaved Work Foundation

---

## 1. Storage Layout & Key Namespacing

Recovery data is classified as **Temporary Durable Data**. It resides in application-scoped persistent storage under dedicated prefixes to prevent collision with workspace or authoritative document state:

```text
Storage Keys:
  - app:recovery:active_session
    ├── Pointer to active/last runtime session
    └── Schema: qm.recovery.session (v1)

  - app:recovery:manifest:<sessionId>
    ├── Session manifest listing all dirty document candidates
    └── Schema: qm.recovery.manifest (v1)

  - app:recovery:snapshot:<recoveryId>
    ├── Temporary snapshot payload containing unsaved text and checksum
    └── Schema: qm.recovery.snapshot (v1)
```

---

## 2. Schema Definitions

### 2.1 Recovery Session Schema (`qm.recovery.session`, v1)
Tracks the active application lifecycle pointer to distinguish clean shutdowns from abnormal terminations:
```typescript
interface RecoverySessionDTO {
  sessionId: string;
  workspaceId?: string;
  startedAt: number;
  lastUpdatedAt: number;
  state: 'active' | 'clean' | 'candidate' | 'restored' | 'discarded';
  schemaVersion: number;
}
```

### 2.2 Recovery Manifest Schema (`qm.recovery.manifest`, v1)
Maintains document recovery ownership and metadata:
```typescript
interface RecoveryManifestDTO {
  version: number;
  sessionId: string;
  workspaceId?: string;
  startedAt: number;
  lastUpdatedAt: number;
  state: 'active' | 'clean' | 'candidate' | 'restored' | 'discarded';
  documents: RecoveryDocumentDTO[];
}
```

### 2.3 Recovery Snapshot Schema (`qm.recovery.snapshot`, v1)
Contains the actual recovered text buffer and cryptographic checksum:
```typescript
interface RecoverySnapshotDTO {
  version: number;
  recoveryId: string;
  sessionId: string;
  documentId: string;
  resourceUri?: string; // undefined for untitled
  isUntitled: boolean;
  documentRevision: number;
  recoveryGeneration: number;
  content: string;
  encoding: string;
  lineEnding: 'lf' | 'crlf' | 'cr';
  baseFileMetadata?: {
    path?: string;
    size?: number;
    modifiedAt?: number;
    fingerprint?: string;
  };
  checksum: string;
  createdAt: number;
}
```

---

## 3. Atomic Ordering & Integrity

To guarantee that incomplete writes never produce dangling references:

```text
Snapshot Write Sequence:
  1. Serialize content and compute SHA-256 / SHA-1 checksum.
  2. Write Recovery Snapshot to temporary durable storage.
  3. Validate snapshot write confirmed.
  4. Update Recovery Manifest with document entry.
  5. Commit Recovery Manifest atomically.
```

On startup discovery:
- If a manifest references a snapshot that does not exist or whose checksum fails, it is marked `decision = 'corrupt'` and safely quarantined without crashing the runtime.

---

## 4. Bounded Retention & Automatic Cleanup

Recovery data is strictly temporary:
- **Clean Shutdown**: Snapshots for saved/clean documents are removed during graceful shutdown.
- **Save Event**: Successfully saving a file immediately deletes its recovery snapshot.
- **Candidate Restoration**: Once restored into `DocumentEngine`, the temporary snapshot is discarded.
- **Explicit Discard**: User rejection immediately purges the snapshot.
- **Storage Limits**: Quotas prevent snapshots from consuming unbounded disk space (default 50MB maximum).
