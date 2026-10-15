# QM Editor — Derived Data Storage & Cache Policy

## 1. Data Classification Tiers

QM Editor strictly classifies all application data into three distinct tiers:

| Tier | Classification | Examples | Loss Policy |
|---|---|---|---|
| **Tier 1** | **Authoritative State** | Saved source files on disk, user settings overrides, workspace configurations, document baseline revisions. | Irreplaceable. Never automatically cleared or overwritten by derived caches. |
| **Tier 2** | **Durable Continuity State** | Workspace open tabs, cursor locations, recent file history, navigation stacks. | Restorable continuity. Can be cleared by explicit user action; failure degrades continuity without data loss. |
| **Tier 3** | **Persistent Derived Data & Caches** | Workspace resource index, search candidate metadata, symbol outline caches, language word indexes. | **100% Rebuildable.** May be purged or invalidated at any time. Must never become project truth. |

---

## 2. The Rebuildability Principle

> **If any or all persistent derived data is deleted, QM Editor must remain fully functional and able to reconstruct it from authoritative physical sources.**

- Deleting `ws:${workspaceId}:resource_index` must never delete source files, settings, or document metadata.
- Corrupted cache records are immediately quarantined or discarded; they must never halt workspace startup.

---

## 3. Privacy & Security Rules

1. **No Source Code in Caches:** Derived index caches store only resource paths, names, types, sizes, modified timestamps, and advisory fingerprints. Full document bodies and syntax trees are forbidden.
2. **Local Confinement:** All cache data is persisted strictly through local storage adapters (IndexedDB/MemoryStorageAdapter).
3. **Inert Data:** Derived data structures cannot represent executable code, shell commands, or automated provider actions.
4. **Symlink Boundary Protection:** The resource index respects workspace root boundaries and cannot traverse symlinks outside the workspace.

---

## 4. Cache Retention & Eviction

- **Workspace Deletion:** When a workspace is deleted or closed, its derived index can be purged cleanly via `ResourceIndexRepository.deleteIndex(workspaceId)`.
- **Format Upgrades:** Upgrading index format versions does not require complex data migrations; outdated index formats are discarded and rebuilt cleanly from the live filesystem.
