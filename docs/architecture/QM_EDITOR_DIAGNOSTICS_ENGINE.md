# QM Editor Diagnostics Engine Architecture

**Status:** Permanent Production Architecture (Phase 04, Step 34)  
**Canonical Owner:** `src/core/diagnostics/DiagnosticService.ts` & `src/core/diagnostics/DiagnosticCollection.ts`  
**Downstream Consumers:** `EditorAdapter`, `EditorSurface`, `ProblemsPanel`, `StatusBar`, `SecondaryPanel`, Tasks, Language Servers, Linters

---

## 1. Executive Summary

The QM Editor Diagnostics Engine provides a high-performance, multi-source diagnostics and problem aggregation model. It establishes canonical contracts for diagnostic objects, supports multi-owner source isolation (similar to VS Code Diagnostic Collections), guarantees range and version validation, calculates precise character offsets for CodeMirror squiggles, computes workspace-wide error and warning summaries, and connects seamlessly to editor squiggles, tooltips, the Problems panel, and the status bar.

---

## 2. Core Architectural Principles

1. **Owner-Scoped Isolation (`DiagnosticCollection`)**:
   - Each producer (e.g. `typescript`, `eslint`, `tasks`, `syntax`) owns a dedicated `DiagnosticCollection`.
   - Modifying, deleting, or clearing diagnostics in one collection updates only that producer's diagnostics for that document URI, completely preventing one tool from stomping on diagnostics from another tool.
2. **Deterministic Aggregation & Sorting**:
   - `DiagnosticService` merges diagnostics across all active collections for any given URI or across the workspace.
   - Diagnostics are sorted logically:
     1. Line number ascending
     2. Column number ascending
     3. Severity precedence (`error` > `warning` > `info` > `hint`)
     4. Message alphanumeric
3. **Cross-Platform Range & URI Normalization**:
   - URIs are normalized to cross-platform standard paths with consistent drive letter capitalization.
   - Coordinates use 1-based line/column numbers.
   - Malformed, negative, or reversed ranges are clamped safely without throwing runtime crashes in UI layers.
4. **Editor Integration & Squiggles**:
   - CodeMirror decorations render colored wavy squiggles:
     - `.cm-diagnostic-error`: red wavy underline (`#f85149`)
     - `.cm-diagnostic-warning`: amber wavy underline (`#d29922`)
     - `.cm-diagnostic-info`: blue wavy underline (`#58a6ff`)
     - `.cm-diagnostic-hint`: subtle dotted underline (`#8b949e`)
   - Hover titles display `[source (code)]: message` on hover.
5. **Bidirectional Adapters & Bridges**:
   - Task runner `Problem` objects seamlessly bridge into the canonical `DiagnosticService` under the `'tasks'` collection.
   - `ProblemsPanel` merges both task problems and live language diagnostics without duplicate entries.
6. **Live Observability**:
   - The status bar displays real-time workspace error and warning counters with one-click navigation to the Problems panel.

---

## 3. Class & Component Diagram

```mermaid
graph TD
    TS[TypeScript / Compiler] -->|set(uri, diags)| ColTS[DiagnosticCollection: 'typescript']
    ES[ESLint / Linter] -->|set(uri, diags)| ColES[DiagnosticCollection: 'eslint']
    TR[Task Runner / Build] -->|bridge| ColTasks[DiagnosticCollection: 'tasks']

    ColTS --> DS[DiagnosticService: Global Aggregator]
    ColES --> DS
    ColTasks --> DS

    DS -->|getDiagnostics(uri)| ESuf[EditorSurface & EditorAdapter Squiggles]
    DS -->|query() / getDiagnostics()| PP[ProblemsPanel]
    DS -->|getSummary()| SB[StatusBar & SecondaryPanel Counters]
```

---

## 4. Key Contracts

### Diagnostic
```typescript
export interface Diagnostic {
  id: string;
  uri: string;
  range: DiagnosticRange; // { startLine, startColumn, endLine, endColumn }
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source: string;
  code?: string | number;
  tags?: DiagnosticTag[];
  relatedInformation?: DiagnosticRelatedInformation[];
  documentRevision?: number;
  data?: unknown;
  createdAt: number;
}
```

### DiagnosticCollection
```typescript
export interface DiagnosticCollection {
  readonly name: string;
  set(uri: string, diagnostics: Diagnostic[]): void;
  delete(uri: string): void;
  clear(): void;
  get(uri: string): readonly Diagnostic[];
  has(uri: string): boolean;
  forEach(callback: (uri: string, diags: readonly Diagnostic[], col: DiagnosticCollection) => void): void;
  dispose(): void;
}
```

---

## 5. Verification & Testing

The diagnostics engine is covered by automated unit tests in `src/core/diagnostics/` and `src/components/editor/`:
- `DiagnosticValidation.test.ts`: Tests URI normalization, range bounds clamping, validation, offset conversion, and severity sorting.
- `DiagnosticCollection.test.ts`: Tests isolated collection mutation, deletion, clearing, delegate notifications, and disposal.
- `DiagnosticService.test.ts`: Tests multi-owner aggregation, summaries, query filtering, change subscriptions, and problem adaptation.
- `EditorDiagnostics.test.ts`: Tests CodeMirror diagnostic decoration injection and clearing without runtime exceptions.
