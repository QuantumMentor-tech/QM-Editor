/**
 * QM Editor - LSP Inlay Hints Types
 * Phase 06, Step 65 — LSP Inlay Hints, Parameter Names, Type Information & Inline Semantic Annotations
 * 
 * Canonical data contracts, protocol mappings, and editor decoration models
 * for LSP 3.17 inlay hints.
 */

import {
  LspPosition,
  LspRange,
  LspInlayHint,
  LspInlayHintKind,
  LspInlayHintLabelPart,
  LspInlayHintParams,
  LspInlayHintResponse,
} from '../LspTypes';

export type {
  LspPosition,
  LspRange,
  LspInlayHint,
  LspInlayHintLabelPart,
  LspInlayHintParams,
  LspInlayHintResponse,
};

export { LspInlayHintKind };

/**
 * Normalized semantic kind for inlay hints within the QM Editor architecture.
 */
export type CanonicalInlayHintKind = 'type' | 'parameter' | 'other';

/**
 * Validated, canonical inlay hint mapped to an exact document character offset
 * for non-mutating editor widget rendering.
 */
export interface EditorInlayHintDecoration {
  /** Stable unique identifier for DOM reconciliation and identity tracking */
  readonly id: string;
  /** 0-based character offset in the document */
  readonly from: number;
  /** Sanitized plain text label for the inline annotation */
  readonly label: string;
  /** Categorized semantic hint kind */
  readonly kind: CanonicalInlayHintKind;
  /** Sanitized safe tooltip text */
  readonly tooltip?: string;
  /** Whether the hint specifies left padding */
  readonly paddingLeft?: boolean;
  /** Whether the hint specifies right padding */
  readonly paddingRight?: boolean;
  /** CSS class list for design system theming */
  readonly className: string;
}

/**
 * Cache entry preserving computed inlay hints per document and server session.
 */
export interface InlayHintsCacheEntry {
  readonly uri: string;
  readonly documentRevision: number;
  readonly sessionId: string;
  readonly hints: EditorInlayHintDecoration[];
  readonly timestamp: number;
}

/**
 * Options for inlay hint request dispatch.
 */
export interface InlayHintRequestOptions {
  range?: LspRange;
  forceRefresh?: boolean;
}
