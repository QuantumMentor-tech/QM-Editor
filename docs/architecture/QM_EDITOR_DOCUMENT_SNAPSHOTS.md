# QM Editor — Document Snapshots & Versioned Content Model

## 1. Snapshot Content Model

A **Document Snapshot** (`LocalHistorySnapshotDTO`) represents the immutable textual content of a document at a specific point in time. It is stored independently from document manifests to enable lightweight index loading and lazy content retrieval.

```typescript
export interface LocalHistorySnapshotDTO {
  readonly version: number;       // Schema version (currently 1)
  readonly id: string;            // Unique snapshot key (e.g. hist_<timestamp>_<random>)
  readonly content: string;       // Historical text payload
  readonly contentHash: string;   // Cryptographic SHA-256 checksum
  readonly createdAt: number;     // Millisecond timestamp
}
```

---

## 2. History Entry & Manifest Metadata

Each tracked document maintains a single manifest (`LocalHistoryManifestDTO`) containing chronological entries sorted newest first:

```typescript
export interface LocalHistoryEntryDTO {
  readonly id: string;                          // Snapshot ID
  readonly resourceUri: string;                 // Canonical resource URI
  readonly workspaceId?: string;                // Owning workspace ID
  readonly documentId?: string;                 // Active runtime document ID
  readonly createdAt: number;                   // Creation timestamp
  readonly source: LocalHistorySource;          // 'manual' | 'save' | 'preRestore' | ...
  readonly documentRevision: number;            // Revision at snapshot time
  readonly contentHash: string;                 // Content SHA-256
  readonly contentSize: number;                 // Length in UTF-16 code units / bytes
  readonly encoding: string;                    // Document encoding (e.g. 'utf-8')
  readonly lineEnding: 'lf' | 'crlf' | 'cr';    // Line ending convention
  readonly languageId: string;                  // Resolved language ID
  readonly label?: string;                      // Optional human-readable checkpoint label
}
```

---

## 3. Checksum Verification & Tamper Detection

1. **Computation**: Every snapshot write generates a deterministic SHA-256 hash via `StorageSerializer.computeChecksum()`.
2. **Validation on Read**: Before previewing or restoring any historical snapshot, `LocalHistoryCoordinator` recomputes the checksum of the stored string against `snapshot.contentHash`.
3. **Corruption Isolation**: If a checksum mismatch is detected, the entry is marked invalid (`valid = false`), restore is rejected, and an operational issue is recorded without corrupting active document buffers or crashing the editor.
