/**
 * QM Editor Error Base & Hierarchy
 */

export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

export enum ErrorCode {
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_PATH = 'INVALID_PATH',
  SAVE_CONFLICT = 'SAVE_CONFLICT',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  BINARY_NOT_SUPPORTED = 'BINARY_NOT_SUPPORTED',
  USER_CANCELLED = 'USER_CANCELLED',
  DOCUMENT_VALIDATION_ERROR = 'DOCUMENT_VALIDATION_ERROR',
  INVALID_WORKSPACE_STATE = 'INVALID_WORKSPACE_STATE',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

export class QMEditorError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: number;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.DOCUMENT_VALIDATION_ERROR,
    severity: ErrorSeverity = 'error',
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'QMEditorError';
    this.code = code;
    this.severity = severity;
    this.timestamp = Date.now();
    this.context = context;

    // Restore prototype chain for ES5/ES6 compatibility
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
