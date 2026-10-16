/**
 * QM Editor Canonical LSP Server Session
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 *
 * Encapsulates the complete lifecycle state machine, process/transport attachment,
 * initialization handshake, crash loop protection, document tracking, and health metrics.
 */

import {
  ServerSessionState,
  ServerHealth,
  ServerSessionStatus,
  ServerCapabilities,
  LspServerDefinition,
  InitializeParams,
} from './LspTypes';
import { LspClient } from './LspClient';
import { ILspTransport } from './transport/ILspTransport';
import { LspLifecycleError } from './LspErrors';
import { LspUriMapper } from './LspUriMapper';
import { globalLspDiagnosticsBridge } from './LspDiagnosticsBridge';
import { logger } from '../../utils/logger';

export interface LspServerSessionOptions {
  serverDefinition: LspServerDefinition;
  workspaceId: string;
  rootPath?: string;
  rootUri?: string;
  transport: ILspTransport;
  maxCrashCount?: number;
  crashWindowMs?: number;
  trace?: 'off' | 'messages' | 'verbose';
}

export class LspServerSession {
  public readonly sessionId: string;
  public readonly serverDefinition: LspServerDefinition;
  public readonly workspaceId: string;
  public readonly rootUri: string;

  private state: ServerSessionState = 'created';
  private health: ServerHealth = 'unavailable';
  private client: LspClient;
  private transport: ILspTransport;

  private readonly trackedDocumentUris = new Set<string>();
  private crashCount: number = 0;
  private lastCrashTimestamp?: number;
  private lastError?: string;

  private readonly maxCrashCount: number;
  private readonly crashWindowMs: number;
  private readonly traceLevel: 'off' | 'messages' | 'verbose';
  private sessionGeneration: number = 0;
  private transportCloseUnsubscriber?: () => void;
  private isDisposed: boolean = false;

  constructor(options: LspServerSessionOptions) {
    this.serverDefinition = options.serverDefinition;
    this.workspaceId = options.workspaceId;
    this.rootUri = options.rootUri || (options.rootPath ? LspUriMapper.pathToUri(options.rootPath) : 'file:///');
    this.sessionId = `${this.serverDefinition.serverDefinitionId}::${this.workspaceId}`;

    this.transport = options.transport;
    this.traceLevel = options.trace ?? 'off';
    this.client = new LspClient({
      transport: this.transport,
      trace: this.traceLevel,
    });

    this.maxCrashCount = options.maxCrashCount ?? 3;
    this.crashWindowMs = options.crashWindowMs ?? 60000;

    this.wireTransportEvents();
    this.wireClient();
  }

