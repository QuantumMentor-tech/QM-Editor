/**
 * QM Editor - LSP Semantic Tokens Types
 * 
 * Canonical data contracts, protocol shapes, decoded tokens, and editor
 * decoration models for LSP 3.17 semantic tokens and highlighting.
 */

import {
  LspRange,
  LspSemanticTokens,
  LspSemanticTokensDelta,
  LspSemanticTokensEdit,
  LspSemanticTokensLegend,
  LspSemanticTokensParams,
  LspSemanticTokensRangeParams,
  LspSemanticTokensDeltaParams,
  LspSemanticTokensResponse,
  LspSemanticTokensDeltaResponse,
} from '../LspTypes';

export type {
  LspRange,
  LspSemanticTokens,
  LspSemanticTokensDelta,
  LspSemanticTokensEdit,
  LspSemanticTokensLegend,
  LspSemanticTokensParams,
  LspSemanticTokensRangeParams,
  LspSemanticTokensDeltaParams,
  LspSemanticTokensResponse,
  LspSemanticTokensDeltaResponse,
};

/**
 * Standard LSP 3.17 token types supported out-of-the-box.
 */
export const STANDARD_TOKEN_TYPES = [
  'namespace',
  'type',
  'class',
  'enum',
  'interface',
  'struct',
  'typeParameter',
  'parameter',
  'variable',
  'property',
  'enumMember',
  'event',
  'function',
  'method',
  'macro',
  'keyword',
  'modifier',
  'comment',
  'string',
  'number',
  'regexp',
  'operator',
  'decorator',
  'label',
] as const;

export type StandardTokenType = typeof STANDARD_TOKEN_TYPES[number];

/**
 * Standard LSP 3.17 token modifiers supported out-of-the-box.
 */
export const STANDARD_TOKEN_MODIFIERS = [
  'declaration',
  'definition',
  'readonly',
  'static',
  'deprecated',
  'abstract',
  'async',
  'modification',
  'documentation',
  'defaultLibrary',
] as const;

export type StandardTokenModifier = typeof STANDARD_TOKEN_MODIFIERS[number];

/**
 * Decoded semantic token using 0-based LSP line and character coordinates.
 */
export interface DecodedSemanticToken {
  /** 0-based line number in document */
  line: number;
  /** 0-based start character on line */
  startChar: number;
  /** Token length in characters */
  length: number;
  /** Raw index into the server's tokenTypes legend */
  tokenTypeIndex: number;
  /** Resolved token type name (e.g. 'function', 'class') */
  tokenType: string;
  /** Raw bitmask of active modifiers */
  tokenModifiersMask: number;
  /** Resolved token modifier names (e.g. ['readonly', 'declaration']) */
  tokenModifiers: string[];
}

/**
 * Canonical 1-based semantic token for QM Editor consumers and tests.
 */
export interface CanonicalSemanticToken {
  /** 1-based line number */
  line: number;
  /** 1-based start column */
  startColumn: number;
  /** 1-based end line */
  endLine: number;
  /** 1-based end column */
  endColumn: number;
  /** Token character length */
  length: number;
  /** Semantic token type identifier */
  tokenType: string;
  /** Active semantic modifiers */
  modifiers: string[];
}

/**
 * Editor mark decoration representing a semantic token mapped to character offsets.
 */
export interface EditorSemanticTokenDecoration {
  /** 0-based start character offset in document */
  from: number;
  /** 0-based end character offset in document */
  to: number;
  /** Sanitized CSS class string applied to the mark */
  className: string;
  /** Resolved semantic token type */
  tokenType: string;
  /** Active semantic modifiers */
  modifiers: string[];
}

/**
 * Cached semantic tokens snapshot for delta requests and cache invalidation.
 */
export interface SemanticTokensCacheEntry {
  /** Document URI */
  uri: string;
  /** Document ID */
  documentId: string;
  /** Document revision when tokens were received */
  documentRevision: number;
  /** Active workspace generation */
  workspaceGeneration: number;
  /** Language server session identifier */
  sessionId: string;
  /** Generation counter of the server's legend */
  legendGeneration: number;
  /** Result ID from the server for delta requests */
  resultId?: string;
  /** Raw 5-tuple integer array */
  rawTokens: number[];
  /** Mapped editor decorations */
  decorations: EditorSemanticTokenDecoration[];
  /** Timestamp when cached */
  timestamp: number;
}

/**
 * Result of validating raw semantic token data.
 */
export interface SemanticTokenValidationResult {
  isValid: boolean;
  sanitizedData: number[];
  error?: string;
  quarantinedCount: number;
}

/**
 * Configuration options for semantic token requests and processing.
 */
export interface SemanticTokensConfig {
  enabled: boolean;
  debounceMs: number;
  maxTokensPerDocument: number;
  enableDeltas: boolean;
}
