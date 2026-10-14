# QM Editor — Storage Error Recovery, Integrity & Fault Tolerance
**Phase 05 — Data & Storage Architecture**
**Step 46 of 135 — Foundation, Persistence Boundaries & Schema Governance**

---

## 1. Overview

Persistence failures in desktop applications can stem from process termination, power loss, disk quota exhaustion, permission restrictions, or file corruption. The **Storage Recovery & Fault Tolerance Subsystem** guarantees that storage failures do not crash the host editor, corrupt unrelated data, or cause silent data loss.

---

## 2. Failure Modes & Recovery Procedures

### 2.1 Storage Initialization Failure
- **Trigger:** Browser security blocks `localStorage` / `IndexedDB`, or the OS denies filesystem read/write access.
- **Handling:** `StorageService` catches the initialization exception, switches the active adapter to `MemoryStorageAdapter`, records an error issue in `StorageHealthReport`, and transitions the health state to `degraded`.
- **User Impact:** The editor remains fully functional for the active session. The user is informed via the central Feedback service that persistence is operating in temporary memory mode.

### 2.2 Data Corruption & Checksum Mismatch
- **Trigger:** A stored JSON record is truncated due to a power cut, manually edited outside the application, or corrupted on disk.
- **Handling:**
  1. `StorageSerializer.computeChecksum()` calculates the CRC32 hash of the deserialized payload and compares it against `record.checksum`.
  2. If the checksum does not match, or `JSON.parse` fails with a SyntaxError, the record is immediately quarantined.
  3. The corrupted content is relocated to a timestamped quarantine key: `qm_corrupted_<key>_<timestamp>`.
  4. The corrupted key is deleted from the active namespace so that subsequent reads do not enter an infinite failure loop.
  5. Storage health updates to `recoveryRequired` with a descriptive health issue.
  6. The read operation throws `StorageCorruptDataError` or returns `null` based on caller options.

### 2.3 Migration Failure
- **Trigger:** A custom migration function throws an exception or the migrated payload fails target schema validation.
- **Handling:**
  1. The migration pipeline aborts immediately before modifying the persistent record.
  2. The original stored record remains untouched at its previous schema version.
  3. `StorageMigrationError` is thrown, detailing the schema ID, failed step, and error details.
  4. Partial or corrupted schema states are never written to storage.

### 2.4 Quota Exceeded & Read-Only Storage
- **Trigger:** Disk space is exhausted, or the browser raises `QuotaExceededError`.
- **Handling:**
  1. `LocalStorageAdapter` catches `QuotaExceededError` (error code 22).
  2. The adapter marks its state as `readOnly = true`.
  3. `StorageService` transitions its health status to `degraded`.
  4. Subsequent write attempts immediately throw `StorageReadOnlyError`.
  5. The UI surfaces an alert instructing the user to free disk space or clean old caches. Existing data is protected from partial truncation.

### 2.5 Interrupted Writes (Crash Safety)
- **Trigger:** Application crash or sudden process termination during write.
- **Handling:**
  1. All writes execute via a two-phase staging commit: `<key>__tmp` is written first.
  2. Only when the temporary write succeeds is the authoritative key overwritten.
  3. Incomplete writes leave only orphaned `*__tmp` records, which are cleaned upon the next startup sweep. The authoritative key is never left in a half-written state.

---

## 3. Storage Health Diagnostics API

System operators and internal diagnostics inspect storage reliability via `globalStorageService.getHealth()`:

```typescript
export interface StorageHealthReport {
  readonly state: StorageHealthState;        // 'ready' | 'degraded' | 'recoveryRequired' | 'failed'
  readonly adapterName: string;              // e.g. 'LocalStorageAdapter' | 'MemoryStorageAdapter'
  readonly isReadOnly: boolean;              // Indicates if disk quota or permissions block writes
  readonly activeMigrations: number;         // Count of currently executing migrations
  readonly corruptedRecordCount: number;     // Total quarantined corrupted records
  readonly lastCheckedAt: number;            // Timestamp of last health check
  readonly issues: StorageHealthIssue[];     // Bounded ring buffer of recent warnings/errors
}
```

---

## 4. Recovery Limitations

1. **Hostiles Outside the Sandbox:** QM Editor cannot repair physically corrupted disk sectors. Quarantining protects the application runtime from crashing, but physically missing bits cannot be mathematically synthesized.
2. **Crash Journaling:** Step 46 establishes the crash-safe persistence and staging boundary. Transactional WAL (Write-Ahead Logging) and disk-level history journaling are deferred to subsequent Phase 05 steps (Steps 47–50).
