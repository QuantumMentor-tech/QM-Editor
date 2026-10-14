/**
 * QM Editor Storage & Persistence Errors
 * Phase 05, Step 46 — Data & Storage Architecture Foundation
 */

export type StorageErrorCode =
  | 'STORAGE_NOT_READY'
  | 'STORAGE_DISPOSED'
  | 'STORAGE_READ_ONLY'
  | 'STORAGE_CORRUPT_DATA'
  | 'STORAGE_VERSION_CONFLICT'
  | 'STORAGE_VALIDATION_FAILED'
  | 'STORAGE_MIGRATION_FAILED'
  | 'STORAGE_SERIALIZATION_FAILED'
  | 'STORAGE_SENSITIVE_DATA_REJECTED'
  | 'STORAGE_KEY_INVALID'
  | 'STORAGE_IO_FAILED';

export class StorageError extends Error {
  public readonly code: StorageErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: StorageErrorCode, details?: Record<string, unknown>) {
    super(`[${code}] ${message}`);
    this.name = 'StorageError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class StorageNotReadyError extends StorageError {
  constructor(message: string = 'Storage service has not finished initializing.') {
    super(message, 'STORAGE_NOT_READY');
  }
}

export class StorageDisposedError extends StorageError {
  constructor(message: string = 'Storage service has been disposed.') {
    super(message, 'STORAGE_DISPOSED');
  }
}

export class StorageReadOnlyError extends StorageError {
  constructor(message: string = 'Storage is in read-only mode; write operations are rejected.') {
    super(message, 'STORAGE_READ_ONLY');
  }
}

export class StorageCorruptDataError extends StorageError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STORAGE_CORRUPT_DATA', details);
  }
}

export class StorageVersionConflictError extends StorageError {
  constructor(
    message: string = 'Concurrent update rejected due to optimistic version conflict.',
    details?: Record<string, unknown>
  ) {
    super(message, 'STORAGE_VERSION_CONFLICT', details);
  }
}

export class StorageValidationError extends StorageError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STORAGE_VALIDATION_FAILED', details);
  }
}

export class StorageMigrationError extends StorageError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STORAGE_MIGRATION_FAILED', details);
  }
}

export class StorageSerializationError extends StorageError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STORAGE_SERIALIZATION_FAILED', details);
  }
}

export class StorageSensitiveDataError extends StorageError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STORAGE_SENSITIVE_DATA_REJECTED', details);
  }
}
