# QM Editor Backup Architecture

## 1. Overview & Purpose
The Backup Architecture of QM Editor (Phase 05, Step 54) provides a local-first, safe preservation mechanism for application state, workspace definitions, settings, and optionally Local History. It protects users from application corruption, unexpected storage resets, machine migrations, or accidental configuration loss.

## 2. Core Separation of Concepts
QM Editor strictly separates the following persistence and lifecycle concepts:
- **Application Backup**: Complete snapshot of supported QM Editor state for safety preservation and disaster recovery.
- **Save**: Committing active editor buffer content to the authoritative filesystem.
- **Crash Recovery (Step 52)**: Ephemeral, crash-safe snapshots of unsaved editor buffers. Excluded from standard exports and backups to prevent polluting recovery sessions or overwriting valid files.
- **Local History (Step 53)**: Durable chronological timeline of explicit and automatic document revisions. Conditionally portable.
- **Git / SCM**: External source control system. QM Editor never treats backups as git commits or alters `.git` repositories.
- **Filesystem Project Files**: External-authoritative files. Backups preserve QM Editor metadata and configuration, never silently duplicating external repositories.

## 3. Data Domains & Portability Classification
Backups classify data domains systematically:
- `settings`: User preferences and non-secret configuration (Portable).
- `workspace`: Workspace definitions, roots, and metadata (Portable with path normalization).
- `recent`: Recent workspaces and opened resources (Optional).
- `history`: Local History manifests and snapshot diffs (Optional, user-toggled).
- `recovery`: Active crash recovery sessions (Restricted / Excluded from routine exports).
- `indexes`: Derived search indexes, quick open candidates (Derived / Rebuildable — excluded and invalidated/rebuilt upon restore).
- `temporary`: Locks, active process IDs, temp staging (Excluded).

## 4. Safety Preservation & Point-in-Time Consistency
- Backups perform consistent read snapshots of domain repositories.
- Integrity hashes are computed over payload records.
- Packages are assembled in a temporary staging model before atomic finalization.
- Prior to any destructive restore operation, a mandatory **Safety Backup** of the current application state is captured and preserved locally.

## 5. Security & Secret Exclusion
- Credential patterns (`apiKey`, `password`, `secret`, `private_key`, `token`, `credential`) are proactively sanitized and stripped.
- Backups are strictly local: no telemetry, cloud upload, or remote sync.
