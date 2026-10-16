/**
 * QM Editor Canonical LSP Error Classes
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 */

import { ResponseError } from './LspTypes';

export class LspError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LspError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LspProtocolError extends LspError {
  public readonly code: number;
  public readonly data?: unknown;

  constructor(error: ResponseError) {
    super(`LSP Protocol Error [${error.code}]: ${error.message}`);
    this.name = 'LspProtocolError';
    this.code = error.code;
    this.data = error.data;
  }
}

export class LspTimeoutError extends LspError {
  public readonly method: string;
  public readonly timeoutMs: number;

  constructor(method: string, timeoutMs: number) {
    super(`LSP Request timed out after ${timeoutMs}ms: method="${method}"`);
    this.name = 'LspTimeoutError';
    this.method = method;
    this.timeoutMs = timeoutMs;
  }
}

export class LspCancelledError extends LspError {
  public readonly method: string;

  constructor(method: string) {
    super(`LSP Request was cancelled: method="${method}"`);
    this.name = 'LspCancelledError';
    this.method = method;
  }
}

export class LspLifecycleError extends LspError {
  public readonly currentState: string;
  public readonly attemptedAction: string;

  constructor(currentState: string, attemptedAction: string) {
    super(`Invalid LSP Server lifecycle transition: cannot "${attemptedAction}" while in state "${currentState}"`);
    this.name = 'LspLifecycleError';
    this.currentState = currentState;
    this.attemptedAction = attemptedAction;
  }
}

export class LspTrustError extends LspError {
  public readonly command: string;
  public readonly reason: string;

  constructor(command: string, reason: string) {
    super(`LSP Executable trust security rejection for command "${command}": ${reason}`);
    this.name = 'LspTrustError';
    this.command = command;
    this.reason = reason;
  }
}

export class LspStaleResponseError extends LspError {
  public readonly expectedRevision: number;
  public readonly actualRevision: number;

  constructor(expectedRevision: number, actualRevision: number) {
    super(`Stale LSP response rejected: document revision advanced from ${expectedRevision} to ${actualRevision}`);
    this.name = 'LspStaleResponseError';
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export class LspDisposedError extends LspError {
  constructor(subsystem: string = 'LSP subsystem') {
    super(`${subsystem} is disposed and cannot perform requested operation.`);
    this.name = 'LspDisposedError';
  }
}
