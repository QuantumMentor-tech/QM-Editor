/**
 * QM Editor Canonical LSP Request Manager
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 *
 * Tracks in-flight JSON-RPC requests, enforces monotonic request IDs, timeout policies,
 * cancellation semantics ($/cancelRequest), and stale result protection across document revisions.
 */

import {
  RequestId,
  RequestCategory,
  PendingRequest,
  RequestMessage,
  NotificationMessage,
} from './LspTypes';
import {
  LspTimeoutError,
  LspCancelledError,
  LspStaleResponseError,
  LspDisposedError,
} from './LspErrors';
import { CancellationToken } from '../symbols/SymbolTypes';
import { globalDocumentEngine } from '../documents/DocumentEngine';
import { globalWorkspaceEngine } from '../workspace/WorkspaceEngine';
import { logger } from '../../utils/logger';

export interface CreateRequestOptions {
  category?: RequestCategory;
  timeoutMs?: number;
  workspaceId?: string;
  workspaceGeneration?: number;
  documentId?: string;
  documentRevision?: number;
  cancellationToken?: CancellationToken;
}

export class LspRequestManager {
  private nextRequestId: number = 1;
  private readonly pendingRequests = new Map<RequestId, PendingRequest<any>>();
  private isDisposed: boolean = false;

  public static readonly DEFAULT_TIMEOUTS: Record<RequestCategory, number> = {
    interactive: 5000,
    background: 15000,
    initialization: 10000,
    shutdown: 5000,
  };

  /**
   * Creates and registers a new pending request with strict timeout and cancellation tracking.
   */
  public createRequest<T>(
    method: string,
    params: unknown,
    options: CreateRequestOptions = {},
    sendCancelNotification?: (cancelMsg: NotificationMessage) => void
  ): { requestMessage: RequestMessage; promise: Promise<T> } {
    if (this.isDisposed) {
      throw new LspDisposedError('LspRequestManager');
    }

    const id = this.nextRequestId++;
    const category = options.category || 'interactive';
    const timeoutMs = options.timeoutMs ?? LspRequestManager.DEFAULT_TIMEOUTS[category];

    const requestMessage: RequestMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const promise = new Promise<T>((resolve, reject) => {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

      if (timeoutMs > 0 && timeoutMs !== Infinity) {
        timeoutHandle = setTimeout(() => {
          if (this.pendingRequests.has(id)) {
            this.pendingRequests.delete(id);
            logger.warn('LspRequestManager: Request timed out', { id, method, timeoutMs });
            reject(new LspTimeoutError(method, timeoutMs));
          }
        }, timeoutMs);
      }

      const pending: PendingRequest<T> = {
        id,
        method,
        category,
        createdAt: Date.now(),
        timeoutMs,
        workspaceId: options.workspaceId,
        workspaceGeneration: options.workspaceGeneration,
        documentId: options.documentId,
        documentRevision: options.documentRevision,
        resolve: (result: T) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          resolve(result);
        },
        reject: (err: Error) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          reject(err);
        },
        timeoutHandle,
        isCancelled: false,
      };

      this.pendingRequests.set(id, pending);

      // Wire cancellation token if supplied
      if (options.cancellationToken) {
        if (options.cancellationToken.isCancellationRequested) {
          this.cancelRequest(id, sendCancelNotification);
        } else {
          options.cancellationToken.onCancellationRequested(() => {
            this.cancelRequest(id, sendCancelNotification);
          });
        }
      }
    });

    // Prevent unhandled rejections if request is cancelled/disposed before caller awaits
    promise.catch(() => {});

    return { requestMessage, promise };
  }

  /**
   * Handles an incoming response message from the server, verifying revision freshness.
   */
  public handleResponse(
    id: RequestId,
    result: unknown,
    error?: { code: number; message: string; data?: unknown }
  ): void {
    const pending = this.pendingRequests.get(id);
    if (!pending) {
      logger.warn('LspRequestManager: Received response for unknown or already completed request ID', {
        id,
      });
      return;
    }

    this.pendingRequests.delete(id);

    if (pending.isCancelled) {
      return;
    }

    if (error) {
      pending.reject(
        new Error(`LSP Error [${error.code}]: ${error.message}`)
      );
      return;
    }

    // Stale result verification for document-scoped requests
    if (pending.documentId && pending.documentRevision !== undefined) {
      const currentDoc = globalDocumentEngine.getDocument(pending.documentId);
      if (currentDoc && currentDoc.contentRevision > pending.documentRevision) {
        logger.warn('LspRequestManager: Discarding stale LSP response; document revision advanced', {
          id,
          method: pending.method,
          requestRevision: pending.documentRevision,
          currentRevision: currentDoc.contentRevision,
        });
        pending.reject(
          new LspStaleResponseError(pending.documentRevision, currentDoc.contentRevision)
        );
        return;
      }
    }

    // Stale result verification for workspace-scoped requests
    if (pending.workspaceId && pending.workspaceGeneration !== undefined) {
      const currentWorkspaceId = globalWorkspaceEngine.getWorkspaceId();
      const currentGeneration = globalWorkspaceEngine.getGeneration();
      if (
        (currentWorkspaceId && currentWorkspaceId !== pending.workspaceId) ||
        currentGeneration > pending.workspaceGeneration
      ) {
        logger.warn('LspRequestManager: Discarding stale LSP response; workspace generation changed', {
          id,
          method: pending.method,
        });
        pending.reject(new Error('Stale LSP response: Workspace changed while request was in-flight'));
        return;
      }
    }

    pending.resolve(result);
  }

  /**
   * Explicitly cancels an in-flight request, sending $/cancelRequest if supported.
   */
  public cancelRequest(
    id: RequestId,
    sendCancelNotification?: (cancelMsg: NotificationMessage) => void
  ): void {
    const pending = this.pendingRequests.get(id);
    if (!pending || pending.isCancelled) return;

    pending.isCancelled = true;
    this.pendingRequests.delete(id);

    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle);
    }

    if (sendCancelNotification) {
      try {
        sendCancelNotification({
          jsonrpc: '2.0',
          method: '$/cancelRequest',
          params: { id },
        });
      } catch (err) {
        logger.warn('LspRequestManager: Error sending $/cancelRequest notification', {
          id,
          error: (err as Error).message,
        });
      }
    }

    pending.reject(new LspCancelledError(pending.method));
  }

  /**
   * Returns the count of currently pending requests.
   */
  public getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Rejects all pending requests and releases resources.
   */
  public dispose(reason: string = 'LSP Request Manager disposed'): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    for (const [id, pending] of Array.from(this.pendingRequests.entries())) {
      if (pending.timeoutHandle) {
        clearTimeout(pending.timeoutHandle);
      }
      pending.reject(new Error(`${reason} (method: ${pending.method}, id: ${id})`));
    }

    this.pendingRequests.clear();
  }
}
