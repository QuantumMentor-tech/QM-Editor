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
  /** Normalized resource URI / file path / workspace path */
  uri: string;
  /**
   * Diagnostic source range (1-based lines and columns).
   * Optional for resource-level or workspace-level diagnostics (e.g. config errors, missing dependencies).
   */
  range?: DiagnosticRange;
  /** Diagnostic severity level */
  severity: DiagnosticSeverity;
  /** Human-readable diagnostic description */
  message: string;
  /** Optional secondary detailed description */
  detail?: string;
  /** Owning subsystem / producer (e.g. 'typescript', 'eslint', 'tasks', 'syntax') */
  source: string;
  /** Explicit owning provider identifier (defaults to collection name) */
  providerId?: string;
  /** Associated workspace ID */
  workspaceId?: string;
  /** Provider/operation generation counter for stale-result protection */
  generation?: number;
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
  providerId?: string;
  search?: string;
}

export interface DiagnosticSummary {
  total: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  hintCount: number;
}

export type DiagnosticChangeType = 'set' | 'cleared' | 'deleted' | 'reassigned';

export interface DiagnosticChangeEvent {
  type: DiagnosticChangeType;
  uris: string[];
  owner?: string;
  summary: DiagnosticSummary;
  timestamp: number;
}

export type DiagnosticChangeListener = (event: DiagnosticChangeEvent) => void;

/**
 * Capabilities declared by a registered DiagnosticProvider.
 */
export interface DiagnosticProviderCapabilities {
  supportsDocumentDiagnostics?: boolean;
  supportsResourceMarkers?: boolean;
  supportsWorkspaceDiagnostics?: boolean;
  supportsRangeLocations?: boolean;
  supportsRelatedInformation?: boolean;
  supportsCodes?: boolean;
}

/**
 * Formal internal registration contract for diagnostic producers.
 */
export interface DiagnosticProvider {
  /** Unique provider identifier (e.g. 'tasks', 'eslint', 'typescript') */
  readonly providerId: string;
  /** User-friendly display label */
  readonly displayName: string;
  /** Declared provider capabilities */
  readonly capabilities?: DiagnosticProviderCapabilities;
  /** Optional provider priority (lower number = higher precedence) */
  readonly priority?: number;
  /** Optional provider disposal hook */
  dispose?(): void;
}

/**
 * Options supplied when setting diagnostics into a collection.
 * Enforces stale-generation and revision guards.
 */
export interface SetDiagnosticsOptions {
  /** Provider generation counter; rejects if < latest stored generation */
  generation?: number;
  /** Expected document content revision; rejects if active document revision has advanced */
  documentRevision?: number;
  /** Expected workspace generation; rejects if workspace generation changed */
  workspaceGeneration?: number;
}

/**
 * Interface representing an owner-scoped collection of diagnostics.
 * Similar to VS Code DiagnosticCollection: producers publish into their collection
 * without stomping on other producers' diagnostics for the same document.
 */
export interface DiagnosticCollection {
  /** Unique owner name for this collection (e.g. 'typescript', 'eslint', 'tasks') */
  readonly name: string;

  /** Sets diagnostics for a given resource URI, replacing previous diagnostics for this owner */
  set(uri: string, diagnostics: Diagnostic[], options?: SetDiagnosticsOptions): void;

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

  /** Reassigns diagnostics from an old URI to a new URI (e.g. on file rename) */
  reassignUri(oldUri: string, newUri: string): void;

  /** Gets current generation for a resource in this collection */
  getGeneration?(uri: string): number;

  /** Disposes the collection and removes all its diagnostics from the aggregator */
  dispose(): void;
}
