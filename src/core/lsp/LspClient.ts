/**
 * QM Editor Canonical LSP Client
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 *
 * Implements the core LSP client protocol engine, capability advertisement & negotiation,
 * initialization handshake, shutdown lifecycle, notification dispatch, and request routing.
 */

import { ILspTransport } from './transport/ILspTransport';
import { LspJsonRpc } from './LspJsonRpc';
import { LspRequestManager, CreateRequestOptions } from './LspRequestManager';
import {
  ClientCapabilities,
  ServerCapabilities,
  InitializeParams,
  InitializeResult,
  JsonRpcMessage,
  NotificationMessage,
  RequestMessage,
  ResponseMessage,
} from './LspTypes';
import { LspDisposedError, LspError } from './LspErrors';
import { logger } from '../../utils/logger';

export interface LspClientOptions {
  transport: ILspTransport;
  trace?: 'off' | 'messages' | 'verbose';
}

export type NotificationHandler = (params: unknown) => void;
export type RequestHandler = (params: unknown) => unknown | Promise<unknown>;

export class LspClient {
  private readonly transport: ILspTransport;
  private readonly jsonRpc = new LspJsonRpc();
  private readonly requestManager = new LspRequestManager();

  private serverCapabilities: ServerCapabilities | null = null;
  private isInitialized: boolean = false;
  private isDisposed: boolean = false;
  private traceLevel: 'off' | 'messages' | 'verbose';

  private notificationHandlers = new Map<string, Set<NotificationHandler>>();
  private serverRequestHandlers = new Map<string, RequestHandler>();
  private unsubscribers: Array<() => void> = [];

  constructor(options: LspClientOptions) {
    this.transport = options.transport;
    this.traceLevel = options.trace ?? 'off';

    this.wireTransport();
  }

  // ---------------------------------------------------------------------------
  // 1. Canonical Client Capabilities (Truthful Advertisement)
  // ---------------------------------------------------------------------------

