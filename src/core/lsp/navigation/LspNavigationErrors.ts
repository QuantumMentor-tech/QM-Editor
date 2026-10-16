/**
 * QM Editor LSP Code Navigation Errors
 * Phase 06, Step 60 — LSP Code Navigation, Definitions, Declarations, Type Definitions & References
 */

import { LspError } from '../LspErrors';

export class NavigationRequestFailedError extends LspError {
  constructor(method: string, reason: string) {
    super(`LSP Navigation request '${method}' failed: ${reason}`);
    this.name = 'NavigationRequestFailedError';
  }
}

export class NavigationResponseInvalidError extends LspError {
  constructor(method: string, details: string) {
    super(`LSP Navigation response for '${method}' was invalid or malformed: ${details}`);
    this.name = 'NavigationResponseInvalidError';
  }
}

export class NavigationLocationInvalidError extends LspError {
  constructor(uri: string, details: string) {
    super(`LSP Navigation location is invalid [${uri}]: ${details}`);
    this.name = 'NavigationLocationInvalidError';
  }
}

export class NavigationUriUnsupportedError extends LspError {
  constructor(uri: string, scheme: string) {
    super(`LSP Navigation URI scheme '${scheme}' is unsupported or blocked for security: ${uri}`);
    this.name = 'NavigationUriUnsupportedError';
  }
}

export class NavigationTargetMissingError extends LspError {
  constructor(uri: string) {
    super(`LSP Navigation target does not exist or cannot be resolved: ${uri}`);
    this.name = 'NavigationTargetMissingError';
  }
}

export class NavigationStaleError extends LspError {
  constructor(reason: string) {
    super(`LSP Navigation result rejected because context became stale: ${reason}`);
    this.name = 'NavigationStaleError';
  }
}

export class ReferencesRequestFailedError extends LspError {
  constructor(reason: string) {
    super(`LSP Find References request failed: ${reason}`);
    this.name = 'ReferencesRequestFailedError';
  }
}

export class ReferencesCancelledError extends LspError {
  constructor(reason: string = 'Operation cancelled') {
    super(`LSP Find References request was cancelled: ${reason}`);
    this.name = 'ReferencesCancelledError';
  }
}

export class NavigationProviderUnavailableError extends LspError {
  constructor(capability: string, languageId: string) {
    super(`LSP Navigation capability '${capability}' is unavailable for language '${languageId}'`);
    this.name = 'NavigationProviderUnavailableError';
  }
}
