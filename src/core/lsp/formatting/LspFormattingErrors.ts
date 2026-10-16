/**
 * QM Editor LSP Formatting Error Hierarchy
 * Phase 06, Step 63 — LSP Document Formatting, Range Formatting & Safe Formatting Edit Integration
 */

export class LspFormattingError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'LspFormattingError';
  }
}

export class FormattingRequestFailedError extends LspFormattingError {
  constructor(public readonly documentId: string, message: string, public readonly cause?: unknown) {
    super(`Formatting request failed for document "${documentId}": ${message}`, 'FORMAT_REQUEST_FAILED');
    this.name = 'FormattingRequestFailedError';
  }
}

export class FormattingResponseInvalidError extends LspFormattingError {
  constructor(public readonly reason: string, public readonly details?: unknown) {
    super(`Server returned invalid formatting response: ${reason}`, 'FORMAT_RESPONSE_INVALID');
    this.name = 'FormattingResponseInvalidError';
  }
}

export class FormattingStaleError extends LspFormattingError {
  constructor(public readonly expectedRevision: number, public readonly actualRevision: number) {
    super(
      `Formatting rejected because document state became stale (expected revision ${expectedRevision}, current ${actualRevision}).`,
      'FORMAT_STALE'
    );
    this.name = 'FormattingStaleError';
  }
}

export class FormattingUnsupportedError extends LspFormattingError {
  constructor(public readonly languageId: string, public readonly mode: 'document' | 'range') {
    super(
      `No language server available supporting ${mode} formatting for language "${languageId}".`,
      'FORMAT_UNSUPPORTED'
    );
    this.name = 'FormattingUnsupportedError';
  }
}

export class FormattingTransactionFailedError extends LspFormattingError {
  constructor(public readonly documentId: string, public readonly reason: string) {
    super(
      `Failed to apply formatting edits to document "${documentId}" through Edit Transaction: ${reason}`,
      'FORMAT_TRANSACTION_FAILED'
    );
    this.name = 'FormattingTransactionFailedError';
  }
}

export class FormattingPermissionDeniedError extends LspFormattingError {
  constructor(public readonly documentId: string) {
    super(`Cannot format read-only document "${documentId}".`, 'FORMAT_PERMISSION_DENIED');
    this.name = 'FormattingPermissionDeniedError';
  }
}

export class FormattingCancelledError extends LspFormattingError {
  constructor(message: string = 'Formatting operation was cancelled.') {
    super(message, 'FORMAT_CANCELLED');
    this.name = 'FormattingCancelledError';
  }
}

export class FormattingOverlappingEditsError extends LspFormattingError {
  constructor(public readonly details?: unknown) {
    super('Server returned overlapping formatting edits which cannot be safely applied.', 'FORMAT_OVERLAPPING_EDITS');
    this.name = 'FormattingOverlappingEditsError';
  }
}
