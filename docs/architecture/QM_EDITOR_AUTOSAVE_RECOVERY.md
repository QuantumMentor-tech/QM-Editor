# QM Editor Autosave & Recovery Snapshotting Architecture
## Phase 05, Step 52 — Document Recovery, Autosave & Crash-Safe Unsaved Work Foundation

---

## 1. Autosave vs Normal Save Distinction

A critical architectural distinction in QM Editor is the boundary between **Autosave** and **Normal Save**:

```text
Recovery Autosave
    =
Writes a temporary durable recovery snapshot into protected recovery storage.
Never modifies the user's real file on the filesystem.

Normal Save
    =
Writes authoritative user content directly to the target filesystem resource.
Requires explicit user command (e.g. Ctrl+S) or explicit user-configured auto-save mode.
```

Step 52's autosave infrastructure is primarily **crash-safe safety snapshotting**. It protects unsaved dirty documents from unexpected process termination without silently mutating the filesystem behind the user's back.

---

## 2. Event Triggers & Scheduling

The recovery autosave coordinator subscribes to canonical `DocumentEngine` events:

```text
DocumentEngine Events:
  - document.changed       ──┐
  - document.dirtyChanged   ─┴─► If doc.isDirty: schedule debounced snapshot
  - document.saved          ───► Cancel pending timer; clean obsolete snapshot
  - document.closed         ───► Cancel pending timer; clean obsolete snapshot
  - document.resourceChanged ──► Re-evaluate resource association (Save As)
```

### Scheduling Flow
1. User types in editor -> `DocumentEngine.updateText(...)` marks document dirty (`isDirty = true`).
2. Event `document.changed` is emitted.
3. `DocumentRecoveryCoordinator.scheduleAutoSave(doc)` is invoked:
   - Resets any existing timer for that document.
   - Increments `documentRecoveryGeneration` monotonically.
   - Sets a timer for `autoSaveDelayMs` (configurable via `files.autoSaveDelay`, default 1000ms).

---

## 3. Write Coalescing

Rapid typing should never cause uncontrolled disk writes:

```text
500 keystrokes in rapid succession
                 │
                 ▼
Debounce timer reset on each edit
                 │
                 ▼
Quiet period elapsed (e.g. 1000ms)
                 │
                 ▼
Single atomic recovery snapshot written
```

Only after the user pauses editing for the duration of the configured quiet period is a snapshot persisted.

---

## 4. Concurrency & Stale Race Protection

To prevent asynchronous write races where an earlier edit finishes after a later edit:

```text
Edit A (Gen 10) begins snapshot write
               │
Edit B (Gen 11) begins snapshot write
               │
Gen 11 finishes write and updates manifest
               │
Gen 10 finishes later
               ▼
Pre/Post-write Generation Check:
Gen 10 detects targetGen (10) < currentGen (11)
               ▼
Gen 10 snapshot write aborted!
Newer state remains authoritative.
```

---

## 5. Cancellation Invariants

Autosave timers are immediately cleared and superseded when:
1. **Document is Saved**: When `document.saved` fires, any pending snapshot timer is cancelled, and the existing temporary recovery snapshot in storage is deleted because the filesystem now safely contains the authoritative content.
2. **Document is Closed**: When a document is closed, pending timers are cancelled. If the document was clean when closed, its recovery snapshot is deleted.
3. **Document Becomes Clean**: If undo/redo returns the buffer to the saved baseline content, the pending timer is cancelled.

---

## 6. Storage Failure Resilience

Recovery snapshotting is protective infrastructure, not a prerequisite for editing:
- If a snapshot write fails (disk full, I/O error, permissions issue):
  - Coordinator logs a warning and marks subsystem health as `degraded`.
  - **The user's active editing, typing, undo/redo, and manual Save operations are NEVER blocked or broken.**
  - The editor remains fully functional.
