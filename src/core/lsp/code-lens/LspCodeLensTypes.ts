/**
 * QM Editor - LSP Code Lens Types
 * Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration
 * 
 * Canonical data contracts, protocol mappings, and editor line decoration models
 * for LSP 3.17 Code Lens and Code Lens Resolution.
 */

import {
  LspPosition,
  LspRange,
  LspCommand,
  LspCodeLens,
  LspCodeLensParams,
  LspCodeLensResponse,
} from '../LspTypes';

export type {
  LspPosition,
  LspRange,
  LspCommand,
  LspCodeLens,
  LspCodeLensParams,
  LspCodeLensResponse,
};

/**
 * Validated, safe representation of an actionable command attached to a Code Lens.
 */
export interface CanonicalCodeLensCommand {
  /** User-visible label or action text */
  readonly title: string;
  /** Internal or LSP command identifier */
  readonly command: string;
  /** Optional arguments for command execution */
  readonly arguments?: unknown[];
  /** Source attribution */
  readonly source: 'lsp';
  /** Whether the command has been verified against the trusted command allowlist */
  readonly isTrusted: boolean;
}

/**
 * Canonical Code Lens model mapped into the QM Editor architecture.
 */
export interface CanonicalCodeLens {
  /** Stable unique identifier for DOM reconciliation and lifecycle tracking */
  readonly id: string;
  /** Document resource URI */
  readonly uri: string;
  /** Document content revision at the time of creation */
  readonly documentRevision: number;
  /** LSP document range the lens applies to */
  readonly range: LspRange;
  /** Executable command if resolved or supplied */
  readonly command?: CanonicalCodeLensCommand;
  /** Opaque server data retained for `codeLens/resolve` */
  readonly data?: unknown;
  /** Whether the lens has been resolved with complete command metadata */
  readonly isResolved: boolean;
  /** Identifier of the provider */
  readonly providerId: string;
  /** Server session identifier */
  readonly sessionId: string;
}

/**
 * Grouped code lenses for a specific line in the editor document.
 * CodeMirror 6 renders one block widget per line containing all lenses on that line.
 */
export interface EditorCodeLensLine {
  /** 0-based document line index */
  readonly line: number;
  /** 0-based character offset of the start of the line in the document */
  readonly from: number;
  /** Ordered list of canonical code lenses on this line */
  readonly lenses: CanonicalCodeLens[];
}

/**
 * Capability negotiation state for Code Lens support.
 */
export interface CodeLensCapabilityState {
  readonly supported: boolean;
  readonly resolveSupported: boolean;
  readonly provider?: string;
  readonly sessionId?: string;
  readonly workspaceId?: string;
  readonly languageId?: string;
  readonly generation: number;
}

/**
 * Cache entry preserving computed code lenses per document and server session.
 */
export interface CodeLensCacheEntry {
  readonly uri: string;
  readonly documentRevision: number;
  readonly sessionId: string;
  readonly lenses: CanonicalCodeLens[];
  readonly lines: EditorCodeLensLine[];
  readonly timestamp: number;
}

/**
 * Request dispatch options.
 */
export interface CodeLensRequestOptions {
  forceRefresh?: boolean;
}
