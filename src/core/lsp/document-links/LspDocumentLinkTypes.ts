/**
 * QM Editor - LSP Document Link Types
 * Phase 06, Step 67 — LSP Document Links, Clickable Resource References & Safe URI Navigation
 * 
 * Canonical data contracts, protocol mappings, and editor link decoration models
 * for LSP 3.17 Document Link and Document Link Resolution.
 */

import {
  LspPosition,
  LspRange,
  LspDocumentLink,
  LspDocumentLinkParams,
  LspDocumentLinkResponse,
} from '../LspTypes';

export type {
  LspPosition,
  LspRange,
  LspDocumentLink,
  LspDocumentLinkParams,
  LspDocumentLinkResponse,
};

/**
 * Security classification of a target URI.
 */
export type UriClassification =
  | 'workspace-local'
  | 'same-document'
  | 'outside-workspace'
  | 'external-web'
  | 'unsupported'
  | 'malformed';

/**
 * Canonical Document Link model mapped into QM Editor.
 */
export interface CanonicalDocumentLink {
  /** Stable unique identifier for decoration reconciliation and click handling */
  readonly id: string;
  /** Source document resource URI */
  readonly uri: string;
  /** Document content revision when link was created */
  readonly documentRevision: number;
  /** LSP document range the link covers */
  readonly range: LspRange;
  /** Start character offset in document */
  readonly from: number;
  /** End character offset in document */
  readonly to: number;
  /** Raw or normalized target URI if resolved */
  readonly target?: string;
  /** User-visible tooltip or description if provided */
  readonly tooltip?: string;
  /** Opaque server data retained for `documentLink/resolve` */
  readonly data?: unknown;
  /** Whether the target URI has been resolved */
  readonly isResolved: boolean;
  /** Target URI security classification */
  readonly classification: UriClassification;
  /** Language server definition identifier */
  readonly providerId: string;
  /** Language server session identifier */
  readonly sessionId: string;
}

/**
 * Editor decoration representation of an inline document link.
 */
export interface EditorDocumentLinkDecoration {
  /** Stable unique identifier matching CanonicalDocumentLink.id */
  readonly id: string;
  /** Character offset start */
  readonly from: number;
  /** Character offset end */
  readonly to: number;
  /** Target URI if resolved */
  readonly target?: string;
  /** Tooltip text */
  readonly tooltip?: string;
  /** Security classification */
  readonly classification: UriClassification;
  /** CSS class name applied to link text */
  readonly className: string;
}

/**
 * Capability negotiation state for LSP document links.
 */
export interface DocumentLinkCapabilityState {
  readonly supported: boolean;
  readonly resolveSupported: boolean;
  readonly sessionId?: string;
  readonly workspaceId?: string;
  readonly languageId?: string;
  readonly generation: number;
}

/**
 * Cached document link result for an active document.
 */
export interface DocumentLinkCacheEntry {
  readonly uri: string;
  readonly documentRevision: number;
  readonly sessionId: string;
  readonly links: CanonicalDocumentLink[];
  readonly decorations: EditorDocumentLinkDecoration[];
  readonly timestamp: number;
}

/**
 * Request options for document link retrieval.
 */
export interface DocumentLinkRequestOptions {
  readonly forceRefresh?: boolean;
}

/**
 * Final mapped result of a document link request.
 */
export interface DocumentLinkResult {
  readonly links: CanonicalDocumentLink[];
  readonly decorations: EditorDocumentLinkDecoration[];
  readonly documentRevision: number;
}
