# QM Editor — Unified Settings & Configuration Architecture
## Phase 03, Step 21 — Unified Settings, Preferences & Configuration System

---

### 1. Architectural Overview

The Unified Settings Subsystem provides a centralized, typed, observable, and multi-scoped configuration engine for QM Editor. It replaces disparate component-level preference models with a unified architecture that manages user preferences, workspace overrides, and subsystem defaults.

```text
Settings Registry (Definitions & Defaults)
                  ↓
Settings Service (Active Configuration State)
                  ↓
   ┌──────────────┴──────────────┐
   ↓                             ↓
Scope Precedence           Settings Storage
(Workspace -> User -> Default)  (Local & Workspace Storage)
                  ↓
          Change Event Hub
                  ↓
   ┌──────────────┼──────────────┐
   ↓              ↓              ↓
Settings UI    Editor       Subsystems
(Modal)       (Compartments) (Terminal, Tasks, SCM)
```

---

### 2. Core Concepts & Separation of State

To prevent conflicting configuration states, QM Editor enforces a strict taxonomy of application state:

| Concept | Scope / Lifecycle | Storage | Example |
| :--- | :--- | :--- | :--- |
| **Settings / Preferences** | User-controlled, persistent across sessions | `localStorage` / config files | `editor.fontSize`, `appearance.theme` |
| **Workspace Configuration** | Project-specific overrides | Workspace config store | `editor.tabSize`, `files.autoSave` |
| **Session State** | Transient window/workspace session | Session store | Active document tab, opened sidebar panels |
| **Document State** | Active document buffer | Document registry | Unsaved dirty text, selection, undo stack |
| **Runtime State** | Internal engine execution state | Transient memory | Git diff results, task process handles |

---

### 3. Setting Definition Model

```ts
export interface SettingDefinition<T = any> {
  key: string;              // Machine-readable dot-notation key (e.g. 'editor.fontSize')
  title: string;            // Human-readable title
  description: string;      // Clear explanation of behavior
  category: SettingCategory;// 'Appearance' | 'Editor' | 'Terminal' | 'Source Control' | 'Tasks' | 'Files' | 'Search' | 'Accessibility'
  type: SettingType;        // 'boolean' | 'number' | 'string' | 'enum'
  defaultValue: T;          // Deterministic default value
  scope: SettingScope;      // 'user' | 'workspace' | 'application'
  options?: SettingOption<T>[]; // Select options for enum types
  min?: number;             // Minimum bound for numbers
  max?: number;             // Maximum bound for numbers
  step?: number;            // Step interval for numbers
  restartRequired?: boolean;// Restart advisory flag
  validate?: (value: unknown) => SettingValidationResult;
}
```

---

### 4. Scope Precedence & Effective Value Resolution

Consumers request values through `settingsService.get(key)`. The service resolves values according to strict precedence:

```text
1. Workspace Scope Override (if defined for the active workspace)
   └── 2. User Scope Override (if defined in user settings)
         └── 3. Built-in Default Value (from SettingsRegistry)
```

- **Isolation**: Modifying workspace settings never pollutes or alters global user settings.
- **Switching**: When the active workspace switches, `SettingsService.setWorkspaceId(id)` dynamically swaps the workspace configuration layer.

---

### 5. Persistence, Validation & Corruption Recovery

1. **Validation Boundary**:
   - Every update via `settingsService.set(key, value, scope)` is validated against definition rules (`type`, `min`/`max`, enum `options`, and custom validators).
   - If invalid, the write is aborted, and a descriptive error is returned without persisting corrupt data.
2. **Backward-Compatible Migration**:
   - The storage layer automatically migrates legacy Step 13 preferences (`qm_editor_user_preferences_v1`) into the unified dot-notation schema (`qm_editor_unified_settings_v1`) without data loss.
3. **Corruption Fallback**:
   - If stored JSON is malformed, the corrupt data is safely preserved in a `.corrupted.<timestamp>` key for diagnostics, while the service falls back gracefully to defaults.

---

### 6. Event Notification & Subscriptions

- Consumers subscribe to specific setting keys or wildcard patterns (`*`, `editor.*`):
  ```ts
  const unsub = settingsService.subscribe('editor.fontSize', (event) => {
    // React to fontSize change (e.g., reconfigure CodeMirror compartment)
  });
  ```
- Change events emit `key`, `previousValue`, `currentValue`, `scope`, and `timestamp`.

---

### 7. Security, Privacy & Secret Redaction

- **No Secrets in Settings**: API keys, credentials, tokens, and passwords must never be stored in ordinary preferences.
- **Export Redaction**: The configuration export engine scans keys for sensitive tokens (`secret`, `token`, `password`, `key`) and strips them prior to serialization.
- **Zero Execution Risk**: Setting values are strictly scalar configuration and never interpreted as arbitrary shell commands or scripts.
