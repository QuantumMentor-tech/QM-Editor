/**
 * QM Editor Diagnostic Subsystem Errors
 * Phase 04, Step 34 — Core Engine Diagnostics Model, Aggregation & Editor Integration
 */

import { QMEditorError, ErrorCode } from '../../utils/errors';

export class DiagnosticValidationError extends QMEditorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      `Diagnostic validation error: ${message}`,
      ErrorCode.DOCUMENT_VALIDATION_ERROR,
      'warning',
      details
    );
    this.name = 'DiagnosticValidationError';
  }
}

export class DuplicateCollectionError extends QMEditorError {
  constructor(collectionName: string) {
    super(
      `DiagnosticCollection with name '${collectionName}' is already registered`,
      ErrorCode.SERVICE_UNAVAILABLE,
      'error',
      { collectionName }
    );
    this.name = 'DuplicateCollectionError';
  }
}

export class StaleDiagnosticError extends QMEditorError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      `Stale diagnostic update rejected: ${message}`,
      ErrorCode.DOCUMENT_VALIDATION_ERROR,
      'warning',
      details
    );
    this.name = 'StaleDiagnosticError';
  }
}