  private wireClient(): void {
    const generationAtWire = this.sessionGeneration;
    this.client.onNotification('textDocument/publishDiagnostics', (params: any) => {
      globalLspDiagnosticsBridge.handlePublishDiagnostics(params, {
        sessionId: this.sessionId,
        serverDefinitionId: this.serverDefinition.serverDefinitionId,
        displayName: this.serverDefinition.displayName,
        workspaceId: this.workspaceId,
        generation: generationAtWire,
        sessionState: this.state,
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 1. State Machine Transitions
  // ---------------------------------------------------------------------------

  public getState(): ServerSessionState {
    return this.state;
  }

  public getHealth(): ServerHealth {
    return this.health;
  }

  public getClient(): LspClient {
    return this.client;
  }

  public getCapabilities(): ServerCapabilities | null {
    return this.client.getServerCapabilities();
  }

  public getSessionGeneration(): number {
    return this.sessionGeneration;
  }

  private transitionTo(newState: ServerSessionState, newHealth: ServerHealth): void {
    const valid = this.isValidTransition(this.state, newState);
    if (!valid) {
      throw new LspLifecycleError(this.state, newState);
    }

    const oldState = this.state;
    this.state = newState;
    this.health = newHealth;

    logger.info(`LspServerSession [${this.sessionId}]: State transitioned`, {
      from: oldState,
      to: newState,
      health: newHealth,
    });
  }

  private isValidTransition(from: ServerSessionState, to: ServerSessionState): boolean {
    const transitions: Record<ServerSessionState, ServerSessionState[]> = {
      created: ['starting', 'disposed'],
      starting: ['initializing', 'crashed', 'stopped', 'disposed'],
      initializing: ['ready', 'crashed', 'stopping', 'stopped', 'disposed'],
      ready: ['running', 'stopping', 'crashed', 'stopped', 'disposed'],
      running: ['stopping', 'crashed', 'stopped', 'disposed'],
      stopping: ['stopped', 'crashed', 'disposed'],
      stopped: ['starting', 'disposed'],
      crashed: ['starting', 'disposed'],
      disposed: [], // Terminal
    };

    return transitions[from]?.includes(to) ?? false;
  }

  // ---------------------------------------------------------------------------
  // 2. Startup & Handshake
  // ---------------------------------------------------------------------------

  public async start(): Promise<void> {
    if (this.state === 'ready' || this.state === 'running') {
      return;
    }

    if (this.crashCount >= this.maxCrashCount) {
      const now = Date.now();
      if (this.lastCrashTimestamp && now - this.lastCrashTimestamp < this.crashWindowMs) {
        this.health = 'crashed';
        throw new Error(
          `LSP Server [${this.serverDefinition.displayName}] reached crash loop limit (${this.crashCount} crashes). Auto-restart suppressed.`
        );
      } else {
        // Reset crash counter after window expires
        this.crashCount = 0;
      }
    }

    this.sessionGeneration++;
    globalLspDiagnosticsBridge.registerSession(this.sessionId, this.sessionGeneration);

    this.client = new LspClient({
      transport: this.transport,
      trace: this.traceLevel,
    });
    this.wireClient();

    this.transitionTo('starting', 'starting');

    try {
      await this.transport.start();
      this.transitionTo('initializing', 'initializing');

      const initParams: InitializeParams = {
        processId: null,
        clientInfo: {
          name: 'QM Editor',
          version: '0.1.0',
        },
        rootUri: this.rootUri,
        capabilities: LspClient.getSupportedClientCapabilities(),
        initializationOptions: this.serverDefinition.initializationOptions,
        workspaceFolders: [
          {
            uri: this.rootUri,
            name: this.workspaceId,
          },
        ],
        trace: 'off',
      };

      await this.client.initialize(initParams);
      await this.client.initialized();

      this.transitionTo('ready', 'ready');
      this.state = 'running';
    } catch (err) {
      this.lastError = (err as Error).message;
      this.handleProcessCrash(1);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Document Tracking
  // ---------------------------------------------------------------------------

  public trackDocument(uri: string): void {
    this.trackedDocumentUris.add(uri);
  }

  public untrackDocument(uri: string): void {
    this.trackedDocumentUris.delete(uri);
  }

  public isDocumentTracked(uri: string): boolean {
    return this.trackedDocumentUris.has(uri);
  }

  public getTrackedDocumentCount(): number {
    return this.trackedDocumentUris.size;
  }

  // ---------------------------------------------------------------------------
  // 4. Shutdown, Exit & Disposal
  // ---------------------------------------------------------------------------

  public async stop(): Promise<void> {
    if (this.state === 'stopped' || this.state === 'disposed') {
      return;
    }

    try {
      this.transitionTo('stopping', 'stopping');
      await this.client.shutdown();
    } catch (err) {
      logger.warn(`LspServerSession [${this.sessionId}]: Error during client shutdown`, {
        error: (err as Error).message,
      });
    } finally {
      try {
        await this.transport.close();
      } catch (err) {
        logger.warn(`LspServerSession [${this.sessionId}]: Error closing transport`, {
          error: (err as Error).message,
        });
      }
      this.transitionTo('stopped', 'stopped');
      this.trackedDocumentUris.clear();
      globalLspDiagnosticsBridge.clearForServer(this.serverDefinition.serverDefinitionId);
    }
  }

  public async restart(): Promise<void> {
    logger.info(`LspServerSession [${this.sessionId}]: Manual restart requested`);
    await this.stop();
    this.crashCount = 0; // Manual restart resets crash count
    await this.start();
  }

  public async dispose(): Promise<void> {
    if (this.isDisposed) return;
    this.isDisposed = true;

    try {
      if (this.state !== 'stopped' && this.state !== 'crashed') {
        await this.stop();
      }
    } catch {
      // Ignore errors on disposal
    }

    this.transportCloseUnsubscriber?.();
    this.client.dispose();
    this.trackedDocumentUris.clear();
    globalLspDiagnosticsBridge.clearForServer(this.serverDefinition.serverDefinitionId);
    this.state = 'disposed';
    this.health = 'unavailable';
  }

  // ---------------------------------------------------------------------------
  // 5. Crash Loop & Process Event Handling
  // ---------------------------------------------------------------------------

  private wireTransportEvents(): void {
    this.transportCloseUnsubscriber = this.transport.onClose((exitCode) => {
      if (this.state === 'running' || this.state === 'initializing' || this.state === 'ready') {
        logger.error(`LspServerSession [${this.sessionId}]: Unexpected process exit with code ${exitCode}`);
        this.handleProcessCrash(exitCode ?? 1);
      }
    });
  }

  private handleProcessCrash(exitCode: number): void {
    this.crashCount++;
    this.lastCrashTimestamp = Date.now();
    this.lastError = `Server process crashed with exit code ${exitCode}`;

    if (this.state !== 'crashed' && this.state !== 'disposed') {
      try {
        this.transitionTo('crashed', 'crashed');
      } catch {
        this.state = 'crashed';
        this.health = 'crashed';
      }
    }

    this.trackedDocumentUris.clear();
    globalLspDiagnosticsBridge.clearForServer(this.serverDefinition.serverDefinitionId);
  }

  public getStatus(): ServerSessionStatus {
    return {
      sessionId: this.sessionId,
      serverDefinitionId: this.serverDefinition.serverDefinitionId,
      displayName: this.serverDefinition.displayName,
      languageId: this.serverDefinition.languageIds[0] || 'unknown',
      workspaceId: this.workspaceId,
      rootUri: this.rootUri,
      state: this.state,
      health: this.health,
      capabilities: this.getCapabilities(),
      trackedDocumentCount: this.trackedDocumentUris.size,
      crashCount: this.crashCount,
      lastCrashTimestamp: this.lastCrashTimestamp,
      lastError: this.lastError,
    };
  }
}
