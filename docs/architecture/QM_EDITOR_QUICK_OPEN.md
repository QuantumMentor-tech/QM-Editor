# QM Editor — Quick Open Architecture

## 1. Overview
The Quick Open system provides fast resource discovery across the current workspace. It connects metadata from `WorkspaceIndexService` (`src/services/WorkspaceIndexService.ts`) and `QuickOpenSearchService` (`src/services/QuickOpenSearchService.ts`) with QM Editor's `DocumentService` and tab management.

```text
WORKSPACE ROOT
      ↓
WORKSPACE INDEX SERVICE (enumerates metadata, skips excluded dirs)
      ↓
QUICK OPEN SEARCH SERVICE (fuzzy & deterministic path ranking)
      ↓
QUICK OPEN MODAL (Ctrl+P keyboard navigation & match highlighting)
      ↓
EXISTING TAB RESOLUTION OR FILE SERVICE OPEN
      ↓
ACTIVE TAB ACTIVATED IN EDITOR SURFACE
```

## 2. Core Architectural Principles
1. **Metadata Only — Zero Full-Text Scanning:** Quick Open operates strictly on filename and relative path metadata. It **never** opens or reads file text contents.
2. **Reuse Existing Tabs:** Selecting an already-open resource activates its existing tab rather than opening duplicate tabs.
3. **Workspace Boundary Enforcement:** Quick Open searches exclusively within the current workspace root. Queries cannot escape the workspace or trigger raw OS shell executions.
4. **Generation ID Race Prevention:** Asynchronous directory enumeration tracks generation tokens (`generationId`). Workspace switches immediately cancel and invalidate stale background indexing results.

## 3. Search Algorithm & Deterministic Ranking
- **Exact Filename Match (Score 1000):** Query matches filename exactly.
- **Filename Prefix Match (Score 800):** Filename starts with query.
- **Word Start Match (Score 600):** Query matches beginning of a word in filename (e.g., `user` -> `userService.ts`).
- **Filename Substring Match (Score 400):** Query is contained within filename.
- **Path Substring Match (Score 300):** Query matches relative path.
- **Fuzzy Match (Score 150-200+):** Query characters match in order across name or path.
- **Open / Recent Bonus (+25 to +50):** Currently active tabs or recent files receive bonus score points for fast access.

## 4. Non-Goals / Deferred Boundaries
- Full-text workspace search across files (Find in Files).
- Multi-file Find & Replace.
- AST symbol / LSP definition search.
- AI semantic resource search.
