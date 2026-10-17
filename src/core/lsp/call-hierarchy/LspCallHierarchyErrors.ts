/**
 * QM Editor — LSP Call Hierarchy Errors
 * Phase 06, Step 70 — LSP Call Hierarchy, Callers, Callees & Safe Cross-File Code Relationship Navigation
 */

export type CallHierarchyErrorCode =
  | 'CALL_HIERARCHY_UNSUPPORTED'
  | 'CALL_HIERARCHY_PREPARE_FAILED'
  | 'CALL_HIERARCHY_INCOMING_FAILED'
  | 'CALL_HIERARCHY_OUTGOING_FAILED'
  | 'CALL_HIERARCHY_CANCELLED'
  | 'CALL_HIERARCHY_STALE'
  | 'CALL_HIERARCHY_INVALID_ITEM'
  | 'CALL_HIERARCHY_INVALID_RANGE'
  | 'CALL_HIERARCHY_INVALID_CALL'
  | 'CALL_HIERARCHY_CYCLE_DETECTED'
  | 'CALL_HIERARCHY_DEPTH_EXCEEDED'
  | 'CALL_HIERARCHY_LIMIT_EXCEEDED'
  | 'CALL_HIERARCHY_SERVER_RESTARTED'
  | 'CALL_HIERARCHY_PROVIDER_UNAVAILABLE';

export class CallHierarchyError extends Error {
  constructor(
    public readonly code: CallHierarchyErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(`[${code}] ${message}`);
    this.name = 'CallHierarchyError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CallHierarchyUnsupportedError extends CallHierarchyError {
  constructor(languageId?: string) {
    super(
      'CALL_HIERARCHY_UNSUPPORTED',
      `Call hierarchy is not supported by the language server for '${languageId || 'current document'}'.`
    );
  }
}

export class CallHierarchyPrepareFailedError extends CallHierarchyError {
  constructor(message: string, details?: unknown) {
    super('CALL_HIERARCHY_PREPARE_FAILED', `Prepare call hierarchy failed: ${message}`, details);
  }
}

export class CallHierarchyIncomingFailedError extends CallHierarchyError {
  constructor(symbolName: string, message: string, details?: unknown) {
    super(
      'CALL_HIERARCHY_INCOMING_FAILED',
      `Failed to retrieve incoming calls for '${symbolName}': ${message}`,
      details
    );
  }
}

export class CallHierarchyOutgoingFailedError extends CallHierarchyError {
  constructor(symbolName: string, message: string, details?: unknown) {
    super(
      'CALL_HIERARCHY_OUTGOING_FAILED',
      `Failed to retrieve outgoing calls for '${symbolName}': ${message}`,
      details
    );
  }
}

export class CallHierarchyCancelledError extends CallHierarchyError {
  constructor(reason?: string) {
    super(
      'CALL_HIERARCHY_CANCELLED',
      `Call hierarchy request was cancelled${reason ? `: ${reason}` : '.'}`
    );
  }
}

export class CallHierarchyStaleError extends CallHierarchyError {
  constructor(reason: string) {
    super('CALL_HIERARCHY_STALE', `Call hierarchy result discarded as stale: ${reason}`);
  }
}

export class CallHierarchyInvalidItemError extends CallHierarchyError {
  constructor(message: string, details?: unknown) {
    super('CALL_HIERARCHY_INVALID_ITEM', `Invalid call hierarchy item: ${message}`, details);
  }
}

export class CallHierarchyInvalidRangeError extends CallHierarchyError {
  constructor(message: string, details?: unknown) {
    super('CALL_HIERARCHY_INVALID_RANGE', `Invalid range in call hierarchy response: ${message}`, details);
  }
}

export class CallHierarchyInvalidCallError extends CallHierarchyError {
  constructor(message: string, details?: unknown) {
    super('CALL_HIERARCHY_INVALID_CALL', `Invalid call relationship: ${message}`, details);
  }
}

export class CallHierarchyCycleError extends CallHierarchyError {
  constructor(symbolName: string) {
    super(
      'CALL_HIERARCHY_CYCLE_DETECTED',
      `Cyclic call relationship detected for symbol '${symbolName}'.`
    );
  }
}

export class CallHierarchyDepthExceededError extends CallHierarchyError {
  constructor(depth: number, maxDepth: number) {
    super(
      'CALL_HIERARCHY_DEPTH_EXCEEDED',
      `Call hierarchy depth (${depth}) exceeded maximum permitted depth (${maxDepth}).`
    );
  }
}

export class CallHierarchyLimitExceededError extends CallHierarchyError {
  constructor(count: number, limit: number) {
    super(
      'CALL_HIERARCHY_LIMIT_EXCEEDED',
      `Call results count (${count}) exceeded safety limit (${limit}).`
    );
  }
}

export class CallHierarchyServerRestartedError extends CallHierarchyError {
  constructor(sessionId?: string) {
    super(
      'CALL_HIERARCHY_SERVER_RESTARTED',
      `Language server session ${sessionId || ''} was restarted during call hierarchy operation.`
    );
  }
}

export class CallHierarchyProviderUnavailableError extends CallHierarchyError {
  constructor(reason?: string) {
    super(
      'CALL_HIERARCHY_PROVIDER_UNAVAILABLE',
      `Call hierarchy provider is currently unavailable${reason ? `: ${reason}` : '.'}`
    );
  }
}
