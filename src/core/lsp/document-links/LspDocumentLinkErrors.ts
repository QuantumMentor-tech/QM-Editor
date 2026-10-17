/**
 * QM Editor - LSP Document Link Error Taxonomy
 * Phase 06, Step 67 — LSP Document Links, Clickable Resource References & Safe URI Navigation
 */

export class LspDocumentLinkError extends Error {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'LspDocumentLinkError';
  }
}

export class DocumentLinkUnsupportedError extends LspDocumentLinkError {
  constructor(languageId: string, details?: Record<string, unknown>) {
    super(`Document link provider is not supported by language server for "${languageId}".`, {
      languageId,
      ...details,
    });
    this.name = 'DocumentLinkUnsupportedError';
  }
}

export class DocumentLinkStaleError extends LspDocumentLinkError {
  constructor(uri: string, currentRevision: number, requestRevision: number, details?: Record<string, unknown>) {
    super(
      `Document link response for "${uri}" is stale (current: ${currentRevision}, request: ${requestRevision}).`,
      { uri, currentRevision, requestRevision, ...details }
    );
    this.name = 'DocumentLinkStaleError';
  }
}

export class DocumentLinkInvalidRangeError extends LspDocumentLinkError {
  constructor(uri: string, reason: string, details?: Record<string, unknown>) {
    super(`Document link range invalid for "${uri}": ${reason}`, { uri, reason, ...details });
    this.name = 'DocumentLinkInvalidRangeError';
  }
}

export class DocumentLinkSecurityRejectedError extends LspDocumentLinkError {
  constructor(target: string, reason: string, details?: Record<string, unknown>) {
    super(`Document link navigation blocked for security reasons: "${target}". Reason: ${reason}`, {
      target,
      reason,
      ...details,
    });
    this.name = 'DocumentLinkSecurityRejectedError';
  }
}

export class DocumentLinkResolutionFailedError extends LspDocumentLinkError {
  constructor(linkId: string, reason: string, details?: Record<string, unknown>) {
    super(`Failed to resolve document link "${linkId}": ${reason}`, { linkId, reason, ...details });
    this.name = 'DocumentLinkResolutionFailedError';
  }
}

export class DocumentLinkTargetMissingError extends LspDocumentLinkError {
  constructor(target: string, details?: Record<string, unknown>) {
    super(`Target resource does not exist: "${target}".`, { target, ...details });
    this.name = 'DocumentLinkTargetMissingError';
  }
}
