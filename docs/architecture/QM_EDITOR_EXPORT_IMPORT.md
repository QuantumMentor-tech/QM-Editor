# QM Editor Export, Import & Staging System

## 1. Export Architecture
Exports represent deliberate, portable packages of selected QM Editor state:
- **Settings Export (`settingsExport`)**: Portable user preferences and configurations. Excludes secrets and machine-specific file paths.
- **Workspace Export (`workspaceExport`)**: Workspace metadata, folder roots, and configuration.
- **Local History Export (`historyExport`)**: Document snapshot manifests and delta history.
- **Full Backup (`fullBackup`)**: Consolidated snapshot across settings, workspaces, history, and recent resources.

## 2. Import Security Model & Staging Pipeline
Incoming packages are treated as untrusted input. The import pipeline executes strictly as follows:
```text
Select/Load Envelope
       ↓
Staging Validation (PackageValidator)
   - Manifest presence & format version
   - Path traversal prevention (../, ..\, absolute paths, drive letters, UNC paths)
   - Bomb protection (entry count, max file size, total package size)
   - Integrity checksum verification
       ↓
Schema Migration (PackageMigrator)
   - Adapt legacy formatVersion to current formatVersion
       ↓
Import Planning (generateImportPlan)
   - Domain analysis
   - Conflict detection (local vs. incoming keys, workspace identities)
       ↓
User Confirmation & Strategy Selection (merge | replace | skip)
       ↓
Safety Backup Generation
       ↓
Staged Application
   - Apply domain-by-domain via authoritative domain repositories
   - Invalidate derived caches (workspace indexes, search index)
       ↓
Operation Result & Audit Report
```

## 3. Conflict Resolution Strategies
- **`merge` (default)**: Non-conflicting keys are merged; incoming keys override local keys if conflicts are accepted.
- **`replace`**: Entire target domain state is replaced with package contents.
- **`skip`**: Incoming conflicting keys are ignored, preserving local state.
