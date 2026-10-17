/**
 * QM Editor - LSP Inlay Hints Errors
 * Phase 06, Step 65 — LSP Inlay Hints, Parameter Names, Type Information & Inline Semantic Annotations
 * 
 * Error taxonomy for inlay hint validation, positioning, and lifecycle failures.
 */

export class LspInlayHintError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'LspInlayHintError';
  }
}

export class InlayHintInvalidPositionError extends LspInlayHintError {
  constructor(
    public readonly line: number,
    public readonly character: number,
    public readonly maxLine: number,
    public readonly maxChar: number,
    details?: Record<string, unknown>
  ) {
    super(
      `Inlay hint position [${line}:${character}] is out of bounds (document: ${maxLine} lines, line ${line} length: ${maxChar})`,
      { line, character, maxLine, maxChar, ...details }
    );
    this.name = 'InlayHintInvalidPositionError';
  }
}

export class InlayHintStaleError extends LspInlayHintError {
  constructor(
    public readonly expectedRevision: number,
    public readonly actualRevision: number,
    details?: Record<string, unknown>
  ) {
    super(
      `Inlay hint response discarded: document revision advanced from ${expectedRevision} to ${actualRevision}`,
      { expectedRevision, actualRevision, ...details }
    );
    this.name = 'InlayHintStaleError';
  }
}

export class InlayHintMalformedPayloadError extends LspInlayHintError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Malformed inlay hint payload: ${message}`, details);
    this.name = 'InlayHintMalformedPayloadError';
  }
}
