/**
 * QM Editor Edit Transaction Errors
 * Phase 04, Step 31 — Core Document Lifecycle Subsystem
 */

export class EditError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code: string = 'EDIT_ERROR', details?: unknown) {
    super(message);
    this.name = 'EditError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidEditRangeError extends EditError {
  constructor(from: number, to: number, contentLength: number) {
    super(
      `Invalid edit range [${from}, ${to}] for document of length ${contentLength}.`,
      'INVALID_EDIT_RANGE',
      { from, to, contentLength }
    );
    this.name = 'InvalidEditRangeError';
  }
}

export class OverlappingEditError extends EditError {
  constructor(firstFrom: number, firstTo: number, secondFrom: number, secondTo: number) {
    super(
      `Overlapping edits detected in transaction: [${firstFrom}, ${firstTo}] overlaps with [${secondFrom}, ${secondTo}].`,
      'OVERLAPPING_EDITS',
      { firstFrom, firstTo, secondFrom, secondTo }
    );
    this.name = 'OverlappingEditError';
  }
}

export class StaleRevisionError extends EditError {
  constructor(documentId: string, baseRevision: number, currentRevision: number) {
    super(
      `Stale edit transaction for document "${documentId}": base revision ${baseRevision} does not match current revision ${currentRevision}.`,
      'STALE_REVISION',
      { documentId, baseRevision, currentRevision }
    );
    this.name = 'StaleRevisionError';
  }
}

export class ReadOnlyDocumentError extends EditError {
  constructor(documentId: string, title?: string) {
    super(
      `Cannot apply edit transaction: document "${title || documentId}" is read-only.`,
      'READ_ONLY_DOCUMENT',
      { documentId, title }
    );
    this.name = 'ReadOnlyDocumentError';
  }
}

export class TransactionAbortedError extends EditError {
  constructor(reason: string = 'Transaction was cancelled or rejected by validator') {
    super(`Edit transaction aborted: ${reason}`, 'TRANSACTION_ABORTED', { reason });
    this.name = 'TransactionAbortedError';
  }
}
