/**
 * QM Editor Canonical LSP Completion Errors
 * Phase 06, Step 58 — LSP Completion Integration, Suggestion Intelligence & Safe Completion Acceptance
 */

import { LspError } from '../LspErrors';

export class CompletionRequestFailedError extends LspError {
  constructor(message: string, public readonly cause?: unknown) {
    super(`Completion request failed: ${message}`);
    this.name = 'CompletionRequestFailedError';
  }
}

export class CompletionResponseInvalidError extends LspError {
  constructor(reason: string) {
    super(`LSP completion response is invalid: ${reason}`);
    this.name = 'CompletionResponseInvalidError';
  }
}

export class CompletionRangeInvalidError extends LspError {
  constructor(reason: string) {
    super(`LSP completion range is invalid: ${reason}`);
    this.name = 'CompletionRangeInvalidError';
  }
}

export class CompletionStaleError extends LspError {
  constructor(message: string) {
    super(`Completion rejected due to stale context: ${message}`);
    this.name = 'CompletionStaleError';
  }
}

export class CompletionContextInvalidError extends LspError {
  constructor(reason: string) {
    super(`Completion context is invalid: ${reason}`);
    this.name = 'CompletionContextInvalidError';
  }
}

export class CompletionProviderUnavailableError extends LspError {
  constructor(reason: string) {
    super(`LSP completion provider unavailable: ${reason}`);
    this.name = 'CompletionProviderUnavailableError';
  }
}

export class CompletionEditRejectedError extends LspError {
  constructor(reason: string) {
    super(`LSP completion edit was rejected: ${reason}`);
    this.name = 'CompletionEditRejectedError';
  }
}

export class CompletionResolveFailedError extends LspError {
  constructor(label: string, reason: string) {
    super(`Failed to resolve completion item "${label}": ${reason}`);
    this.name = 'CompletionResolveFailedError';
  }
}

export class UnsupportedCompletionFeatureError extends LspError {
  constructor(feature: string) {
    super(`Unsupported completion feature: ${feature}`);
    this.name = 'UnsupportedCompletionFeatureError';
  }
}
