# QM Editor — LSP Selection Range Security & Defensive Controls

## 1. Threat Model & Untrusted Inputs

Selection ranges are structural metadata supplied by external language server processes. Although not directly executed, malicious or buggy servers could introduce:
- Infinite loops or stack exhaustion via self-referential or cyclic parent pointers (`A → B → A`).
- Crash or memory exhaustion via pathological nesting depth (e.g. 10,000 recursive levels).
- Corrupt selection state via negative coordinates, NaN values, or inverted ranges (`start > end`).
- Out-of-bounds selection errors via lines or characters exceeding document buffers.
- Stale overwrites where asynchronous server responses arrive after document revisions.

## 2. Security Controls & Mitigations

### 2.1 Iterative Traversal (Stack Exhaustion Immunity)
All hierarchy traversal is strictly iterative using a bounded `while` loop rather than recursive calls. This guarantees immunity to V8 call stack overflow.

### 2.2 Strict Coordinate Validation
Each coordinate must be a non-negative integer. Start and end are strictly checked (`start.line < end.line || (start.line === end.line && start.character <= end.character)`).

### 2.3 Cycle & Self-Reference Guard
The validator computes unique range fingerprints (`${start.line}:${start.character}-${end.line}:${end.character}`) and maintains a visited Set during traversal. Any revisited range key halts traversal immediately and truncates the cyclic branch safely. Direct reference loops (`range.parent === range`) are caught immediately.

### 2.4 Hard Maximum Depth Clamping
A configurable depth limit (`lsp.selectionRange.maxDepth`, default `50`) truncates excessively deep hierarchies to preserve editor responsiveness.

### 2.5 Parent Containment Enforcement
If a parent range does not strictly enclose its child (`parent.start <= child.start && parent.end >= child.end`), the invalid parent and all its ancestors are discarded, retaining only the verified child prefix.

### 2.6 Stale Revision Protection
Before applying any selection range response:
- `documentRevision` is compared against the initial request revision.
- `workspaceGeneration` and server session generation are verified.
- If any revision change occurred during in-flight processing, the response is discarded.

### 2.7 Privacy & No Raw Persistence
LSP selection range payloads are strictly transient runtime representations. They are never written to disk, indexed in local history, sent to cloud telemetry, or persisted across editor restarts.
