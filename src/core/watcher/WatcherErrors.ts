/**
 * QM Editor Filesystem Watcher Errors
 * Phase 04, Step 32 — Core Engine Subsystem
 */

export class WatcherError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code: string = 'WATCHER_ERROR', details?: unknown) {
    super(message);
    this.name = 'WatcherError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class WatcherDisposedError extends WatcherError {
  constructor(action: string = 'Requested watcher operation') {
    super(`${action} failed: watcher service has been disposed.`, 'WATCHER_DISPOSED', { action });
    this.name = 'WatcherDisposedError';
  }
}

export class SubscriptionNotFoundError extends WatcherError {
  constructor(subscriptionId: string) {
    super(`Watcher subscription "${subscriptionId}" not found.`, 'SUBSCRIPTION_NOT_FOUND', { subscriptionId });
    this.name = 'SubscriptionNotFoundError';
  }
}

export class ExternalChangeConflictError extends WatcherError {
  constructor(documentId: string, uri: string) {
    super(
      `External modification detected for "${uri}" while document "${documentId}" has unsaved local changes.`,
      'EXTERNAL_CHANGE_CONFLICT',
      { documentId, uri }
    );
    this.name = 'ExternalChangeConflictError';
  }
}

export class DuplicateWatcherError extends WatcherError {
  constructor(rootUri: string) {
    super(`A watcher is already registered for root: "${rootUri}".`, 'DUPLICATE_WATCHER', {
      rootUri,
    });
    this.name = 'DuplicateWatcherError';
  }
}

export class WorkspaceBoundaryViolationError extends WatcherError {
  constructor(path: string, workspaceRoot: string) {
    super(
      `Watcher path "${path}" violates workspace boundary "${workspaceRoot}".`,
      'WORKSPACE_BOUNDARY_VIOLATION',
      { path, workspaceRoot }
    );
    this.name = 'WorkspaceBoundaryViolationError';
  }
}

export class StaleWatcherEventError extends WatcherError {
  constructor(uri: string, eventGen: number, currentGen: number) {
    super(
      `Watcher event for "${uri}" discarded: event generation ${eventGen} does not match current workspace generation ${currentGen}.`,
      'STALE_WATCHER_EVENT',
      { uri, eventGen, currentGen }
    );
    this.name = 'StaleWatcherEventError';
  }
}

export class WatcherInitializationError extends WatcherError {
  constructor(reason: string, details?: unknown) {
    super(`Failed to initialize filesystem watcher: ${reason}`, 'WATCHER_INITIALIZATION_ERROR', details);
    this.name = 'WatcherInitializationError';
  }
}

