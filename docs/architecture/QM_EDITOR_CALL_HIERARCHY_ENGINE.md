# QM Editor — Call Hierarchy Engine & Relationship Model

## 1. Primary Objectives
The Call Hierarchy Engine provides a unified, lazy, non-blocking representation of callable code relationships:
- **Callers (Incoming Calls):** Symbols and specific call sites that invoke the target symbol.
- **Callees (Outgoing Calls):** Symbols and specific call sites that are invoked by the target symbol.

## 2. Distinction from Related Code Intelligence Systems
| System | Primary Scope | Relationship Model | Navigation Target |
| :--- | :--- | :--- | :--- |
| **Document Outline** | Intra-document | Lexical syntax containment (Class -> Method -> Variable) | Document symbol |
| **Workspace Symbols** | Cross-workspace | Global symbol search by fuzzy name | Symbol declaration |
| **Find References** | Cross-workspace | All text references to a symbol identifier | Any token reference |
| **Call Hierarchy** | Cross-file | Caller & callee execution relationships between callable symbols | Symbol & call sites |

## 3. Canonical Models
- `QmCallHierarchyItem`:
  - `id`: Deterministic structural key `${workspaceId}:${uri}:${name}:${startLine}:${startColumn}`
  - `name`: Sanitized non-empty symbol identifier
  - `kind`: Canonical `SymbolKind` (function, method, constructor, etc.)
  - `range`: 1-based enclosing declaration range (`Range`)
  - `selectionRange`: 1-based identifier range (`Range`), verified to be enclosed in `range`
  - `tags`: Optional `SymbolTag[]` (e.g. `'deprecated'`)
  - `rawItem`: Original protocol payload for subsequent recursive requests
- `QmIncomingCall`:
  - `from`: Caller symbol item
  - `fromRanges`: 1-based call-site ranges in the caller document
- `QmOutgoingCall`:
  - `to`: Callee symbol item
  - `fromRanges`: 1-based call-site ranges in the current/caller document
- `CallHierarchyTreeNode`:
  - `id`: Node key
  - `item`: `QmCallHierarchyItem`
  - `direction`: `'incoming' | 'outgoing'`
  - `state`: `'unloaded' | 'loading' | 'loaded' | 'empty' | 'failed' | 'cycle'`
  - `isCycle`: Boolean flag
  - `depth`: Monotonically increasing tree depth
  - `ancestorFingerprints`: Set of ancestral fingerprints along current active branch

## 4. No Persistent Call Graph
Call hierarchy relationships are derived runtime metadata. They are never serialized to local disk, SQLite, recovery state, autosave, or cloud storage.
