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
