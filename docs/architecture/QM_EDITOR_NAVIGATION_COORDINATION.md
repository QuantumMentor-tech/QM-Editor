# QM Editor — Code Navigation & Location Coordination Architecture
**Phase 04 — Core Application Engine (Step 41 of 135)**

---

## 1. Executive Summary

In complex IDE applications, ad-hoc navigation logic leads to race conditions, focus corruption, history bloating, and inconsistent line/column indexing. When features like Problems, Search, Document Outline, and Quick Open each independently implement document-opening, editor lookup, and custom dispatch events, navigation breaks down across asynchronous boundaries.

The **Navigation Coordination Subsystem** introduces a single, authoritative gateway for all structured code navigation in QM Editor. It establishes:
1. A **Canonical Location Model** representing cross-platform resource locators and 1-based text coordinates.
2. A **Navigation Coordinator** providing lifecycle safety, document resolution, safe bounds clamping, and history integration.
3. **Race-Condition & Stale-Callback Protection** via monotonic operation sequencing and workspace generation validation.
4. **Unified Consumer Integration** unifying Document Outline, Go to Symbol, Problems, Diagnostics, and Commands under one common pipeline.

---

## 2. Canonical Coordinate & Location Model

All navigation coordinates in QM Editor are strictly **1-based**:
- `startLine`: 1-based line number ($\ge 1$).
- `startColumn`: 1-based column number ($\ge 1$).
- `endLine`: 1-based line number ($\ge \text{startLine}$).
- `endColumn`: 1-based column number ($\ge 1$).

### Location Contract

```typescript
export interface Range {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface Location {
  uri: string;
  range?: Range;
  selectionRange?: Range;
  workspaceId?: string;
  resourceId?: string;
}
```

The Location model is decoupled from visual editor instances, view states, and DOM elements. It specifies *where* the target exists and *what* range should be highlighted or focused.

---

## 3. End-to-End Navigation Lifecycle

```text
Provider (Symbol / Problem / Search)
               │
               ▼
        Canonical Location
               │
               ▼
     Navigation Coordinator
   ┌───────────┼───────────┐
   ▼           ▼           ▼
Validate    Monotonic   Workspace
Location    Sequence    Generation
   │           │           │
   └───────────┼───────────┘
               │
               ▼
       Resource Resolver
       ├── If already open: activate document
       └── If closed: open via DocumentEngine / registered opener
               │
               ▼
     Stale-Sequence Guard (reject if superseded)
               │
               ▼
     Document Bounds Clamping (clamp lines & columns)
               │
               ▼
      Editor Coordination
       ├── Adapter goToLine & selectAndRevealRange
       ├── Broadcast 'qm:editor:gotoline' event
       └── Editor focus (unless preserveFocus: true)
               │
               ▼
     Navigation History Integration (NavigationService)
               │
               ▼
       Event Notification ('navigation.completed')
```

---

## 4. Key Architectural Guarantees

### 4.1. Single Source of Truth for Document Opening
Navigating to a closed resource never reads files or creates duplicate document models manually. Instead, the request resolves through `DocumentEngine.openResource(...)` or the UI-registered opener handler (`registerDocumentOpener`), guaranteeing that:
- Already-open documents are activated without creating duplicates.
- Document capabilities, dirty state, and revisions remain preserved.
- Tab management in `WorkspaceContext` is kept perfectly in sync.

### 4.2. Stale Request & Race Condition Protection
Navigations may require asynchronous disk I/O. If Navigation A starts, and Navigation B starts before A completes:
- When Navigation B executes, it increments the internal sequence counter.
- When Navigation A finishes its asynchronous file loading, it observes `seq !== this.currentSequence`.
- Navigation A is cleanly aborted with error code `STALE_REQUEST`, preventing the editor from jumping backwards unexpectedly.

### 4.3. Workspace Generation Awareness
If the active workspace changes while an asynchronous navigation request is in flight, the coordinator checks the workspace ID against `globalWorkspaceEngine.getWorkspaceId()`. If a mismatch is detected, the navigation is immediately aborted with `WORKSPACE_MISMATCH`, preventing cross-workspace contamination.

### 4.4. Safe Range Clamping
When navigating to historical or stale ranges that exceed the target document's current length or column widths, `clampRangeToDocument` safely bounds the coordinates to the maximum available line count and line text length. This prevents editor crashes or exceptions while flagging `clamped: true` in the result.

### 4.5. History Stack Deduplication
Every successful navigation records the target in `NavigationService` (`globalNavigationService.pushLocation`). The history engine filters out minor cursor jitter ($< 5$ lines delta in the same document), preventing stack pollution while preserving back/forward navigation.

---

## 5. Public API & Usage Examples

### 5.1. Navigating to a Symbol or Range
```typescript
import { globalNavigationCoordinator } from '../core/navigation';

const result = await globalNavigationCoordinator.navigateToLocation(
  {
    uri: 'C:/project/src/index.ts',
    range: { startLine: 45, startColumn: 1, endLine: 45, endColumn: 20 },
  },
  { origin: 'outline' }
);

if (result.success) {
  console.log(`Navigated to ${result.location.uri} (clamped: ${result.clamped})`);
}
```

### 5.2. Back and Forward Navigation
```typescript
if (globalNavigationCoordinator.canNavigateBack()) {
  await globalNavigationCoordinator.navigateBack();
}

if (globalNavigationCoordinator.canNavigateForward()) {
  await globalNavigationCoordinator.navigateForward();
}
```
