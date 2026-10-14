/**
 * QM Editor Canonical Symbol Types & Contracts
 * Phase 04, Step 35 & Step 41 — Symbol Infrastructure, Outline & Symbol Navigation
 */

import { Location, Range } from '../navigation/LocationTypes';

export type SymbolKind =
  | 'file'
  | 'module'
  | 'namespace'
  | 'package'
  | 'class'
  | 'method'
  | 'property'
  | 'field'
  | 'constructor'
  | 'enum'
  | 'interface'
  | 'function'
  | 'variable'
  | 'constant'
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'key'
  | 'null'
  | 'enumMember'
  | 'struct'
  | 'event'
  | 'operator'
  | 'typeParameter'
  | 'heading'
  | 'type';

export type SymbolTag = 'deprecated';

/**
 * 1-based text coordinates for symbol boundaries.
 * Compatible with canonical Range.
 */
export type SymbolRange = Range;

/**
 * Canonical Application-Level Symbol Representation.
 * Decoupled from UI rendering, tree-view state, and language specifics.
 */
export interface Symbol {
  /** Deterministic symbol identifier (unique within document) */
  id: string;
  /** Primary display name of the symbol (e.g. 'getUserById') */
  name: string;
  /** Normalized symbol category/kind */
  kind: SymbolKind;
  /** Canonical location including resource URI and declaration range */
  location: Location;
  /** Optional preferred selection range (e.g. identifier token) */
  selectionRange?: Range;
  /** Optional parent/enclosing container name (e.g. 'UserService') */
  containerName?: string;
  /** Secondary contextual detail (e.g. signature or type annotation) */
  detail?: string;
  /** Optional semantic tags (e.g. 'deprecated') */
  tags?: SymbolTag[];
  /** Optional hierarchical child symbols (e.g. class methods, struct fields) */
  children?: Symbol[];
  /** Identifier of the originating SymbolProvider */
  sourceProviderId: string;
  /** Workspace identity if associated with a specific workspace */
  workspaceId?: string;
}

/**
 * Document-scoped symbol result container with generation and revision metadata.
 */
export interface DocumentSymbolResult {
  documentUri: string;
  revision: number;
  providerId: string;
  symbols: Symbol[];
  timestamp: number;
  generation: number;
  durationMs?: number;
}

/**
 * Symbol loading and lifecycle state.
 */
export type SymbolLoadingState = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'stale';

/**
 * Legacy/Backwards-compatible DocumentSymbol representation.
 */
export interface DocumentSymbol {
  name: string;
  detail?: string;
  kind: SymbolKind;
  tags?: SymbolTag[];
  range: SymbolRange;
  selectionRange: SymbolRange;
  children?: DocumentSymbol[];
  containerName?: string;
}

/**
 * Legacy/Backwards-compatible WorkspaceSymbol representation.
 */
export interface WorkspaceSymbol {
  name: string;
  kind: SymbolKind;
  tags?: SymbolTag[];
  containerName?: string;
  location: {
    uri: string;
    range: SymbolRange;
  };
}

export interface SymbolQueryOptions {
  query?: string;
  kind?: SymbolKind[];
  maxResults?: number;
}

export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): () => void;
}

/**
 * Capabilities declared by a registered SymbolProvider.
 */
export interface SymbolProviderCapabilities {
  supportsDocumentSymbols?: boolean;
  supportsWorkspaceSymbols?: boolean;
  supportsHierarchicalSymbols?: boolean;
  supportedLanguages?: string[];
  priority?: number;
}

/**
 * Document context provided to a SymbolProvider.
 */
export interface DocumentSymbolInput {
  id: string;
  uri: string;
  content: string;
  language: string;
  contentRevision?: number;
  workspaceId?: string;
}

/**
 * Provider interface for pluggable symbol producers (regex, AST, LSP, AI/SLM).
 */
export interface SymbolProvider {
  /** Unique provider identifier (e.g. 'builtin.regex', 'typescript.lsp') */
  readonly providerId: string;
  /** Human-readable provider name */
  readonly displayName?: string;
  /** Provider capabilities */
  readonly capabilities?: SymbolProviderCapabilities;

  /**
   * Produces document-level symbols for a given document.
   */
  provideDocumentSymbols?(
    document: DocumentSymbolInput,
    token?: CancellationToken
  ): Promise<Symbol[] | DocumentSymbol[]>;

  /**
   * Searches workspace-wide symbols matching a query string.
   */
  provideWorkspaceSymbols?(
    query: string,
    token?: CancellationToken
  ): Promise<Symbol[] | WorkspaceSymbol[]>;

  /**
   * Disposes provider resources.
   */
  dispose?(): void;
}
