# QM Editor — Authoritative Data Classification Inventory
**Phase 05 — Data & Storage Architecture**
**Step 46 of 135 — Foundation, Persistence Boundaries & Schema Governance**

---

## 1. Classification Categories

Every data structure in QM Editor belongs to exactly one classification:

1. **Persistent:** Must survive application restart. Represents durable user configuration, project metadata, or bounded history.
2. **Session:** Survives only across an active runtime session for UI continuity.
3. **Derived:** Calculated on demand from authoritative data; never stored as primary source of truth.
4. **Cache:** Rebuildable performance optimizations. Discardable at any time without data loss.
5. **Temporary:** Short-lived operational files (e.g., atomic write swaps).
6. **External-Authoritative:** Owned by the host OS filesystem, Git, language daemons, or compilers. Never duplicated as local truth.

---

## 2. Authoritative Data Inventory

| Data Category | Authority | Classification | Storage Location | Retention | Sensitivity | Rebuildable? | Migrations? | Recovery Priority |
|---|---|---|---|---|---|---|---|---|
| **User Settings** | `SettingsService` | Persistent | `app:user_settings` | Indefinite | Low | No | Yes (v1→v2) | Critical |
| **Workspace Settings** | `SettingsService` | Persistent | `ws:<id>:settings` | Workspace Lifetime | Low | No | Yes | High |
| **Workspace Metadata** | `WorkspaceEngine` | Persistent | `ws:<id>:metadata` | Workspace Lifetime | Low | No | Yes | Critical |
| **Recent Workspaces** | `RecentWorkspacesService` | Persistent | `app:recent_workspaces` | Bounded (10 items) | Low | No | Yes | Medium |
| **Recent Documents** | `RecentDocumentsService` | Persistent | `app:recent_documents` | Bounded (20 items) | Medium (Paths) | No | Yes | Medium |
| **Workspace Session** | `SessionService` | Session / Persistent | `ws:<id>:session` | Until Cleared / Closed | Medium (Paths) | Yes | Yes | Medium |
| **Open Document Text** | `DocumentEngine` | Session / Memory | Memory (CodeMirror) | Active Tab Lifetime | High (Code) | From Disk | No | High |
| **Saved File Content** | Filesystem | External-Authoritative | Physical Disk / FileSystem | External | High (Code) | Host OS | N/A | Highest |
| **Editor Cursor & Selection** | `EditorCoordinationService` | Session | Memory / Session DTO | Session Lifetime | Low | Yes | No | Low |
| **Navigation Back/Forward** | `NavigationCoordinator` | Session | Memory Stack (Bounded 50) | Session Lifetime | Low | Yes | No | Low |
| **Diagnostics & Problems** | `DiagnosticsEngine` | Derived / Cache | Memory Collections | Process Lifetime | Low | Yes (Re-lint) | No | Low |
| **Document Symbols** | `SymbolEngine` | Derived / Cache | Memory Index | Process Lifetime | Low | Yes (Re-parse) | No | Low |
| **Quick Open Index** | `WorkspaceIndexService` | Cache | Memory Index | Workspace Lifetime | Low | Yes (Re-scan) | No | Low |
| **Workspace Search Index** | `WorkspaceSearchService` | Cache | Memory Cache | Query Lifetime | Low | Yes | No | Low |
| **Terminal Processes** | `TerminalService` | Session / Process | Host OS PTY | Process Lifetime | High (Env) | No (Restart) | No | Medium |
| **Task Definitions** | `TaskService` | External-Authoritative | `tasks.json` / Filesystem | External | Low | From Disk | No | High |
| **Git Working Tree Status** | `SourceControlService` | External-Authoritative | Git CLI / `.git/` | External | Low | Git CLI | N/A | High |
| **Completion Suggestions** | `LanguageIntelligence` | Derived / Cache | Memory Cache | Request Lifetime | Low | Yes | No | Low |
| **Hover & Signature Hints** | `LanguageIntelligence` | Derived | Memory | Request Lifetime | Low | Yes | No | Low |
| **Safe Write Staging** | `FileService` / Storage | Temporary | `*.tmp` / Staging keys | Operation Lifetime | Low | Disposable | No | Low |
| **Corrupted Record Backup** | `StorageService` | Persistent (Quarantine) | `qm_corrupted_*` | Manual / 30 Days | Medium | No | No | High |
| **Runtime Logs** | `Logger` | Operational | Console / Memory Ring Buffer | Bounded (1000 lines) | Medium (Sanitized) | Disposable | No | Low |
| **API Keys & Credentials** | Security Boundary | Prohibited from Plaintext | OS Keychain (Future Phase) | Protected | Extreme | No | Special | Critical |

---

## 3. Data Governance Rules

1. **No Silent Data Retention:** Derived data and transient caches must never be converted into persistent storage without explicit schema registration and retention limits.
2. **Rebuildability Test:** If a dataset is labeled `Cache` or `Derived`, deleting its storage must result in zero data loss, with the application cleanly reconstructing it upon next access.
3. **External Truth Rule:** QM Editor never attempts to become the authority for filesystem content or Git repository state. Stored records only reference filesystem URIs, never duplicate entire disk trees.
