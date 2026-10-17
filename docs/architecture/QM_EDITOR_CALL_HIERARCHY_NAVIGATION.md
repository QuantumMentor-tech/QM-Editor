# QM Editor — Call Hierarchy Safe Cross-File Navigation

## 1. Centralized Navigation Principle
In accordance with Rule 4 and Rule 31:
- Call Hierarchy tree nodes and call site rows **never** directly manipulate editor DOM, call `window.open`, or access filesystem APIs.
- All navigation targets are mapped through `LspCallHierarchyMapper` into canonical `Location` objects and routed via `NavigationCoordinator.navigateToLocation(location, { origin: 'lsp-call-hierarchy' })`.

## 2. Navigation Target Resolution
1. **Target Symbol Navigation:**
   - When a user double-clicks or selects a symbol node in the tree:
   - Target range: `node.item.selectionRange` (1-based identifier location).
   - `LspCallHierarchyMapper.itemToLocation(node.item)` generates the canonical `Location`.
2. **Call-Site Navigation:**
   - When a caller invokes the target multiple times, individual call sites appear as sub-items (`line X:Y`).
   - Clicking a call site navigates directly to the invocation call range in the caller document via `LspCallHierarchyMapper.callSiteToLocation(node.item, range)`.

## 3. Cross-File & Workspace Boundary Validation
- Target resource paths are normalized via `LspUriMapper.uriToPath(uri)`.
- Workspace boundaries are validated by `WorkspaceEngine`.
- If a target lies outside the active workspace, standard external-resource policies are enforced without silent downloads or unauthorized execution.
- Navigation history automatically records back/forward navigation points through `NavigationCoordinator`.
