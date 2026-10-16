/**
 * QM Editor LSP Formatting Types & Contracts
 * Phase 06, Step 63 — LSP Document Formatting, Range Formatting & Safe Formatting Edit Integration
 */

import { Range } from '../../navigation/LocationTypes';
import { FormattingOptions } from '../LspTypes';

/**
 * Context passed when requesting full document formatting from an LSP server.
 */
export interface LspFormatDocumentRequest {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly workspaceGeneration: number;
  readonly documentId: string;
  readonly resourceUri: string;
  readonly documentRevision: number;
  readonly languageId: string;
  readonly options?: Partial<FormattingOptions>;
}

/**
 * Context passed when requesting range / selection formatting from an LSP server.
 */
export interface LspFormatRangeRequest {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly workspaceGeneration: number;
  readonly documentId: string;
  readonly resourceUri: string;
  readonly documentRevision: number;
  readonly languageId: string;
  readonly range: Range; // Canonical 1-based line & column
  readonly options?: Partial<FormattingOptions>;
}

/**
 * Status outcomes for formatting validation.
 */
export type FormattingValidationStatus =
  | 'valid'
  | 'stale'
  | 'disabled'
  | 'not_supported'
  | 'read_only'
  | 'invalid_range'
  | 'overlapping_edits'
  | 'payload_too_large'
  | 'conflict'
  | 'workspace_mismatch'
  | 'no_changes';

/**
 * Result of validating formatting parameters or incoming server edits.
 */
export interface FormattingValidationResult<T = void> {
  readonly valid: boolean;
  readonly value?: T;
  readonly error?: string;
  readonly status?: FormattingValidationStatus;
}

/**
 * Final execution result of an applied or rejected formatting transaction.
 */
export interface FormatExecutionResult {
  readonly status: 'applied' | 'no_changes' | 'rejected' | 'failed' | 'cancelled';
  readonly operationId: string;
  readonly documentId: string;
  readonly appliedEditsCount: number;
  readonly error?: string;
  readonly newRevision?: number;
  readonly durationMs?: number;
}
