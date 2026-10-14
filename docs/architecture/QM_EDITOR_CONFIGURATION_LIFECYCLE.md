# QM Editor — Configuration Lifecycle Architecture

## Phase 05 — Data & Storage Architecture (Step 49)

### 1. Lifecycle Overview

The configuration lifecycle coordinates how settings are loaded, validated, resolved, modified, persisted, migrated, and flushed across application boot, runtime operation, workspace switches, and shutdown:

```
Application Start
       │
       ▼
Storage Service Ready
       │
       ▼
Settings Service Initialization
       ├── Read app:user_settings from SettingsRepository
       ├── Validate each stored setting against SettingsRegistry
       ├── Discard invalid entries (fallback to default)
       └── Preserve unknown keys safely
       │
       ▼
Application Runtime Ready (UI renders with resolved defaults & user overrides)
       │
       ▼
Workspace Opens (workspace.opened)
       ├── Read ws:{workspaceId}:settings from SettingsRepository
       ├── Apply generation protection against concurrent switches
       ├── Validate workspace overrides against SettingsRegistry
       ├── Compute effective changes across scope precedence
       └── Emit settingChanged events for differences
       │
       ▼
Runtime Modifications
       ├── User / UI updates setting via SettingsService.set()
       ├── Validate value against definition (reject if invalid)
       ├── Check sensitivity boundary (reject if sensitive)
       ├── Optimistically update in-memory state & notify UI immediately
       └── Debounce / Coalesce write to durable storage repository
       │
       ▼
Workspace Switch
       ├── Flush pending writes for outgoing workspace
       ├── Increment workspace generation counter
       ├── Fetch new workspace overrides asynchronously
       ├── Drop results if workspace generation changed mid-flight
       └── Recompute effective settings & emit change events
       │
       ▼
Application Shutdown
       ├── SettingsService.flush() flushes all pending debounced writes
       └── StorageService shuts down cleanly
```

---

### 2. Startup Phase & Bootstrap Configuration

1. **Bootstrap Phase**: Before storage is initialized, `SettingsService` provides synchronous access to registered default values. No UI component blocks on disk access for initial render.
2. **Durable Storage Connection**: Once `StorageService` initializes, `ApplicationRuntime` invokes `SettingsService.initialize()`.
3. **Legacy Migration**: If `SettingsRepository` has no stored user settings, `SettingsStorage` (legacy `localStorage`) is inspected. If legacy preferences are discovered, they are migrated and saved into the durable repository automatically.

---

### 3. Runtime Changes & Commit Strategies

QM Editor implements two coordinated commit strategies:

- **Strategy A (Immediate Response with Debounced Persistence)**:
  - Invoked via `SettingsService.set(key, value, scope)`.
  - Used by UI components, sliders, and form fields for instantaneous 60fps feedback.
  - Runtime cache updates immediately; change event emits immediately.
  - Background writer coalesces rapid changes (50ms window) and persists to `SettingsRepository`.
- **Strategy B (Confirmed Durability with Rollback on Failure)**:
  - Invoked via `SettingsService.setAsync(key, value, scope)`.
  - Used for critical settings updates, imports, and automated tests.
  - Awaits confirmation from `SettingsRepository`.
  - If storage fails (e.g. read-only storage or disk error), the in-memory update is rolled back to the previous value, and an error is returned.

---

### 4. Workspace Switch & Stale Operation Protection

- When switching from Workspace A to Workspace B:
  - Pending debounced writes for Workspace A are flushed immediately.
  - A new generation ID (`currentWorkspaceGeneration++`) is issued.
  - If a delayed network/disk load for Workspace A completes after Workspace B is active, the generation check discards the stale data.
  - Workspace A configuration never contaminates Workspace B.

---

### 5. Application Shutdown

During application shutdown:
- The `ApplicationRuntime` invokes the `dispose()` hook of the `settings` service.
- `SettingsService.flush()` clears any pending debounced timers and immediately awaits all in-flight persistence operations.
- All configuration changes are guaranteed durable before storage adapter teardown.
