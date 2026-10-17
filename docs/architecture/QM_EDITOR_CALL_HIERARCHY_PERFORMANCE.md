# QM Editor — Call Hierarchy Performance & Resource Bounding

## 1. Lazy Graph Traversal
To prevent querying massive call graphs across large codebases:
- The initial preparation only retrieves the root item at cursor.
- Child callers/callees are **never** recursively loaded upfront.
- Children are loaded on-demand when the user expands a node row in the UI tree.
- Already loaded or cyclic nodes immediately return cached node children without re-querying the server.

## 2. Cycle Detection Without Blocking Sibling Paths
- Every node maintains an ancestral fingerprint set: `ancestorFingerprints: Set<string>`.
- Fingerprint format: `${uri}#${name}#${startLine}:${startColumn}-${endLine}:${endColumn}`.
- If a child's fingerprint matches any ancestor along its active branch:
  - Marked with `isCycle: true` and `state: 'cycle'`.
  - Displayed with a clear visual cycle badge (`[Recursive Call]`).
  - Expansion is halted immediately, preventing infinite loops or stack overflow.
- Distinct non-ancestral sibling branches can legitimately call the same symbol without false-positive suppression.

## 3. Depth & Node Count Boundaries
- Configurable settings:
  - `editor.callHierarchy.maxDepth`: Maximum hierarchical tree depth (default 20).
  - Maximum calls per node clamped to 200 items.
- In-flight requests are tracked by key and superseded automatically when the user moves to a new location or changes direction.

## 4. Memory Management & Disposal
- When a document or modal closes, `globalCallHierarchyCoordinator.clearSession()` cleans active tree structures.
- Unsubscribers clean up document engine listeners on coordinator disposal.
