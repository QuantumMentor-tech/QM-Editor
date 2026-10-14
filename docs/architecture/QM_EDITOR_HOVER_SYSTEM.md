# QM Editor — Hover Information & Contextual Language Documentation Architecture

## Phase 04 — Core Application Engine | Step 43

---

## 1. Executive Architectural Summary

The **Hover Information and Contextual Language Documentation Engine** in QM Editor establishes an asynchronous, provider-driven, multi-provider, revision-aware, and workspace-safe architecture for presenting symbol documentation, type annotations, and contextual language information.

It extends the Step 42 **Language Intelligence Provider Architecture** without creating duplicate provider registries or competing popup surfaces.

```
+-------------------------------------------------------------------+
|                           Editor View                             |
|  (Mouse Hover debounced 300ms OR Manual Command Mod+I / showHover)|
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                        HoverCoordinator                           |
|  - Cancels previous in-flight requests (CancellationTokenSource)   |
|  - Validates document revision, model ID, and workspace generation |
|  - Resolves compatible providers from LanguageIntelligenceRegistry |
|  - Queries providers concurrently within isolated try/catch shields|
|  - Aggregates contents deterministically by provider priority     |
|  - Sanitizes all HTML/Markdown output via ContentSanitizer        |
|  - Caches results in bounded LRU cache (revision-invalidated)     |
+-------------------------------------------------------------------+
          |                                       |
          v                                       v
+--------------------+                 +--------------------+
|   Provider A       |                 |   Provider B       |
|  (e.g. TypeScript) |                 |  (e.g. Docstring)  |
+--------------------+                 +--------------------+
          |                                       |
          +-------------------+-------------------+
                              v
+-------------------------------------------------------------------+
|                        HoverWidget                                |
|  - Accessible React overlay positioned via adapter.coordsAtPos     |
|  - Clean design tokens, dark/light theme integration              |
|  - Sanitized rich documentation with safe code blocks             |
|  - Navigation target button routed to globalNavigationCoordinator |
+-------------------------------------------------------------------+
```

---

## 2. Core Principles & Design Invariants

1. **Informational & Non-Mutating:** Hover queries and displays contextual metadata. Hover MUST NEVER mutate document content, edit buffers, or push transactions onto the undo/redo stack.
2. **Provider Driven & Decoupled:** No hardcoded language parsers exist within the coordinator. Information is produced by registered `LanguageIntelligenceProvider` instances declaring `capabilities.hover = true`.
3. **Cooperative Cancellation:** Every hover request creates a `CancellationTokenSource`. If the user moves the cursor away or a new hover starts, prior pending requests are aborted immediately.
4. **Stale Result Protection:** Results returned from slow asynchronous providers are validated against:
   - `workspaceGeneration` (protects against switching workspace while query is resolving)
   - `documentRevision` (protects against the user continuing to type while query is resolving)
   - `editorModelId` (protects against switching tabs / documents in the active editor)
   - `requestGeneration` (protects against race conditions between back-to-back requests)
5. **Absolute Provider Isolation:** If one provider throws an unhandled exception or hangs, other providers execute cleanly and the editor host remains completely stable.
6. **Untrusted Content Sanitization:** All provider output (strings, Markdown, raw HTML) is strictly filtered through `ContentSanitizer`. Dangerous tags (`<script>`, `<iframe>`, `<style>`, `<embed>`), `on*` event handlers, and unsafe URL protocols (`javascript:`, `vbscript:`, `data:`) are permanently neutralized.
7. **Canonical Navigation Authority:** When a hover provider supplies a `location` for symbol definitions or related types, navigation is delegated exclusively to `globalNavigationCoordinator.navigateToLocation()`.

---

## 3. Data Models & Contracts

### 3.1 `HoverRequest`
```typescript
export interface HoverRequest {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly workspaceGeneration: number;
  readonly documentId: string;
  readonly editorModelId: string;
  readonly documentRevision: number;
  readonly position: Position; // 1-based line & column
  readonly languageId: string;
  readonly triggerKind: HoverTriggerKind; // 'mouse' | 'keyboard' | 'manual'
}
```

### 3.2 `HoverResult` & `HoverContentPart`
```typescript
export type HoverContentPart =
  | string
  | { language: string; value: string }
  | MarkupContent;

export interface HoverResult {
  readonly contents: HoverContentPart[];
  readonly range?: Range;
  readonly location?: Location;
  readonly providerId: string;
  readonly requestId: string;
  readonly generation: number;
}
```

---

## 4. Multi-Provider Aggregation & Priority Ordering

When multiple providers support hover for a document's language:
1. Providers are sorted in descending order of declared `priority` (with deterministic fallback to alphabetical `providerId`).
2. Providers are queried concurrently via `Promise.allSettled`.
3. Results with non-empty content are collected in priority order.
4. The first provider supplying a valid `range` or canonical `location` determines the hover highlight and navigation target.
5. All content parts are concatenated into a cohesive, structured documentation card with provider badges.

---

## 5. Security & Content Sanitization

Provider documentation is treated as untrusted third-party data.
- `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<applet>` tags are stripped completely with their inner contents.
- Attributes beginning with `on` (e.g., `onload`, `onclick`, `onerror`) are rejected.
- Only safe links (`http:`, `https:`, `mailto:`, relative URLs) are permitted.
- All safe links automatically receive `target="_blank"` and `rel="noopener noreferrer"`.
- Code blocks are escaped and rendered inside `<pre><code class="language-...">` tags without executing scripts.

---

## 6. Lifecycle & Resource Disposal

- **Active Request Cancellation:** Any pending hover request is cancelled on editor cursor movement, model switch, tab close, or workspace change.
- **Cache Invalidation:** The bounded LRU cache holds up to 50 recent hover responses. Stale entries are immediately purged when the document revision advances or the workspace switches.
- **Disposal:** Calling `dispose()` on `HoverCoordinator` clears all caches, aborts active tokens, and resets monotonic generation counters.
