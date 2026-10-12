/**
 * QM Editor Undo/Redo History Errors
 * Phase 04, Step 33 — Core Document Lifecycle Subsystem
 */

export class HistoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HistoryError';
  }
}

export class NothingToUndoError extends HistoryError {
  public documentId: string;

  constructor(documentId: string) {
    super(`Cannot perform undo: undo stack is empty for document "${documentId}".`);
    this.name = 'NothingToUndoError';
    this.documentId = documentId;
  }
}

export class NothingToRedoError extends HistoryError {
  public documentId: string;

  constructor(documentId: string) {
    super(`Cannot perform redo: redo stack is empty for document "${documentId}".`);
    this.name = 'NothingToRedoError';
    this.documentId = documentId;
  }
}

export class InvalidGroupStateError extends HistoryError {
  public documentId: string;

  constructor(documentId: string, message: string) {
    super(`Invalid edit group state for document "${documentId}": ${message}`);
    this.name = 'InvalidGroupStateError';
    this.documentId = documentId;
  }
}

export class HistoryCorruptedError extends HistoryError {
  public documentId: string;

  constructor(documentId: string, message: string) {
    super(`History corrupted for document "${documentId}": ${message}`);
    this.name = 'HistoryCorruptedError';
    this.documentId = documentId;
  }
}
