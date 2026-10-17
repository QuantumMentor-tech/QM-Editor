/**
 * QM Editor - LSP Code Lens Errors
 * Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration
 * 
 * Error taxonomy for Code Lens protocol validation, command execution security,
 * and lifecycle failures.
 */

export class LspCodeLensError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'LspCodeLensError';
  }
}

export class CodeLensUnsupportedError extends LspCodeLensError {
  constructor(languageId: string, details?: Record<string, unknown>) {
    super(`Language server for "${languageId}" does not support Code Lens capability.`, {
      languageId,
      ...details,
    });
    this.name = 'CodeLensUnsupportedError';
  }
}

export class CodeLensStaleError extends LspCodeLensError {
  constructor(
    public readonly expectedRevision: number,
    public readonly actualRevision: number,
    details?: Record<string, unknown>
  ) {
    super(
      `Code Lens response discarded: document revision advanced from ${expectedRevision} to ${actualRevision}`,
      { expectedRevision, actualRevision, ...details }
    );
    this.name = 'CodeLensStaleError';
  }
}

export class CodeLensInvalidRangeError extends LspCodeLensError {
  constructor(
    public readonly startLine: number,
    public readonly endLine: number,
    public readonly docLinesCount: number,
    details?: Record<string, unknown>
  ) {
    super(
      `Code Lens range [${startLine}-${endLine}] is out of bounds for document with ${docLinesCount} lines.`,
      { startLine, endLine, docLinesCount, ...details }
    );
    this.name = 'CodeLensInvalidRangeError';
  }
}

export class CodeLensUntrustedCommandError extends LspCodeLensError {
  constructor(
    public readonly commandId: string,
    public readonly reason: string,
    details?: Record<string, unknown>
  ) {
    super(`Code Lens command "${commandId}" blocked by security boundary: ${reason}`, {
      commandId,
      reason,
      ...details,
    });
    this.name = 'CodeLensUntrustedCommandError';
  }
}

export class CodeLensMalformedPayloadError extends LspCodeLensError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Malformed Code Lens payload: ${message}`, details);
    this.name = 'CodeLensMalformedPayloadError';
  }
}

export class CodeLensResolutionFailedError extends LspCodeLensError {
  constructor(
    public readonly lensId: string,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(`Failed to resolve Code Lens "${lensId}": ${message}`, { lensId, ...details });
    this.name = 'CodeLensResolutionFailedError';
  }
}
