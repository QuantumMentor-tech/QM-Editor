# QM Editor Data Portability & Cross-Installation Migration

## 1. Portable vs. Non-Portable Data
Data portability governs what can safely move between installations and operating systems:

| Persistence Domain | Portability Policy | Handling on Import |
|---|---|---|
| User Settings | Portable | Sanitized (secrets stripped), validated against Settings Schema |
| Workspace Definitions | Portable | Root paths remapped or validated against local filesystem |
| Recent Workspaces/Files | Conditionally Portable | Missing files gracefully handled without fabricating entries |
| Local History | Conditionally Portable | Imported chronologically; retains snapshot hashes |
| Derived Indexes | Rebuildable (Non-Portable) | Excluded from packages; invalidated & rebuilt upon restore |
| Crash Recovery | Restricted (Non-Portable) | Quarantined; never injected into active sessions |
| Active Document Buffers | Non-Portable | Live runtime models remain authoritative |
| Terminal / Process State | Non-Portable | Omitted |
| Secrets & Credentials | Restricted | Stripped by serializer and validator |

## 2. Machine-Specific Information & Path Normalization
- Absolute paths (e.g. `C:\Users\...` or `/home/...`) are flagged during import.
- Root references are validated through the Workspace Engine.
- Non-existent external project paths are marked as missing rather than silently synthesized.

## 3. Derived Data Lifecycle Post-Import
Authoritative domain data is updated first. Derived indexes (Quick Open index, workspace search metadata, resource index) are automatically invalidated via `ResourceIndexRepository.deleteIndex` to ensure stale caches are never loaded.
