/**
 * QM Editor - LSP Semantic Tokens Errors
 * Phase 06, Step 64 — LSP Semantic Tokens, Semantic Highlighting & Incremental Token Synchronization
 * 
 * Typed error hierarchy for LSP semantic tokens operations,
 * decoding failures, legend mismatches, and stale response rejections.
 */

export class LspSemanticTokenError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'LspSemanticTokenError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SemanticTokenRequestFailed extends LspSemanticTokenError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'SemanticTokenRequestFailed';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SemanticTokenResponseInvalid extends LspSemanticTokenError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'SemanticTokenResponseInvalid';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SemanticTokenLegendInvalid extends LspSemanticTokenError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'SemanticTokenLegendInvalid';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SemanticTokenDecodeFailed extends LspSemanticTokenError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'SemanticTokenDecodeFailed';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SemanticTokenRangeInvalid extends LspSemanticTokenError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'SemanticTokenRangeInvalid';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SemanticTokenStale extends LspSemanticTokenError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'SemanticTokenStale';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SemanticTokenSessionInvalid extends LspSemanticTokenError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'SemanticTokenSessionInvalid';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SemanticTokenUnsupported extends LspSemanticTokenError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'SemanticTokenUnsupported';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SemanticTokenRenderFailed extends LspSemanticTokenError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'SemanticTokenRenderFailed';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SemanticTokenDeltaInvalid extends LspSemanticTokenError {
  constructor(message: string, details?: unknown) {
    super(message, details);
    this.name = 'SemanticTokenDeltaInvalid';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Backward compatibility aliases
export const LspSemanticTokenLegendError = SemanticTokenLegendInvalid;
export const LspSemanticTokenDecodeError = SemanticTokenDecodeFailed;
export const LspSemanticTokenRangeError = SemanticTokenRangeInvalid;
export const LspSemanticTokenStaleError = SemanticTokenStale;
