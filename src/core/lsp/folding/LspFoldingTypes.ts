/**
 * QM Editor — LSP Folding Range Types
 * Phase 06, Step 68 — LSP Folding Ranges, Smart Code Folding & Safe Document Structure Navigation
 */

import { LspFoldingRangeKind } from '../LspTypes';

export type { LspFoldingRangeKind };

/**
 * Canonical QM folding range model derived from language server structural analysis.
 */
export interface CanonicalFoldingRange {
  /** Deterministic identifier incorporating document, lines, kind, and generation */
  id: string;
  /** Normalized URI of the document containing this folding range */
  documentUri: string;
  /** 0-based start line returned by LSP */
  startLine: number;
  /** Optional 0-based start character offset */
  startCharacter?: number;
  /** 0-based end line returned by LSP */
  endLine: number;
  /** Optional 0-based end character offset */
  endCharacter?: number;
  /** 0-based buffer character offset where folding begins (fold marker position) */
  from: number;
  /** 0-based buffer character offset where folded region ends */
  to: number;
  /** Structural category of folding range: comment, imports, region, or custom */
  kind?: LspFoldingRangeKind;
  /** Sanitized plain text displayed when region is collapsed */
  collapsedText?: string;
  /** Provider identifier */
  providerId: string;
  /** Monotonic generation number of the server/provider */
  providerGeneration: number;
  /** Document content revision at time of folding generation */
  documentRevision: number;
  /** Origin source */
  source: 'lsp';
}

/**
 * Node within a strictly validated hierarchical fold tree.
 */
export interface FoldingTreeNode {
  range: CanonicalFoldingRange;
  children: FoldingTreeNode[];
  parent?: FoldingTreeNode;
}

/**
 * Complete normalized folding range tree for a document.
 */
export interface FoldingRangeTree {
  roots: FoldingTreeNode[];
  allRanges: CanonicalFoldingRange[];
}

/**
 * Lightweight editor folding range contract consumed by CodeMirror 6 foldService.
 */
export interface EditorFoldingRange {
  /** 0-based buffer start position for foldService */
  from: number;
  /** 0-based buffer end position for foldService */
  to: number;
  /** 1-based start line */
  startLine: number;
  /** 1-based end line */
  endLine: number;
  /** Structural kind */
  kind?: string;
  /** Sanitized collapsed placeholder text */
  collapsedText?: string;
}

/**
 * Negotiation state of LSP folding capabilities for an active session.
 */
export interface FoldingCapabilityState {
  supported: boolean;
  lineFoldingOnly?: boolean;
  rangeLimit?: number;
  collapsedTextSupported?: boolean;
  sessionId?: string;
  workspaceId?: string;
  languageId?: string;
  generation: number;
}

/**
 * Request context tracking in-flight folding range queries to detect stale responses.
 */
export interface FoldingRangeRequestContext {
  requestId: string;
  workspaceId: string;
  documentId: string;
  uri: string;
  languageId: string;
  documentRevision: number;
  workspaceGeneration: number;
  sessionId: string;
  providerGeneration: number;
  createdAt: number;
}

/**
 * In-memory cache entry for a document's folding ranges.
 */
export interface FoldingRangeCacheEntry {
  uri: string;
  revision: number;
  sessionId: string;
  generation: number;
  ranges: CanonicalFoldingRange[];
  tree: FoldingTreeNode[];
  editorRanges: EditorFoldingRange[];
  timestamp: number;
}
