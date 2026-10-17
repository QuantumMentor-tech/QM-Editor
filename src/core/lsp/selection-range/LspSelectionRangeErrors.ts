/**
 * QM Editor — LSP Selection Range Errors
 * Phase 06, Step 69 — LSP Selection Ranges, Smart Structural Selection & Context-Aware Cursor Expansion
 */

export type SelectionRangeErrorCode =
  | 'SELECTION_RANGE_UNSUPPORTED'
  | 'SELECTION_RANGE_REQUEST_FAILED'
  | 'SELECTION_RANGE_CANCELLED'
  | 'SELECTION_RANGE_STALE'
  | 'SELECTION_RANGE_INVALID_RESULT'
  | 'SELECTION_RANGE_INVALID_RANGE'
  | 'SELECTION_RANGE_CYCLE_DETECTED'
  | 'SELECTION_RANGE_DEPTH_EXCEEDED'
  | 'SELECTION_RANGE_PROVIDER_UNAVAILABLE';

export class SelectionRangeError extends Error {
  constructor(
    public readonly code: SelectionRangeErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(`[${code}] ${message}`);
    this.name = 'SelectionRangeError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SelectionRangeUnsupportedError extends SelectionRangeError {
  constructor(languageId?: string) {
    super(
      'SELECTION_RANGE_UNSUPPORTED',
      `Selection ranges are not supported by the language server for '${languageId || 'current document'}'.`
    );
  }
}

export class SelectionRangeRequestFailedError extends SelectionRangeError {
  constructor(message: string, details?: unknown) {
    super('SELECTION_RANGE_REQUEST_FAILED', `Selection range request failed: ${message}`, details);
  }
}

export class SelectionRangeCancelledError extends SelectionRangeError {
  constructor(reason?: string) {
    super(
      'SELECTION_RANGE_CANCELLED',
      `Selection range request was cancelled${reason ? `: ${reason}` : '.'}`
    );
  }
}

export class SelectionRangeStaleError extends SelectionRangeError {
  constructor(reason: string) {
    super('SELECTION_RANGE_STALE', `Selection range response discarded as stale: ${reason}`);
  }
}

export class SelectionRangeInvalidResultError extends SelectionRangeError {
  constructor(message: string, details?: unknown) {
    super('SELECTION_RANGE_INVALID_RESULT', `Invalid selection range response: ${message}`, details);
  }
}

export class SelectionRangeInvalidRangeError extends SelectionRangeError {
  constructor(message: string, details?: unknown) {
    super('SELECTION_RANGE_INVALID_RANGE', `Invalid range in selection range response: ${message}`, details);
  }
}

export class SelectionRangeCycleError extends SelectionRangeError {
  constructor(cycleDescription: string) {
    super(
      'SELECTION_RANGE_CYCLE_DETECTED',
      `Cycle detected in selection range hierarchy: ${cycleDescription}`
    );
  }
}

export class SelectionRangeDepthExceededError extends SelectionRangeError {
  constructor(depth: number, maxDepth: number) {
    super(
      'SELECTION_RANGE_DEPTH_EXCEEDED',
      `Selection range hierarchy depth (${depth}) exceeded maximum permitted depth (${maxDepth}).`
    );
  }
}

export class SelectionRangeProviderUnavailableError extends SelectionRangeError {
  constructor(reason?: string) {
    super(
      'SELECTION_RANGE_PROVIDER_UNAVAILABLE',
      `Selection range provider is currently unavailable${reason ? `: ${reason}` : '.'}`
    );
  }
}
