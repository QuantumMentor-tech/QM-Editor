/**
 * QM Editor LSP Workspace Symbol Types & Contracts
 * Phase 06, Step 61 — LSP Workspace Symbols, Cross-File Symbol Search & Symbol Navigation
 */

import { Symbol } from '../../symbols/SymbolTypes';
import { LspRange, LspSymbolKind, LspSymbolTag } from '../LspTypes';

/**
 * Normalized workspace symbol request context passed to LSP workspace symbol providers.
 */
export interface LspWorkspaceSymbolRequest {
  readonly query: string;
  readonly workspaceId?: string;
  readonly workspaceGeneration?: number;
  readonly serverSessionId?: string;
  readonly serverGeneration?: number;
  readonly languageFilter?: string;
  readonly requestGeneration?: number;
  readonly maxResults?: number;
}

/**
 * Validated and sanitized LSP workspace symbol item representation.
 */
export interface SanitizedWorkspaceSymbolItem {
  readonly name: string;
  readonly kind: LspSymbolKind;
  readonly tags?: LspSymbolTag[];
  readonly deprecated?: boolean;
  readonly containerName?: string;
  readonly location: {
    readonly uri: string;
    readonly range: LspRange;
  };
}

/**
 * Validation result for workspace symbol responses and candidate items.
 */
export interface WorkspaceSymbolValidationResult<T> {
  readonly valid: boolean;
  readonly value?: T;
  readonly error?: string;
}

/**
 * Validated, bounded workspace symbol query payload.
 */
export interface ValidatedWorkspaceSymbolPayload {
  readonly valid: boolean;
  readonly symbols: Symbol[];
  readonly totalReceived: number;
  readonly quarantinedCount: number;
  readonly error?: string;
}
