# QM Editor Diagnostics Engine Architecture

**Status:** Permanent Production Architecture (Phase 04, Step 40)  
**Canonical Owner:** `src/core/diagnostics/DiagnosticService.ts`, `src/core/diagnostics/DiagnosticCollection.ts`, `src/core/diagnostics/DiagnosticAdapter.ts`  
**Downstream Consumers:** `EditorAdapter`, `EditorSurface`, `ProblemsPanel`, `TreeNodeRow` (File Explorer), `StatusBar`, Tasks & Build matchers, future LSP / language services.

---

## 1. Executive Summary

The QM Editor Diagnostics Engine provides a centralized, authoritative, multi-source diagnostics, problems, and resource marker engine.

It establishes a single canonical internal representation for structured issues across:
- files and folders
- open text documents
- workspace resources
- task and build processes
- future language services and LSP providers
- future AI/SLM analysis

Producers publish into isolated collections. The Diagnostics Engine maintains authoritative state, protects against stale asynchronous outputs using monotonic generation and revision validation, and projects state into the Problems panel, editor squiggle decorations, and File Explorer badges.

---

## 2. Core Architectural Principles

```text
Diagnostic Producer
       │
       ├── Task / Build
       ├── Test
       ├── Linter
       ├── Parser
       ├── Language Service
       ├── LSP
       └── Future AI / SLM
              │
              ▼
      Diagnostic Provider API (DiagnosticProvider)
              │
              ▼
       Diagnostics Engine (DiagnosticService)
              │
       ┌──────┼─────────────────────────┐
       ▼      ▼                         ▼
   Document  Resource               Workspace
   Problems   Markers                Problems
       │
       ├────────────────────────────────┐
       ▼                                ▼
Editor Decorations              Problems UI / Explorer Badges
       │                                │
       └──────────────┬─────────────────┘
                      ▼
               User Navigation
```

### 1. Single Canonical Representation
No subsystem or provider creates an independent global problem system. All diagnostics adhere to the canonical `Diagnostic` model.

### 2. Provider Isolation
Each producer (compiler, linter, task matcher, etc.) owns a dedicated `DiagnosticCollection`. Updating or clearing diagnostics for Provider A never mutates or removes diagnostics owned by Provider B.

### 3. Stale-Result Protection
Asynchronous analysis results can arrive out-of-order due to editor edits, workspace changes, or task reruns:
- **Provider Generation Guard:** If `options.generation < currentGeneration`, the update is rejected.
- **Document Revision Guard:** If `options.documentRevision !== document.contentRevision`, analysis against an older buffer revision is rejected.
- **Workspace Generation Guard:** If `options.workspaceGeneration !== workspace.generation`, stale results from prior workspaces are rejected.

### 4. Task Run Isolation
When repeated tasks run (e.g. Run 101 starts, Run 102 starts, 102 finishes before 101), `TaskDiagnosticProvider` enforces run generations (`runGen < latestGen`), ensuring delayed results from older runs can never overwrite active results.

### 5. Resource-Level & Workspace-Level Diagnostics
Not all problems map to text ranges (e.g. missing dependencies, configuration syntax errors). Range is optional (`range?: DiagnosticRange`). Coordinates are never fabricated for range-less diagnostics.

### 6. Resource Lifecycle Synchronization
- **Document Close:** Editor markers disappear with the CodeMirror view, but resource diagnostics remain in the Diagnostics Engine. Reopening the tab restores squiggles without re-running analysis.
- **Resource Rename:** `handleResourceRenamed(oldUri, newUri)` updates diagnostic associations across all collections while retaining provider ownership.
- **Resource Delete:** `handleResourceDeleted(uri)` cleans up diagnostics for deleted files across all collections.
- **Workspace Switch:** `handleWorkspaceChanged()` clears all workspace-scoped collections to prevent cross-workspace contamination.

---

## 3. Key Contracts & Types

### Canonical Diagnostic
```typescript
export interface Diagnostic {
  id: string;
  uri: string;
  range?: DiagnosticRange; // Optional for resource/workspace issues
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  detail?: string;
  source: string;
  providerId?: string;
  workspaceId?: string;
  generation?: number;
  code?: string | number;
  tags?: DiagnosticTag[];
  relatedInformation?: DiagnosticRelatedInformation[];
  documentRevision?: number;
  data?: unknown;
  createdAt: number;
}
```

### DiagnosticProvider
```typescript
export interface DiagnosticProvider {
  readonly providerId: string;
  readonly displayName: string;
  readonly capabilities?: DiagnosticProviderCapabilities;
  readonly priority?: number;
  dispose?(): void;
}
```

### DiagnosticCollection
```typescript
export interface DiagnosticCollection {
  readonly name: string;
  set(uri: string, diagnostics: Diagnostic[], options?: SetDiagnosticsOptions): void;
  delete(uri: string): void;
  clear(): void;
  get(uri: string): readonly Diagnostic[];
  has(uri: string): boolean;
  forEach(callback: (uri: string, diags: readonly Diagnostic[], col: DiagnosticCollection) => void): void;
  reassignUri(oldUri: string, newUri: string): void;
  getGeneration?(uri: string): number;
  dispose(): void;
}
```

---

## 4. UI Integrations

1. **Editor Squiggle Decorations (`EditorAdapter.ts` & `EditorSurface.tsx`):**
   - Subscribes to `globalDiagnosticService.subscribe()`.
   - Maps 1-based ranges to 0-based character offsets (`rangeToCharacterOffsets`).
   - Ignores range-less resource issues cleanly (`from < to` false).
2. **Problems Panel (`ProblemsPanel.tsx`):**
   - Displays real-time aggregated error, warning, and info counts.
   - Supports severity filtering, source filtering, and text search.
   - Safe navigation target validation (`validateNavigationTarget`) clamps coordinates against open document buffers.
3. **File Explorer (`TreeNodeRow.tsx`):**
   - Renders aggregated error and warning badges with counts (`getResourceSummary` and `getDirectorySummary`).
   - Accessible labels report error/warning counts for screen readers.

---

## 5. Security & Privacy

1. Diagnostic messages remain strictly local in memory. No diagnostics are transmitted to remote endpoints or telemetry.
2. File contents or source snippets are never stored inside diagnostic objects.
3. Diagnostic logging logs only provider ID, resource URI, severity, and count—never sensitive code buffers or environment secrets.

---

## 6. Automated Testing

Covered by unit and integration tests:
- `DiagnosticsEngine.test.ts` (21 tests): Canonical validation, provider registration, provider isolation, stale generation rejection, document revision rejection, task run isolation, resource rename/delete lifecycle, directory summaries, navigation bounds clamping, high-volume performance (1,000 diagnostics).
- `DiagnosticValidation.test.ts` (12 tests): URI normalization, range bounds clamping, deterministic IDs, sorting precedence.
- `DiagnosticCollection.test.ts` (5 tests): Collection mutation, deletion, clearing, delegate notifications, disposal.
- `DiagnosticService.test.ts` (7 tests): Aggregation, query filters, summaries, lifecycle hooks.
