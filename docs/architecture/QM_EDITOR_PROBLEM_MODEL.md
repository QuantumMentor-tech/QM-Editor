# QM Editor Canonical Problem & Diagnostic Model

**Status:** Permanent Production Architecture (Phase 04, Step 40)  
**Location:** `src/core/diagnostics/DiagnosticTypes.ts` & `src/core/diagnostics/DiagnosticValidation.ts`

---

## 1. Overview

The QM Editor Problem/Diagnostic model defines the application's authoritative internal data contract for errors, warnings, notices, and resource markers.

All producers—including Task problem matchers, linters, compilers, background checkers, and future LSP services—normalize into this structure before publishing into the `DiagnosticService`.

---

## 2. Core Model Fields

```typescript
export interface Diagnostic {
  /** Unique diagnostic identifier (explicit or deterministic generated) */
  id: string;

  /** Normalized resource URI, file path, or workspace root */
  uri: string;

  /** Structured 1-based source range (optional for resource/workspace issues) */
  range?: DiagnosticRange;

  /** Normalized severity level: 'error' | 'warning' | 'info' | 'hint' */
  severity: DiagnosticSeverity;

  /** Primary user-facing diagnostic message */
  message: string;

  /** Optional extended description or secondary explanation */
  detail?: string;

  /** Subsystem or producer display name (e.g. 'tsc', 'eslint', 'tasks') */
  source: string;

  /** Owning provider identifier */
  providerId?: string;

  /** Associated workspace identifier */
  workspaceId?: string;

  /** Monotonic operation/provider generation counter */
  generation?: number;

  /** Machine-readable error or rule code (e.g. 'TS2304', 'no-unused-vars') */
  code?: string | number;

  /** Optional standard tags (e.g. 'unnecessary', 'deprecated') */
  tags?: DiagnosticTag[];

  /** Secondary related code locations */
  relatedInformation?: DiagnosticRelatedInformation[];

  /** Document buffer revision at diagnostic calculation */
  documentRevision?: number;

  /** Optional opaque payload for future code actions or quick fixes */
  data?: unknown;

  /** Generation epoch timestamp (ms) */
  createdAt: number;
}
```

---

## 3. Severity Specification

Four normalized severity values are supported:
1. `error`: Fatal problem, syntax error, or build-breaking failure. Renders red squiggle (`#f85149`) and error badge.
2. `warning`: Non-fatal code smell, deprecation, or linter warning. Renders amber squiggle (`#d29922`) and warning badge.
3. `info`: Informational notice or style hint. Renders blue squiggle (`#58a6ff`).
4. `hint`: Subtle suggestion or grayed-out indicator. Renders subtle dotted decoration (`#8b949e`).

Severity is never guessed from message text; it is strictly validated and normalized against `VALID_SEVERITIES`.

---

## 4. Range Specification & Point Coordinates

Coordinates are strictly **1-based**:
- `startLine`: >= 1
- `startColumn`: >= 1
- `endLine`: >= `startLine`
- `endColumn`: >= `startColumn` when `endLine === startLine`

### Point Coordinates
When a producer emits single line and column coordinates without an end range, `validateDiagnostic` normalizes them to a minimal valid range `{ startLine: line, startColumn: col, endLine: line, endColumn: col }`.

### Resource-Level Diagnostics
When an issue is associated with an entire file or workspace (e.g. `package.json` missing dependency or invalid project configuration), `range` is explicitly `undefined`. Coordinates are **never** fabricated.

---

## 5. Diagnostic Identity Strategy

Diagnostic identity does not rely on array index positions.
If `id` is not supplied by the provider, a deterministic ID is generated:
```text
diag-${source}-${sanitizedUri}-${rangeKey}${codePart}-${hash(message)}
```
This guarantees that repeated analysis runs with the same findings preserve diagnostic identity without generating DOM and decoration churn.

---

## 6. Equality & Change Detection

`areDiagnosticsEqual(a, b)` and `areDiagnosticArraysEqual(a, b)` perform field-level comparison (id, uri, severity, message, source, code, detail, range, revision).
When a provider pushes updated diagnostics that match the existing store, no unnecessary `DiagnosticChangeEvent` is dispatched, preventing editor decoration and panel re-rendering storms.
