/**
 * QM Editor LSP Rename Errors Taxonomy
 * Phase 06, Step 62 — LSP Rename, Prepare Rename & Safe Multi-File Workspace Edit Integration
 */

import { LspError } from '../LspErrors';

export class PrepareRenameFailedError extends LspError {
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(`PrepareRenameFailed: ${message}`);
    this.name = 'PrepareRenameFailedError';
    this.details = details;
  }
}

export class RenameRequestFailedError extends LspError {
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(`RenameRequestFailed: ${message}`);
    this.name = 'RenameRequestFailedError';
    this.details = details;
  }
}

export class RenameResponseInvalidError extends LspError {
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(`RenameResponseInvalid: ${message}`);
    this.name = 'RenameResponseInvalidError';
    this.details = details;
  }
}

export class WorkspaceEditInvalidError extends LspError {
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(`WorkspaceEditInvalid: ${message}`);
    this.name = 'WorkspaceEditInvalidError';
    this.details = details;
  }
}

export class RenameStaleError extends LspError {
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(`RenameStale: ${message}`);
    this.name = 'RenameStaleError';
    this.details = details;
  }
}

export class RenameConflictError extends LspError {
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(`RenameConflict: ${message}`);
    this.name = 'RenameConflictError';
    this.details = details;
  }
}

export class RenamePermissionDeniedError extends LspError {
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(`RenamePermissionDenied: ${message}`);
    this.name = 'RenamePermissionDeniedError';
    this.details = details;
  }
}

export class RenameUnsupportedOperationError extends LspError {
  public readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(`RenameUnsupportedOperation: ${message}`);
    this.name = 'RenameUnsupportedOperationError';
    this.details = details;
  }
}

export class RenameCancelledError extends LspError {
  public readonly details?: Record<string, unknown>;

  constructor(message: string = 'Rename operation was cancelled by the user.', details?: Record<string, unknown>) {
    super(`RenameCancelled: ${message}`);
    this.name = 'RenameCancelledError';
    this.details = details;
  }
}
