# QM Editor Backup, Import & Portability UX

## 1. Overview
The Backup & Portability UI provides a dedicated, accessible interface (`BackupPortabilityModal`) accessible via:
- Keybinding: `Mod+Alt+B`
- Command Palette:
  - `backup.createBackup`: "Backup: Create Full Application Backup"
  - `backup.exportSettings`: "Backup: Export Settings & Preferences"
  - `backup.importPackage`: "Backup: Import Backup or Export Package"
  - `backup.openModal`: "Backup: Open Backup & Data Portability Center"

## 2. Modal Workflow & Views
1. **Tabs**:
   - **Create Backup**: Allows toggling full application state vs. settings only, with a toggle for Local History inclusion. Triggers deterministic export and JSON file download.
   - **Import & Restore**: Provides package file upload, automatic structural & security validation, import plan generation, conflict preview, strategy selection (`merge` vs. `replace`), and explicit confirmation before applying.
   - **Safety Backups**: Lists safety snapshots taken prior to destructive restore operations, allowing inspection and rollback.
2. **Conflict Resolution UI**:
   - Surfaces individual key conflicts (e.g. current value vs. incoming value).
   - Allows choosing resolution strategy before execution.
3. **Accessibility**:
   - Fully keyboard-navigable (`Tab`, `Shift+Tab`, `Enter`, `Escape`).
   - Accessible roles (`dialog`, `tablist`, `tab`, `tabpanel`).
   - High-contrast visual cues and descriptive error announcements.
