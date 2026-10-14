# QM Editor — Persistent Settings, Preferences & Configuration Storage Architecture

## Phase 05 — Data & Storage Architecture (Step 49)

### 1. Architectural Authority & Overview

In QM Editor, configuration semantics and configuration persistence are strictly decoupled:

- **Settings System (`SettingsRegistry` & `SettingsService`)**: The **sole semantic authority** for setting definitions, default values, scopes, categories, data types, validation logic, sensitivity classification, precedence resolution, and change notifications.
- **Storage Subsystem (`SettingsRepository` & `StorageService`)**: The **sole durable persistence authority** for storing approved user and workspace configuration overrides, managing record versions, and ensuring safe serialization, deserialization, and schema migration.

```
Settings Definition / Registry (Semantic Authority)
            │
            ▼
       Settings Service (Precedence & Runtime Resolution)
            │
       ┌────┴────┐
       ▼         ▼
Application   Workspace
 Scope         Scope
       │         │
       └────┬────┘
            ▼
   Settings Persistence Contract (ISettingsRepository)
            │
            ▼
    Settings Repository (Record Versioning & Schemas)
            │
            ▼
      Storage Service (Atomic Writes & Health)
            │
            ▼
      Physical Storage (Memory / IndexedDB / LocalStorage)
```

The storage layer **never** decides default values, scope precedence, whether a setting exists, what a setting means, or what constitutes a valid value.

---

### 2. Scope & Precedence Rules

Configuration settings exist across three architectural tiers:

```
Default Value (Defined by SettingsRegistry)
      ↓
User Override (Stored in app:user_settings)
      ↓
Workspace Override (Stored in ws:{workspaceId}:settings)
      ↓
Effective Runtime Value (Resolved by SettingsService)
```

#### Precedence Order:
1. **Workspace Override**: Takes the highest precedence. Applies specifically to the currently active workspace.
2. **User Override**: Applies across all workspaces for the current user when no workspace override exists.
3. **Default Value**: Hardcoded in `SettingsRegistry`. Used when neither workspace nor user overrides exist.

---

### 3. Persist Overrides, Not Redundant Resolved State

To prevent stale configuration and bloated storage records:
- **Defaults are NEVER stored in persistent storage.** If a user has not modified a setting, no record entry exists for that key.
- **Resolved values are NEVER stored.** Only explicit user overrides (`UserSettingsDTO`) and workspace overrides (`WorkspaceSettingsDTO`) are persisted.
- **Resetting a setting physically removes its override.** Resetting deletes the key from the persisted override map. The setting immediately resolves to the lower-precedence tier (user override or registry default).

---

### 4. Workspace Isolation & Generational Safety

Workspace configuration is strictly isolated by canonical workspace identifier:
- User settings are stored at `app:user_settings` (`qm.settings.user`).
- Workspace settings are stored at `ws:{workspaceId}:settings` (`qm.settings.workspace`).
- Setting a workspace override in Workspace A will **never** contaminate Workspace B.
- Switching workspaces uses **generational tracking (`currentWorkspaceGeneration`)**: if an asynchronous load for Workspace A finishes after Workspace B has already become active, the late load is discarded immediately to prevent state pollution.

---

### 5. Sensitive & Secret Settings Boundary

Settings that store credentials, tokens, API keys, or passwords must **never** be persisted in ordinary plaintext settings storage:
- Marked with `sensitive: true` on `SettingDefinition`.
- Identified automatically by `settingsRegistry.isSensitive(key)` (checks for keywords: `secret`, `token`, `password`, `apikey`, `api_key`, `credential`).
- `SettingsService.set()` and `setAsync()` actively reject writes for sensitive keys with an explicit error.
- Sensitive keys are automatically redacted from `exportSettings()`.
- Diagnostic and debug loggers redact sensitive setting values.

---

### 6. Validation on Write & Validation on Load

#### Validation on Write:
- Before any setting is updated in memory or written to storage, `SettingsService.validateValue(def, value)` validates the data against the registered type, options, ranges (`min`/`max`), or custom validation functions.
- If validation fails, the write is aborted, storage is untouched, and an error is returned.

#### Validation on Load:
- When loading settings from `SettingsRepository` during startup or workspace switch, each stored entry is validated against `SettingsRegistry`.
- If a stored value is invalid (e.g. corrupted manually or from an older incompatible version), it is safely discarded with a warning, falling back to the default value.
- The application will **never crash** due to an invalid stored setting.

---

### 7. Concurrency, Debouncing & Flush

- **Synchronous Getters**: `get()`, `getUserValue()`, and `getWorkspaceValue()` operate synchronously from in-memory cache for 60fps UI performance.
- **Coalesced Debounced Persistence**: `set()` triggers an immediate in-memory update and event notification, while queuing a debounced write (50ms) to prevent storage thrashing on rapid slider or input events.
- **Confirmed Asynchronous Persistence**: `setAsync()` allows callers to await confirmed durable write to storage with automatic rollback if storage persistence fails.
- **Flush on Shutdown**: `SettingsService.flush()` flushes all pending debounced writes before application shutdown or workspace switching.
