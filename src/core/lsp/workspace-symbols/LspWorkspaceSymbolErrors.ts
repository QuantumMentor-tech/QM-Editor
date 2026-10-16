/**
 * QM Editor LSP Workspace Symbol Errors
 * Phase 06, Step 61 — LSP Workspace Symbols, Cross-File Symbol Search & Symbol Navigation
 */

import { LspError } from '../LspErrors';

export class WorkspaceSymbolRequestFailedError extends LspError {
  constructor(reason: string) {
    super(`LSP Workspace Symbol search request failed: ${reason}`);
    this.name = 'WorkspaceSymbolRequestFailedError';
  }
}

export class WorkspaceSymbolResponseInvalidError extends LspError {
  constructor(details: string) {
    super(`LSP Workspace Symbol response was invalid or malformed: ${details}`);
    this.name = 'WorkspaceSymbolResponseInvalidError';
  }
}

export class WorkspaceSymbolLocationInvalidError extends LspError {
  constructor(symbolName: string, uri: string, details: string) {
    super(`LSP Workspace Symbol location invalid for '${symbolName}' [${uri}]: ${details}`);
    this.name = 'WorkspaceSymbolLocationInvalidError';
  }
}

export class WorkspaceSymbolProviderUnavailableError extends LspError {
  constructor(reason: string = 'No active LSP server session available for workspace symbol search') {
    super(`LSP Workspace Symbol provider unavailable: ${reason}`);
    this.name = 'WorkspaceSymbolProviderUnavailableError';
  }
}

export class WorkspaceSymbolStaleError extends LspError {
  constructor(reason: string) {
    super(`LSP Workspace Symbol results rejected due to stale context: ${reason}`);
    this.name = 'WorkspaceSymbolStaleError';
  }
}

export class WorkspaceSymbolCancelledError extends LspError {
  constructor(reason: string = 'Operation cancelled') {
    super(`LSP Workspace Symbol search was cancelled: ${reason}`);
    this.name = 'WorkspaceSymbolCancelledError';
  }
}

export class WorkspaceSymbolUnsupportedError extends LspError {
  constructor(serverName: string) {
    super(`LSP server '${serverName}' does not declare workspaceSymbolProvider capability.`);
    this.name = 'WorkspaceSymbolUnsupportedError';
  }
}
