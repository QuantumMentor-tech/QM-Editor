/**
 * QM Editor — LSP Folding Errors
 * Phase 06, Step 68 — LSP Folding Ranges, Smart Code Folding & Safe Document Structure Navigation
 */

export class LspFoldingError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'LspFoldingError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FoldingUnsupportedError extends LspFoldingError {
  constructor(message = 'Folding ranges are not supported by the language server') {
    super(message, 'FOLDING_UNSUPPORTED');
    this.name = 'FoldingUnsupportedError';
  }
}

export class FoldingStaleError extends LspFoldingError {
  constructor(message = 'Folding range request or response is stale') {
    super(message, 'FOLDING_STALE');
    this.name = 'FoldingStaleError';
  }
}

export class FoldingInvalidRangeError extends LspFoldingError {
  constructor(message = 'Invalid folding range bounds or line coordinates') {
    super(message, 'FOLDING_INVALID_RANGE');
    this.name = 'FoldingInvalidRangeError';
  }
}

export class FoldingDepthExceededError extends LspFoldingError {
  constructor(message = 'Folding range hierarchy exceeded maximum nesting depth') {
    super(message, 'FOLDING_DEPTH_EXCEEDED');
    this.name = 'FoldingDepthExceededError';
  }
}

export class FoldingLimitExceededError extends LspFoldingError {
  constructor(message = 'Document folding range count exceeded safety limit') {
    super(message, 'FOLDING_LIMIT_EXCEEDED');
    this.name = 'FoldingLimitExceededError';
  }
}

export class FoldingServerRestartedError extends LspFoldingError {
  constructor(message = 'Language server restarted while folding range was in flight') {
    super(message, 'FOLDING_SERVER_RESTARTED');
    this.name = 'FoldingServerRestartedError';
  }
}

export class FoldingProviderUnavailableError extends LspFoldingError {
  constructor(message = 'Language intelligence folding provider is unavailable') {
    super(message, 'FOLDING_PROVIDER_UNAVAILABLE');
    this.name = 'FoldingProviderUnavailableError';
  }
}
