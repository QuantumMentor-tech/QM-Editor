# QM Editor — Local History Storage Subsystem

## 1. Storage Organization & Key Namespaces

Local History is organized in the application storage scope under dedicated, non-overlapping prefixes:

| Category | Storage Prefix | Schema ID | Payload Type |
| :--- | :--- | :--- | :--- |
| **History Manifest** | `app:history:manifest:<wsId>:<encodedUri>` | `qm.history.manifest` | `LocalHistoryManifestDTO` |
| **History Snapshot** | `app:history:snapshot:<snapshotId>` | `qm.history.snapshot` | `LocalHistorySnapshotDTO` |

This layout ensures strict physical and logical separation from:
- `qm.recovery.*` (Step 52 crash recovery snapshots)
- `qm.workspace.index.*` (Step 51 derived search caches)
- `qm.settings.*` (Step 49 configuration state)
- `qm.document.metadata` (Step 48 document metadata)

---

## 2. Atomic Writes & Crash Safety

The writing lifecycle strictly follows a content-first sequence:

```text
1. Prepare Snapshot DTO (version, id, content, contentHash, createdAt)
      ↓
2. Atomic Write Snapshot to 'app:history:snapshot:<id>'
      ↓
3. Verify Snapshot was safely committed to storage
      ↓
4. Read current Manifest from 'app:history:manifest:<...>'
      ↓
5. Prepend new HistoryEntryDTO and apply Retention Policies (prune excess)
      ↓
6. Atomic Write updated Manifest
      ↓
7. Asynchronously delete pruned snapshot records from storage
```

If power fails between step 2 and step 6, an unreferenced snapshot remains in storage until routine maintenance, but the manifest never points to unwritten content.

---

## 3. Retention Policies & Quotas

- **Max Entries Per File**: Defaults to `50` (configurable between 5 and 200 via `history.maxEntriesPerFile`).
- **Retention Days**: Defaults to `30` (configurable between 1 and 365 via `history.retentionDays`).
- **Storage Cap**: Defaults to `100 MB` via `history.maxStorageBytes`.
- **Pruning Invariant**: Pruning always preserves at least the newest version of any tracked document regardless of expiration threshold.
