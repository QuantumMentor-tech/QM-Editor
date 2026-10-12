/**
 * QM Editor Canonical Symbol Types & Contracts
 * Phase 04, Step 35 — Symbol Infrastructure, Outline & Symbol Navigation
 */

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
  | 'heading';

export type SymbolTag = 'deprecated';

export interface SymbolRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

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
