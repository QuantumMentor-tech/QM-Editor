/**
 * QM Editor Document Engine Errors
 * Phase 04, Step 36 — Core Application Engine
 */

export class DocumentEngineError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'DocumentEngineError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DocumentNotFoundError extends DocumentEngineError {
  public readonly documentIdOrUri: string;

  constructor(documentIdOrUri: string) {
    super(`Document "${documentIdOrUri}" was not found in registry.`, 'DOCUMENT_NOT_FOUND');
    this.name = 'DocumentNotFoundError';
    this.documentIdOrUri = documentIdOrUri;
  }
}

export class DocumentAlreadyOpenError extends DocumentEngineError {
  public readonly resourceUri: string;
  public readonly existingDocumentId: string;

  constructor(resourceUri: string, existingDocumentId: string) {
    super(
      `Resource "${resourceUri}" is already open as document "${existingDocumentId}".`,
      'DOCUMENT_ALREADY_OPEN'
    );
    this.name = 'DocumentAlreadyOpenError';
    this.resourceUri = resourceUri;
    this.existingDocumentId = existingDocumentId;
  }
}

export class DocumentReadOnlyError extends DocumentEngineError {
  public readonly documentId: string;
  public readonly reason?: string;

  constructor(documentId: string, reason?: string) {
    super(
      `Document "${documentId}" is read-only and cannot be modified or saved.${reason ? ` Reason: ${reason}` : ''}`,
      'DOCUMENT_READ_ONLY'
    );
    this.name = 'DocumentReadOnlyError';
    this.documentId = documentId;
    this.reason = reason;
  }
}

export class DocumentSaveError extends DocumentEngineError {
  public readonly documentId: string;
  public readonly underlyingError: string;

  constructor(documentId: string, underlyingError: string) {
    super(`Failed to save document "${documentId}": ${underlyingError}`, 'DOCUMENT_SAVE_ERROR');
    this.name = 'DocumentSaveError';
    this.documentId = documentId;
    this.underlyingError = underlyingError;
  }
}

export class DocumentSaveConflictError extends DocumentEngineError {
  public readonly documentId: string;
  public readonly resourceUri: string;

  constructor(documentId: string, resourceUri: string) {
    super(
      `Cannot save document "${documentId}": resource "${resourceUri}" has conflicting external changes.`,
      'DOCUMENT_SAVE_CONFLICT'
    );
    this.name = 'DocumentSaveConflictError';
    this.documentId = documentId;
    this.resourceUri = resourceUri;
  }
}

export class DocumentDisposedError extends DocumentEngineError {
  public readonly operation: string;

  constructor(operation: string) {
    super(`Cannot perform "${operation}": Document Engine has been disposed.`, 'DOCUMENT_ENGINE_DISPOSED');
    this.name = 'DocumentDisposedError';
    this.operation = operation;
  }
}

export class DocumentUnsavedChangesError extends DocumentEngineError {
  public readonly documentId: string;
  public readonly title: string;

  constructor(documentId: string, title: string) {
    super(`Document "${title}" (${documentId}) has unsaved changes.`, 'DOCUMENT_UNSAVED_CHANGES');
    this.name = 'DocumentUnsavedChangesError';
    this.documentId = documentId;
    this.title = title;
  }
}
