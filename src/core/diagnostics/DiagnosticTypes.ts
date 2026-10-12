/**
 * QM Editor Canonical Diagnostics Types & Contracts
 * Phase 04, Step 34 — Core Engine Diagnostics Model, Aggregation & Editor Integration
 */

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export type DiagnosticTag = 'unnecessary' | 'deprecated';

export interface DiagnosticPosition {
  line: number; // 1-based line number
  column: number; // 1-based column number
}

export interface DiagnosticRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface DiagnosticRelatedInformation {
  location: {
    uri: string;
    range: DiagnosticRange;
  };
  message: string;
}

export interface Diagnostic {
  /** Unique diagnostic ID */
  id: string;
  /** Normalized resource URI / file path */
  uri: string;
  /** Diagnostic source range (1-based lines and columns) */
  range: DiagnosticRange;
  /** Diagnostic severity level */
  severity: DiagnosticSeverity;
  /** Human-readable diagnostic description */
  message: string;
  /** Owning subsystem / producer (e.g. 'typescript', 'eslint', 'tasks', 'syntax') */
  source: string;
  /** Machine-readable error or warning code */
  code?: string | number;
  /** Optional metadata tags (e.g. 'unnecessary', 'deprecated') */
  tags?: DiagnosticTag[];
  /** Secondary related code locations */
  relatedInformation?: DiagnosticRelatedInformation[];
  /** Document content revision at diagnostic generation */
  documentRevision?: number;
  /** Optional arbitrary payload (e.g. for quick fixes / code actions) */
  data?: unknown;
  /** Timestamp when diagnostic was published */
  createdAt: number;
}

export interface DiagnosticFilter {
  uri?: string;
  severity?: DiagnosticSeverity | DiagnosticSeverity[];
  source?: string;
  search?: string;
}

export interface DiagnosticSummary {
  total: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hintCount: number;
}

export type DiagnosticChangeType = 'set' | 'cleared' | 'deleted';

export interface DiagnosticChangeEvent {
  type: DiagnosticChangeType;
  uris: string[];
  owner?: string;
  summary: DiagnosticSummary;
  timestamp: number;
}

export type DiagnosticChangeListener = (event: DiagnosticChangeEvent) => void;

/**
 * Interface representing an owner-scoped collection of diagnostics.
 * Similar to VS Code DiagnosticCollection: producers publish into their collection
 * without stomping on other producers' diagnostics for the same document.
 */
export interface DiagnosticCollection {
  /** Unique owner name for this collection (e.g. 'typescript', 'eslint', 'tasks') */
  readonly name: string;

  /** Sets diagnostics for a given resource URI, replacing previous diagnostics for this owner */
  set(uri: string, diagnostics: Diagnostic[]): void;

  /** Deletes diagnostics for a specific resource URI within this collection */
  delete(uri: string): void;

  /** Clears all diagnostics across all URIs within this collection */
  clear(): void;

  /** Gets all diagnostics for a specific URI within this collection */
  get(uri: string): readonly Diagnostic[];

  /** Checks if any diagnostics exist for a URI within this collection */
  has(uri: string): boolean;

  /** Iterates over all URIs and their diagnostics in this collection */
  forEach(callback: (uri: string, diagnostics: readonly Diagnostic[], collection: DiagnosticCollection) => void): void;

  /** Disposes the collection and removes all its diagnostics from the aggregator */
  dispose(): void;
}
