# QM Editor Document Recovery Architecture
## Phase 05, Step 52 — Document Recovery, Autosave & Crash-Safe Unsaved Work Foundation

---

## 1. Primary Purpose & Scope

The **Document Recovery Subsystem** provides a production-grade, crash-safe persistence layer for **unsaved document content** in QM Editor. Its primary objective is protecting users against abnormal application termination, power outages, OS kills, and hardware failures, ensuring that work in progress is not lost.

### The Fundamental Rule
> **Recovery protects unsaved work. It must never silently replace authoritative filesystem content.**

---

## 2. Critical Distinctions: Authority vs Recovery vs History

Step 52 strictly establishes four distinct data categories:

```text
1. Normal saved document
   = Filesystem authority (canonical truth)

2. Unsaved live document
   = DocumentEngine / Editor authority (in-memory buffer)

3. Recovery snapshot
   = Temporary durable safety copy (protective recovery buffer)

4. Local History (Out of Scope)
   = Multi-version historical content/diff archive

5. Persistent Undo (Out of Scope)
   = Multi-step editor mutation transaction history
```

The recovery subsystem implements category 3 only. It does not replace the filesystem, it does not act as an infinite version history archive, and it does not store undo stacks.

---

## 3. High-Level Architecture Flow

```text
Editor / Document Engine
          │
          ▼
   Recovery Coordinator
          │
          ▼
   Recovery Snapshot
          │
          ▼
 Temporary Durable Storage
          │
          ▼
 Recovery Manifest
          │
          ▼
 Application Restart
          │
          ▼
 Recovery Detection (Abnormal Termination?)
          │
          ▼
 Candidate Evaluation (Compare Base vs Current Disk)
          │
          ▼
 User Decision / Safe Restore
          │
          ▼
 Document Engine (Loaded as Dirty Document)
          │
          ▼
 Explicit User Save (Committed to Real Disk)
```

---

## 4. Session Identity & Crash Detection

### 4.1 Session Identity
Each application invocation generates an immutable runtime session identifier:
```text
sessionId = "session_" + Date.now() + "_" + randomSuffix
```
This distinguishes the current running session from previous unconfirmed or crashed sessions.

### 4.2 Clean Shutdown Tracking
1. **Startup**: An active session record (`qm.recovery.session`) and manifest (`qm.recovery.manifest`) are committed with state `'active'`.
2. **Normal Shutdown**: When `markSessionClean()` is invoked, obsolete snapshots are deleted and the session record and manifest are marked with state `'clean'`.
3. **Abnormal Termination Detection**:
   - If a previous session pointer exists with state `'active'` (or not `'clean'`), the system recognizes an unconfirmed lifecycle event.
   - It discovers candidates from that unconfirmed session manifest without assuming certainty (using language such as *"recovery candidates found"* rather than declaring a crash).

---

## 5. Candidate Evaluation & Decision States

Before offering or restoring a recovery snapshot, `DocumentRecoveryCoordinator` inspects both the recovery snapshot and current filesystem state to classify the situation into one of eight deterministic decision states:

| Decision State | Meaning | Safety Action |
| :--- | :--- | :--- |
| `no_recovery_needed` | Snapshot content matches current disk content or saved baseline | No action required; safe to clean up. |
| `recovery_available` | Disk file matches snapshot base timestamp; snapshot contains newer unsaved edits | Safe candidate presented for user-controlled restoration. |
| `disk_newer` | Disk file was modified externally after snapshot base state | Disk has changed; do not overwrite disk. |
| `conflict` | Both recovery snapshot and disk file were modified after the base state | Conflict detected; preserves both states safely. |
| `original_missing` | Disk file at `resourceUri` no longer exists on disk | Safe restoration as untitled/recovered without silently recreating disk file. |
| `untitled_recovery` | Unsaved draft with no backing disk path (`untitled:`) | Restores into new untitled document; marks dirty. |
| `corrupt` | Snapshot record missing or failed integrity checksum validation | Rejected from restoration; diagnostic issue logged. |
| `stale` | Superseded by newer generation or expired past retention limits | Pruned according to bounded storage retention policy. |

---

## 6. Safe Restoration Semantics

### 6.1 Existing File Restoration
1. Opens the target resource via `DocumentEngine.openResource(...)`, reading the authoritative disk baseline into `savedBaselineContent`.
2. Updates content via `DocumentEngine.updateText(doc.id, snapshot.content, 'recovery')`.
3. **The physical file on disk is left completely untouched.**
4. Document is marked `isDirty = true`.
5. An explicit manual Save by the user is required to write recovered content to the filesystem.

### 6.2 Untitled Document Restoration
1. Calls `DocumentEngine.createUntitled(...)` with recovered content.
2. Assigns a dedicated recovery document title (e.g. `Recovered <Time>`).
3. No fake filesystem path or dummy disk file is invented.
4. Document is opened as `isDirty = true`.

---

## 7. Security, Privacy & Storage Quotas

1. **Local Privacy**: Recovery snapshot payloads are strictly stored in designated local application storage. They are never transmitted over the network and never included in telemetry.
2. **No Source Logging**: Recovery snapshot source text is never logged to debug logs or error reports.
3. **Bounded Storage**: Quotas enforce maximum retention (default 24 hours) and storage capacity limits (default 50MB) to prevent unbounded disk accumulation.
4. **Resilience**: If recovery snapshot storage fails, editing and normal saving in QM Editor continue without interruption.
