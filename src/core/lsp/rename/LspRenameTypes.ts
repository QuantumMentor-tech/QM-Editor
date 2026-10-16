/**
 * QM Editor LSP Rename Types & Contracts
 * Phase 06, Step 62 — LSP Rename, Prepare Rename & Safe Multi-File Workspace Edit Integration
 */

import { Range } from '../../navigation/LocationTypes';
import { WorkspaceEdit } from '../../language-intelligence/CodeActionTypes';

/**
 * Context passed when requesting prepareRename from an LSP server.
 */
export interface LspPrepareRenameRequest {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly workspaceGeneration: number;
  readonly documentId: string;
  readonly resourceUri: string;
  readonly documentRevision: number;
  readonly line: number; // 1-based
  readonly column: number; // 1-based
  readonly languageId: string;
}

/**
 * Validated prepareRename result representing a confirmed renameable symbol.
 */
export interface PreparedRenameResult {
  readonly range: Range; // 1-based canonical Range of the symbol to rename
  readonly placeholder: string; // Current symbol name / placeholder
}

/**
 * Context passed when requesting semantic symbol rename from an LSP server.
 */
export interface LspRenameRequest {
  readonly requestId: string;
  readonly workspaceId: string;
  readonly workspaceGeneration: number;
  readonly documentId: string;
  readonly resourceUri: string;
  readonly documentRevision: number;
  readonly line: number; // 1-based
  readonly column: number; // 1-based
  readonly newName: string;
  readonly languageId: string;
}

/**
 * Validation result for rename requests and incoming WorkspaceEdits.
 */
export interface RenameValidationResult<T = void> {
  readonly valid: boolean;
  readonly value?: T;
  readonly error?: string;
  readonly status?:
    | 'valid'
    | 'stale'
    | 'disabled'
    | 'not_renameable'
    | 'invalid_name'
    | 'invalid_uri'
    | 'invalid_range'
    | 'overlapping_edits'
    | 'read_only'
    | 'conflict'
    | 'workspace_mismatch'
    | 'unsupported_operation';
}

/**
 * Outcome of executing a rename transaction.
 */
export interface RenameExecutionResult {
  readonly status: 'applied' | 'rejected' | 'cancelled' | 'failed';
  readonly operationId: string;
  readonly oldName: string;
  readonly newName: string;
  readonly affectedFilesCount: number;
  readonly appliedEditsCount: number;
  readonly affectedDocuments: string[];
  readonly edit?: WorkspaceEdit;
  readonly error?: string;
}
