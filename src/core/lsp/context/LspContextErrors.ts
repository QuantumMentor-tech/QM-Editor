/**
 * QM Editor LSP Contextual Intelligence Error Taxonomy
 * Phase 06, Step 59 — LSP Hover, Signature Help & Contextual Documentation Integration
 */

export class HoverRequestFailedError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(`HoverRequestFailed: ${message}`);
    this.name = 'HoverRequestFailedError';
  }
}

export class HoverResponseInvalidError extends Error {
  constructor(message: string, public readonly payload?: unknown) {
    super(`HoverResponseInvalid: ${message}`);
    this.name = 'HoverResponseInvalidError';
  }
}

export class HoverContentInvalidError extends Error {
  constructor(message: string) {
    super(`HoverContentInvalid: ${message}`);
    this.name = 'HoverContentInvalidError';
  }
}

export class HoverStaleError extends Error {
  constructor(message: string = 'Hover response discarded because the editor context or revision changed.') {
    super(`HoverStale: ${message}`);
    this.name = 'HoverStaleError';
  }
}

export class SignatureRequestFailedError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(`SignatureRequestFailed: ${message}`);
    this.name = 'SignatureRequestFailedError';
  }
}

export class SignatureResponseInvalidError extends Error {
  constructor(message: string, public readonly payload?: unknown) {
    super(`SignatureResponseInvalid: ${message}`);
    this.name = 'SignatureResponseInvalidError';
  }
}

export class SignatureContextInvalidError extends Error {
  constructor(message: string) {
    super(`SignatureContextInvalid: ${message}`);
    this.name = 'SignatureContextInvalidError';
  }
}

export class SignatureStaleError extends Error {
  constructor(message: string = 'Signature help response discarded because the editor context or revision changed.') {
    super(`SignatureStale: ${message}`);
    this.name = 'SignatureStaleError';
  }
}

export class ContextProviderUnavailableError extends Error {
  constructor(public readonly feature: 'hover' | 'signatureHelp', message: string) {
    super(`ContextProviderUnavailable [${feature}]: ${message}`);
    this.name = 'ContextProviderUnavailableError';
  }
}
