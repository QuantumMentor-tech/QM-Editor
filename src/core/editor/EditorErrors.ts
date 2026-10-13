/**
 * QM Editor Engine Coordination Errors
 * Phase 04, Step 37 — Core Application Engine
 */

export class EditorEngineError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'EditorEngineError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EditorInstanceNotFoundError extends EditorEngineError {
  public readonly instanceId: string;

  constructor(instanceId: string) {
    super(`Editor instance "${instanceId}" was not found.`, 'EDITOR_INSTANCE_NOT_FOUND');
    this.name = 'EditorInstanceNotFoundError';
    this.instanceId = instanceId;
  }
}

export class StaleTransactionError extends EditorEngineError {
  public readonly documentId: string;
  public readonly expectedRevision: number;
  public readonly currentRevision: number;

  constructor(documentId: string, expectedRevision: number, currentRevision: number) {
    super(
      `Transaction rejected as stale: expected revision ${expectedRevision}, but document "${documentId}" is at revision ${currentRevision}.`,
      'STALE_TRANSACTION'
    );
    this.name = 'StaleTransactionError';
    this.documentId = documentId;
    this.expectedRevision = expectedRevision;
    this.currentRevision = currentRevision;
  }
}

export class InvalidEditRangeError extends EditorEngineError {
  public readonly from: number;
  public readonly to: number;
  public readonly textLength: number;

  constructor(from: number, to: number, textLength: number) {
    super(
      `Invalid edit range [${from}, ${to}] exceeds document length ${textLength}.`,
      'INVALID_EDIT_RANGE'
    );
    this.name = 'InvalidEditRangeError';
    this.from = from;
    this.to = to;
    this.textLength = textLength;
  }
}

export class ReadOnlyEditError extends EditorEngineError {
  public readonly documentId: string;

  constructor(documentId: string) {
    super(
      `Cannot apply edits to document "${documentId}": document is marked read-only.`,
      'READ_ONLY_EDIT'
    );
    this.name = 'ReadOnlyEditError';
    this.documentId = documentId;
  }
}

export class ConflictEditError extends EditorEngineError {
  public readonly documentId: string;

  constructor(documentId: string) {
    super(
      `Cannot apply edits to document "${documentId}": document has an unresolved external disk conflict.`,
      'CONFLICT_EDIT'
    );
    this.name = 'ConflictEditError';
    this.documentId = documentId;
  }
}

export class DocumentNotAvailableError extends EditorEngineError {
  public readonly documentId: string;

  constructor(documentId: string) {
    super(
      `Cannot coordinate editor for document "${documentId}": document is not open in DocumentEngine.`,
      'DOCUMENT_NOT_AVAILABLE'
    );
    this.name = 'DocumentNotAvailableError';
    this.documentId = documentId;
  }
}
