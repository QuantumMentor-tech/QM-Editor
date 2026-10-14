# QM Editor — Settings Schema & Migration Specification

## Phase 05 — Data & Storage Architecture (Step 49)

### 1. Overview & Schemas

The settings persistence layer governs two distinct schema domains registered in `SchemaRegistry`:

| Schema ID | Storage Scope | Key Format | Description | Current Version |
| :--- | :--- | :--- | :--- | :--- |
| `qm.settings.user` | `application` | `app:user_settings` | Global user configuration overrides | `1` |
| `qm.settings.workspace` | `workspace` | `ws:{workspaceId}:settings` | Workspace-specific configuration overrides | `1` |

Both schemas are represented as key-value dictionaries (`Record<string, unknown>`) where keys correspond to registered dot-delimited configuration paths (e.g. `editor.fontSize`, `appearance.theme`).

---

### 2. Envelope Specification

Settings records are encapsulated within standard `StoredRecord<T>` envelopes by `StorageService`:

```json
{
  "key": "app:user_settings",
  "schemaId": "qm.settings.user",
  "schemaVersion": 1,
  "recordVersion": 4,
  "scope": "application",
  "payload": {
    "editor.fontSize": 16,
    "appearance.theme": "dark",
    "editor.tabSize": 4
  },
  "checksum": "a1b2c3d4...",
  "createdAt": 1728900000000,
  "updatedAt": 1728900500000
}
```

- **`schemaVersion`**: Tracks the structural format of the settings dictionary. Incremented when setting schemas or types change across releases.
- **`recordVersion`**: Monotonically increasing counter incremented on every storage write to prevent stale/concurrent writes via optimistic concurrency checks (`expectedRecordVersion`).
- **`checksum`**: SHA-256 hash verifying data integrity and guarding against silent corruption.

---

### 3. Unknown & Removed Settings Policy

- **Unknown Settings**:
  - If a stored settings dictionary contains keys not currently recognized by `SettingsRegistry` (for example, settings defined by an uninstalled or future plugin):
  - They are **preserved** in the stored record so that user data is not lost.
  - They are excluded from runtime setting queries via `get()` (which returns `undefined` and logs a warning).
  - They are preserved during export so configurations remain portable.
- **Removed Settings**:
  - When a setting is formally deprecated and removed from QM Editor:
  - An explicit migration in `MigrationRegistry` deletes the obsolete key or transforms it to a replacement key.
  - Stored records are automatically cleaned up when migrated.

---

### 4. Renamed Settings & Type Migrations

When a setting key is renamed or changes type between versions, it must be handled through an explicit, versioned migration registered in `MigrationRegistry`.

#### Example Key Rename (v1 -> v2):
```typescript
globalMigrationRegistry.registerMigration({
  schemaId: 'qm.settings.user',
  fromVersion: 1,
  toVersion: 2,
  description: 'Rename legacy editor.renderWhitespace to editor.whitespace',
  migrate: (from: Record<string, any>) => {
    const to = { ...from };
    if (to['editor.renderWhitespace'] !== undefined) {
      to['editor.whitespace'] = to['editor.renderWhitespace'];
      delete to['editor.renderWhitespace'];
    }
    return to;
  },
});
```

#### Type Migrations:
- Loose coercion (e.g. `String(value)`) is strictly prohibited.
- Conversions must be semantic and explicit (e.g. converting `boolean` wrap to `"on" | "off"` enum).
- If conversion is impossible, the invalid override is discarded so the setting cleanly falls back to the new default.

---

### 5. Sensitive Fields Classification

The following keys and patterns are classified as sensitive and rejected from ordinary settings persistence:
- Any setting registered with `sensitive: true`.
- Any setting key matching `/secret/i`, `/token/i`, `/password/i`, `/apikey/i`, `/api_key/i`, or `/credential/i`.
- In future phases, sensitive settings will route to an approved secure credentials storage mechanism.
