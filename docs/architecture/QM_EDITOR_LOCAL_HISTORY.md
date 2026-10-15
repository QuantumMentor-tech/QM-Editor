# QM Editor — Local History Architecture

## 1. Overview & Purpose

The **Local History Subsystem** provides a safe, durable, privacy-conscious historical record of previous versions of document content in durable local application storage. It empowers users to inspect, compare, and recover earlier states of their work without relying on external version control systems or ephemeral memory buffers.

Local History is strictly distinguished from other subsystems:
- **Local History ≠ Editor Undo/Redo**: Undo/Redo manages transient in-memory `EditTransaction` stacks within active editing sessions.
- **Local History ≠ Crash Recovery (Step 52)**: Crash Recovery snapshots are temporary safety records of unsaved work tied to abnormal application termination. Local History entries represent explicitly retained historical checkpoints that persist across sessions.
- **Local History ≠ Autosave**: Autosave creates temporary recovery copies and does not create a historical version on every timer tick.
- **Local History ≠ Filesystem Authority**: Restoring a historical snapshot updates the in-memory `DocumentEngine` via `applyTransaction`, marks the document `isDirty = true`, and preserves the physical filesystem file untouched until the user explicitly saves.
- **Local History ≠ Git / Cloud / Telemetry**: Local History is 100% local, bounded, and private. No content is uploaded, analyzed by AI/LLMs, or logged.

---

## 2. Logical Architecture

```text
Filesystem Authority
      │
      ▼
Document Engine (Active Model & Lifecycle)
      │
      ├───────────────────────► Document Saved / Save As Event
      │                                    │
      ▼                                    ▼
Local History Coordinator ◄────────────────┘
      │
      ├── Policy Engine (Coalescing, Retention Limits, Pruning)
      ├── Snapshot Builder (Checksum Verification, Metadata Extraction)
      │
      ▼
Local History Repository (ILocalHistoryRepository)
      │
      ▼
Storage Service (Application Scope Namespace: 'history:manifest:', 'history:snapshot:')
      │
      ▼
Storage Adapter (IndexedDB / SQLite / Memory)
```

---

## 3. Semantic Boundaries & Invariants

1. **Non-Blocking Execution**: Local History snapshot persistence or storage failures must never fail or block ordinary typing, editing, or document saving.
2. **Safe Restoration Flow**: Restoring historical versions requires explicit user confirmation, creates a pre-restore safety snapshot of live content, and applies changes via an `EditTransaction`.
3. **Deterministic Coalescing**: Consecutive saves with identical content hash are automatically suppressed to prevent duplicate entries.
4. **Bounded Retention**: Enforces configurable file limits (`history.maxEntriesPerFile`, default: 50) and age limits (`history.retentionDays`, default: 30) with automatic pruning of obsolete snapshots.
5. **Workspace Scoping & Privacy**: Manifests and snapshots are partitioned by canonical resource URI and optional workspace identifier, preventing cross-workspace leakage.