  public static getSupportedClientCapabilities(): ClientCapabilities {
    return {
      workspace: {
        applyEdit: true,
        workspaceEdit: {
          documentChanges: true,
          resourceOperations: ['create', 'rename', 'delete'],
          failureHandling: 'abort',
        },
        workspaceFolders: true,
        symbol: {
          dynamicRegistration: false,
          symbolKind: {
            valueSet: Array.from({ length: 26 }, (_, i) => i + 1),
          },
          tagSupport: {
            valueSet: [1],
          },
        },
      },
      textDocument: {
        synchronization: {
          dynamicRegistration: false,
          willSave: false,
          willSaveWaitUntil: false,
          didSave: true,
        },
        completion: {
          dynamicRegistration: false,
          completionItem: {
            snippetSupport: false,
            commitCharactersSupport: true,
            documentationFormat: ['plaintext', 'markdown'],
            deprecatedSupport: true,
          },
        },
        hover: {
          dynamicRegistration: false,
          contentFormat: ['plaintext', 'markdown'],
        },
        signatureHelp: {
          dynamicRegistration: false,
          signatureInformation: {
            documentationFormat: ['plaintext', 'markdown'],
          },
        },
        definition: {
          dynamicRegistration: false,
          linkSupport: true,
        },
        declaration: {
          dynamicRegistration: false,
          linkSupport: true,
        },
        typeDefinition: {
          dynamicRegistration: false,
          linkSupport: true,
        },
        references: {
          dynamicRegistration: false,
        },
        documentSymbol: {
          dynamicRegistration: false,
          hierarchicalDocumentSymbolSupport: true,
        },
        codeAction: {
          dynamicRegistration: false,
          codeActionLiteralSupport: {
            codeActionKind: {
              valueSet: ['quickfix', 'refactor', 'source'],
            },
          },
        },
        rename: {
          dynamicRegistration: false,
          prepareSupport: true,
        },
        formatting: {
          dynamicRegistration: false,
        },
        rangeFormatting: {
          dynamicRegistration: false,
        },
        semanticTokens: {
          dynamicRegistration: false,
          requests: {
            range: true,
            full: { delta: true },
          },
          tokenTypes: [
            'namespace',
            'type',
            'class',
            'enum',
            'interface',
            'struct',
            'typeParameter',
            'parameter',
            'variable',
            'property',
            'enumMember',
            'event',
            'function',
            'method',
            'macro',
            'keyword',
            'modifier',
            'comment',
            'string',
            'number',
            'regexp',
            'operator',
            'decorator',
            'label',
          ],
          tokenModifiers: [
            'declaration',
            'definition',
            'readonly',
            'static',
            'deprecated',
            'abstract',
            'async',
            'modification',
            'documentation',
            'defaultLibrary',
          ],
          formats: ['relative'],
          overlappingTokenSupport: false,
          multilineTokenSupport: false,
          augmentsSyntaxTokens: true,
        },
        publishDiagnostics: {
          relatedInformation: true,
          versionSupport: true,
        },
        inlayHint: {
          dynamicRegistration: false,
          resolveSupport: {
            properties: ['tooltip', 'textEdits'],
          },
        },
        codeLens: {
          dynamicRegistration: false,
        },
        documentLink: {
          dynamicRegistration: false,
          tooltipSupport: true,
        },
        foldingRange: {
          dynamicRegistration: false,
          rangeLimit: 5000,
          lineFoldingOnly: false,
          foldingRangeKind: {
            valueSet: ['comment', 'imports', 'region'],
          },
          foldingRange: {
            collapsedText: true,
          },
        },
        selectionRange: {
          dynamicRegistration: false,
        },
        callHierarchy: {
          dynamicRegistration: false,
        },
      },
      window: {
        showMessage: true,
        workDoneProgress: false,
      },
      general: {
        positionEncodings: ['utf-16', 'utf-8'],
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Lifecycle Handshake (Initialize, Initialized, Shutdown, Exit)
  // ---------------------------------------------------------------------------

  /**
   * Performs the foundational LSP initialize request and records server capabilities.
   */
  public async initialize(params: InitializeParams): Promise<InitializeResult> {
    if (this.isDisposed) {
      throw new LspDisposedError('LspClient');
    }

    this.logTrace('sendRequest', 'initialize', params);

    const result = await this.sendRequest<InitializeResult>('initialize', params, {
      category: 'initialization',
      timeoutMs: 10000,
    });

    if (!result || !result.capabilities) {
      throw new LspError('LSP Initialize response did not contain valid server capabilities.');
    }

    this.serverCapabilities = result.capabilities;
    this.isInitialized = true;
    logger.info('LspClient: Server successfully initialized', {
      serverInfo: result.serverInfo,
    });

    return result;
  }

  /**
   * Sends the initialized notification after successful capability negotiation.
   */
  public async initialized(): Promise<void> {
    if (this.isDisposed) return;
    await this.sendNotification('initialized', {});
    logger.info('LspClient: Sent initialized notification');
  }

  /**
   * Performs standard LSP shutdown sequence (shutdown request -> response -> exit notification).
   */
  public async shutdown(): Promise<void> {
    if (this.isDisposed) return;

    logger.info('LspClient: Initiating shutdown');

    try {
      if (this.isInitialized) {
        await this.sendRequest('shutdown', null, {
          category: 'shutdown',
          timeoutMs: 1000,
        });
      }
    } catch (err) {
      logger.warn('LspClient: Error during shutdown request', { error: (err as Error).message });
    } finally {
      try {
        await this.sendNotification('exit', null);
      } catch (err) {
        logger.warn('LspClient: Error sending exit notification', { error: (err as Error).message });
      }
      this.isInitialized = false;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Requests and Notifications
  // ---------------------------------------------------------------------------

  /**
   * Sends a request to the language server and returns a promise for the response.
   */
  public async sendRequest<T>(
    method: string,
    params: unknown,
    options: CreateRequestOptions = {}
  ): Promise<T> {
    if (this.isDisposed) {
      throw new LspDisposedError('LspClient');
    }

    const { requestMessage, promise } = this.requestManager.createRequest<T>(
      method,
      params,
      options,
      (cancelMsg) => this.sendNotification(cancelMsg.method, cancelMsg.params)
    );

    this.logTrace('sendRequest', method, params, requestMessage.id);

    const wirePayload = LspJsonRpc.serialize(requestMessage);
    await this.transport.send(wirePayload);

    return promise;
  }

  /**
   * Sends a fire-and-forget notification message to the language server.
   */
  public async sendNotification(method: string, params: unknown): Promise<void> {
    if (this.isDisposed) return;

    const notification: NotificationMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.logTrace('sendNotification', method, params);

    const wirePayload = LspJsonRpc.serialize(notification);
    await this.transport.send(wirePayload);
  }

  /**
   * Subscribes to incoming server notifications (e.g. textDocument/publishDiagnostics).
   */
  public onNotification(method: string, handler: NotificationHandler): () => void {
    let handlers = this.notificationHandlers.get(method);
    if (!handlers) {
      handlers = new Set();
      this.notificationHandlers.set(method, handlers);
    }
    handlers.add(handler);

    return () => {
      handlers?.delete(handler);
      if (handlers && handlers.size === 0) {
        this.notificationHandlers.delete(method);
      }
    };
  }

  /**
   * Registers a handler for requests initiated by the server (e.g. workspace/configuration).
   */
  public onRequest(method: string, handler: RequestHandler): () => void {
    this.serverRequestHandlers.set(method, handler);
    return () => {
      this.serverRequestHandlers.delete(method);
    };
  }

  public getServerCapabilities(): ServerCapabilities | null {
    return this.serverCapabilities;
  }

  public isReady(): boolean {
    return this.isInitialized && !this.isDisposed && this.transport.isAlive();
  }

  // ---------------------------------------------------------------------------
  // 4. Transport Binding & Dispatching
  // ---------------------------------------------------------------------------

  private wireTransport(): void {
    const unsubMsg = this.transport.onMessage((chunk) => {
      const messages = this.jsonRpc.append(chunk);
      for (const msg of messages) {
        this.dispatchMessage(msg);
      }
    });

    const unsubErr = this.transport.onError((err) => {
      logger.error('LspClient: Transport error', { error: err.message });
    });

    const unsubClose = this.transport.onClose((code) => {
      logger.info('LspClient: Transport closed', { exitCode: code });
      this.requestManager.dispose('Transport closed unexpectedly');
    });

    this.unsubscribers.push(unsubMsg, unsubErr, unsubClose);
  }

  private dispatchMessage(message: JsonRpcMessage): void {
    // 1. Response Message
    if (LspJsonRpc.isResponse(message)) {
      this.logTrace('receiveResponse', `id:${message.id}`, message.result || message.error);
      if (message.id !== null) {
        this.requestManager.handleResponse(message.id, message.result, message.error);
      }
      return;
    }

    // 2. Notification Message
    if (LspJsonRpc.isNotification(message)) {
      this.logTrace('receiveNotification', message.method, message.params);
      const handlers = this.notificationHandlers.get(message.method);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(message.params);
          } catch (err) {
            logger.error(`LspClient: Error in notification handler for "${message.method}"`, {
              error: (err as Error).message,
            });
          }
        }
      }
      return;
    }

    // 3. Request Message from Server
    if ('method' in message && 'id' in message && (message as any).id !== null) {
      const req = message as unknown as RequestMessage;
      this.logTrace('receiveRequest', req.method, req.params, req.id);
      this.handleServerRequest(req);
      return;
    }
  }

  private async handleServerRequest(request: RequestMessage): Promise<void> {
    const handler = this.serverRequestHandlers.get(request.method);
    if (!handler) {
      // Respond with MethodNotFound (-32601)
      const errResponse: ResponseMessage = {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Method "${request.method}" not supported by client.`,
        },
      };
      await this.transport.send(LspJsonRpc.serialize(errResponse));
      return;
    }

    try {
      const result = await handler(request.params);
      const successResponse: ResponseMessage = {
        jsonrpc: '2.0',
        id: request.id,
        result,
      };
      await this.transport.send(LspJsonRpc.serialize(successResponse));
    } catch (err) {
      const errorResponse: ResponseMessage = {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: (err as Error).message,
        },
      };
      await this.transport.send(LspJsonRpc.serialize(errorResponse));
    }
  }

  private logTrace(direction: string, method: string, params: unknown, id?: unknown): void {
    if (this.traceLevel === 'off') return;

    if (this.traceLevel === 'messages') {
      logger.debug(`[LSP ${direction}] ${method}${id !== undefined ? ` (#${id})` : ''}`);
      return;
    }

    if (this.traceLevel === 'verbose') {
      // Redact potentially sensitive content
      const safeParams = this.sanitizeTracePayload(params);
      logger.debug(`[LSP ${direction}] ${method}${id !== undefined ? ` (#${id})` : ''}`, {
        payload: safeParams,
      });
    }
  }

  private sanitizeTracePayload(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object') return payload;

    try {
      const copy = JSON.parse(JSON.stringify(payload));
      // Redact full document text in large change events
      if (copy.textDocument && copy.textDocument.text && copy.textDocument.text.length > 200) {
        copy.textDocument.text = `<truncated ${copy.textDocument.text.length} chars>`;
      }
      if (Array.isArray(copy.contentChanges)) {
        for (const change of copy.contentChanges) {
          if (change.text && change.text.length > 200) {
            change.text = `<truncated ${change.text.length} chars>`;
          }
        }
      }
      return copy;
    } catch {
      return '[Unserializable payload]';
    }
  }

  public setTraceLevel(level: 'off' | 'messages' | 'verbose'): void {
    this.traceLevel = level;
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;

    this.requestManager.dispose('LspClient disposed');
    this.notificationHandlers.clear();
    this.serverRequestHandlers.clear();
    this.isInitialized = false;
  }
}
