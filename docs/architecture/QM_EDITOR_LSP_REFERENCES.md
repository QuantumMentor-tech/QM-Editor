# QM Editor LSP Find References Architecture

## Phase 06, Step 60 — Technical Specification

---

## 1. Overview

Find References (`textDocument/references`) locates all occurrences and usages of an identifier across single-file and multi-file projects.

Because reference search can span thousands of files:
- Results are canonicalized into structured `ReferenceResult` objects.
- References are grouped by resource URI and sorted deterministically.
- Operations support interactive cancellation via `CancellationToken`.
- Target files are loaded lazily upon explicit user activation, protecting memory.

---

## 2. Canonical Reference Data Model

```typescript
export interface ReferenceGroup {
  readonly uri: string;
  readonly displayPath: string;
  readonly locations: readonly Location[];
}

export interface ReferenceResult {
  readonly requestId: string;
  readonly locations: readonly Location[];
  readonly totalCount: number;
  readonly groups: readonly ReferenceGroup[];
  readonly isCancelled?: boolean;
  readonly durationMs?: number;
}
```

---

## 3. Request Lifecycle & Cancellation

```text
User invokes Find References (Shift+F12)
        ↓
LspNavigationCoordinator creates CancellationToken (cancelling prior pending request)
        ↓
LspNavigationProvider sends textDocument/references { context: { includeDeclaration: true } }
        ↓
Server returns Location[]
        ↓
LspLocationValidator sanitizes & discards malformed entries
        ↓
LspLocationMapper groups by URI and sorts (file path, line, column)
        ↓
Event 'qm:navigation:references' dispatched to ReferencesModal UI
        ↓
User selects reference -> NavigationCoordinator.navigateToLocation()
```

If the user changes documents, closes the modal, or triggers a new search, the pending `CancellationToken` cancels the request and discards outdated results.
