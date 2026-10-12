/**
 * QM Editor Workspace Errors
 * Phase 04, Step 30 — Core Workspace Subsystem
 */

export class WorkspaceError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code: string = 'WORKSPACE_ERROR', details?: unknown) {
    super(message);
    this.name = 'WorkspaceError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidWorkspaceRootError extends WorkspaceError {
  constructor(path: string, reason: string = 'Path is invalid or inaccessible') {
    super(`Invalid workspace root "${path}": ${reason}`, 'INVALID_WORKSPACE_ROOT', { path, reason });
    this.name = 'InvalidWorkspaceRootError';
  }
}

export class PathTraversalError extends WorkspaceError {
  constructor(attemptedPath: string, rootUri: string) {
    super(
      `Access denied: path "${attemptedPath}" escapes authorized workspace boundary "${rootUri}".`,
      'PATH_TRAVERSAL_DETECTED',
      { attemptedPath, rootUri }
    );
    this.name = 'PathTraversalError';
  }
}

export class WorkspaceTransitionLockedError extends WorkspaceError {
  constructor(currentState: string, attemptedAction: string) {
    super(
      `Cannot perform "${attemptedAction}": workspace transition already in progress (current state: "${currentState}").`,
      'TRANSITION_LOCKED',
      { currentState, attemptedAction }
    );
    this.name = 'WorkspaceTransitionLockedError';
  }
}

export class WorkspaceNotOpenError extends WorkspaceError {
  constructor(action: string = 'Requested operation') {
    super(`${action} requires an active open workspace.`, 'WORKSPACE_NOT_OPEN', { action });
    this.name = 'WorkspaceNotOpenError';
  }
}

export class WorkspaceSwitchCancelledError extends WorkspaceError {
  constructor(reason: string = 'Switch cancelled by user or unsaved document policy') {
    super(`Workspace switch cancelled: ${reason}`, 'SWITCH_CANCELLED', { reason });
    this.name = 'WorkspaceSwitchCancelledError';
  }
}

export class WorkspaceUnsavedChangesError extends WorkspaceError {
  constructor(count?: number) {
    super(
      `Workspace transition blocked: ${count !== undefined ? count : 'One or more'} documents have unsaved changes.`,
      'UNSAVED_CHANGES_BLOCKED',
      { count }
    );
    this.name = 'WorkspaceUnsavedChangesError';
  }
}
