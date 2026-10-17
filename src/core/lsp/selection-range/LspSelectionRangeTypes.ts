/**
 * QM Editor — LSP Selection Range Types
 * Phase 06, Step 69 — LSP Selection Ranges, Smart Structural Selection & Context-Aware Cursor Expansion
 */

import { Range } from '../../navigation/LocationTypes';
import { OffsetRange } from '../../editor/EditorTypes';
import { LspPosition, LspRange, LspSelectionRange } from '../LspTypes';

export type { LspPosition, LspRange, LspSelectionRange };

/**
 * Canonical QM Selection Range representation.
 * Represents a single structural boundary derived from LSP or structural analysis.
 */
export interface CanonicalSelectionRange {
  id: string;
  documentId: string;
  resourceId: string;
  workspaceId: string;
  range: Range; // 1-based startLine, startColumn, endLine, endColumn
  offsetRange: OffsetRange; // 0-based character offsets { from, to }
  parent?: CanonicalSelectionRange;
  providerId: string;
  providerGeneration: number;
  documentRevision: number;
  source: 'lsp' | 'native';
}

/**
 * Ordered hierarchy of selection ranges for a cursor position, from smallest to largest enclosing.
 */
export interface SelectionHierarchy {
  cursorPosition: LspPosition;
  ranges: CanonicalSelectionRange[];
}

/**
 * Capability negotiation state for textDocument/selectionRange.
 */
export interface SelectionRangeCapabilityState {
  supported: boolean;
  sessionId?: string;
  workspaceId?: string;
  languageId?: string;
  generation: number;
}

/**
 * Selection range request context for in-flight tracking and stale verification.
 */
export interface SelectionRangeRequestContext {
  requestId: string;
  workspaceId: string;
  documentId: string;
  resourceId: string;
  uri: string;
  languageId: string;
  positions: LspPosition[];
  documentRevision: number;
  modelVersion?: number;
  workspaceGeneration: number;
  sessionId: string;
  providerGeneration: number;
  createdAt: number;
}

/**
 * History entry for shrink selection operations.
 */
export interface SelectionHistoryEntry {
  documentId: string;
  documentRevision: number;
  selections: Array<{ anchor: number; head: number }>;
  timestamp: number;
}

/**
 * Editor selection update payload.
 */
export interface SelectionExpansionResult {
  expanded: boolean;
  selections: Array<{ anchor: number; head: number }>;
  source: 'lsp' | 'native' | 'unchanged';
}
