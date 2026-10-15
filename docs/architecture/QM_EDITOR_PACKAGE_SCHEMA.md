# QM Editor Package Schema Specification

## 1. Package Envelope (`qm.portability.package` v1)
A portability envelope packages manifest and deterministic serialized file entries:
```json
{
  "manifest": {
    "format": "qm-editor-package",
    "formatVersion": 1,
    "packageType": "fullBackup",
    "packageId": "pkg_1712345678_abcdef",
    "createdAt": 1712345678000,
    "applicationVersion": "0.1.0",
    "domains": ["settings", "workspace", "history", "recent"],
    "recordCounts": {
      "settings": 1,
      "workspace": 1,
      "history": 42,
      "recent": 5
    },
    "integrity": {
      "manifestChecksum": "abc12345",
      "filesChecksum": "def67890",
      "totalBytes": 1048576
    },
    "sourceEnvironment": {
      "platform": "Win32",
      "workspaceId": "ws_main"
    }
  },
  "files": {
    "package-manifest.json": "...",
    "settings/user.json": "...",
    "workspaces/ws_main.json": "...",
    "workspaces/recent.json": "...",
    "history/manifests/file%3A%2F%2F...json": "...",
    "history/snapshots/hist_snap_1.json": "..."
  },
  "checksum": "def67890"
}
```

## 2. Manifest Schema (`qm.portability.manifest` v1)
The manifest provides deterministic metadata, integrity hashes, domain records, and version tracking. Registered with schema ID `qm.portability.manifest` in the `SchemaRegistry`.

## 3. Versioning & Migration Rules
- Current format version: `1`.
- Legacy envelopes with `formatVersion: 0` are automatically upgraded by `PackageMigrator.migrate()`.
- Future major format versions with incompatible breaking structures must fail validation with a clear error unless a registered migration adapter exists.
