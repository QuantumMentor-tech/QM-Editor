/**
 * QM Editor Canonical LSP Server Manager
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 *
 * Central coordinator managing multi-server lifecycles, session sharing within compatible
 * workspaces, duplicate prevention, lazy activation, and workspace disposal cleanup.
 */

import { LspServerSession } from './LspServerSession';
import { LspServerRegistry, globalLspServerRegistry } from './LspServerRegistry';
import { ILspTransport } from './transport/ILspTransport';
import { StdioProcessTransport } from './transport/StdioProcessTransport';
import { MockLspTransport } from './transport/MockLspTransport';
import { ServerSessionStatus, LspServerDefinition } from './LspTypes';
import { globalWorkspaceEngine } from '../workspace/WorkspaceEngine';
import { LspUriMapper } from './LspUriMapper';
import { logger } from '../../utils/logger';

export type TransportFactory = (
  definition: LspServerDefinition,
  workspaceId: string,
  rootPath?: string
) => ILspTransport;

export class LspServerManager {
  private static instance: LspServerManager | null = null;
  private readonly sessions = new Map<string, LspServerSession>();
  private readonly registry: LspServerRegistry;
  private transportFactory: TransportFactory;
  private isDisposed: boolean = false;
  private workspaceUnsubscribe?: () => void;

  private constructor(
    registry: LspServerRegistry = globalLspServerRegistry,
    transportFactory?: TransportFactory
  ) {
    this.registry = registry;
    this.transportFactory =
      transportFactory ||
      ((def, _wsId, rootPath) => {
        if (def.transportType === 'mock') {
          return new MockLspTransport();
        }
        return new StdioProcessTransport({
          command: def.command,
          args: def.args ? [...def.args] : [],
          cwd: rootPath,
        });
      });

    this.bindWorkspaceEvents();
  }

  public static getInstance(): LspServerManager {
    if (!LspServerManager.instance) {
      LspServerManager.instance = new LspServerManager();
    }
    return LspServerManager.instance;
  }

  /**
   * Sets a custom transport factory (useful for testing or alternative transport bindings).
   */
  public setTransportFactory(factory: TransportFactory): void {
    this.transportFactory = factory;
  }

  /**
   * Resolves or lazily creates an active LSP server session for a document or language in a workspace.
   */
  public async getOrCreateSession(
    languageId: string,
    fileExtension?: string,
    workspaceId?: string,
    rootPath?: string
  ): Promise<LspServerSession | null> {
    if (this.isDisposed) {
      return null;
    }

    const serverDef = this.registry.findServerForLanguage(languageId, fileExtension);
    if (!serverDef) {
      return null;
    }

    const effectiveWorkspaceId = workspaceId || globalWorkspaceEngine.getWorkspaceId() || 'default-workspace';
    const primaryRoot = globalWorkspaceEngine.getPrimaryRoot();
    const effectiveRootPath = rootPath || primaryRoot?.uri;
    const effectiveRootUri = effectiveRootPath
      ? LspUriMapper.pathToUri(effectiveRootPath)
      : 'file:///';

    const sessionKey = `${serverDef.serverDefinitionId}::${effectiveWorkspaceId}`;

    // 1. Existing Session Check
    let session = this.sessions.get(sessionKey);
    if (session) {
      if (session.getState() === 'running' || session.getState() === 'ready') {
        return session;
      }
      if (session.getState() === 'crashed') {
        // Return crashed session for inspection, but do not automatically restart if in loop
        return session;
      }
    }

    // 2. Create and Start New Session
    logger.info(`LspServerManager: Creating new server session for "${serverDef.displayName}"`, {
      sessionKey,
      workspaceId: effectiveWorkspaceId,
    });

    const transport = this.transportFactory(serverDef, effectiveWorkspaceId, effectiveRootPath);

    session = new LspServerSession({
      serverDefinition: serverDef,
      workspaceId: effectiveWorkspaceId,
      rootUri: effectiveRootUri,
      transport,
      trace: 'off',
    });

    this.sessions.set(sessionKey, session);

    try {
      await session.start();
      return session;
    } catch (err) {
      logger.error(`LspServerManager: Failed to start session "${sessionKey}"`, {
        error: (err as Error).message,
      });
      return session; // Returns session in crashed/starting state for diagnostic inspection
    }
  }

  /**
   * Returns an active session if already running for the specified language and workspace.
   */
  public getActiveSession(
    languageId: string,
    workspaceId?: string
  ): LspServerSession | undefined {
    const serverDef = this.registry.findServerForLanguage(languageId);
    if (!serverDef) return undefined;

    const effectiveWorkspaceId = workspaceId || globalWorkspaceEngine.getWorkspaceId() || 'default-workspace';
    const sessionKey = `${serverDef.serverDefinitionId}::${effectiveWorkspaceId}`;

    const session = this.sessions.get(sessionKey);
    if (session && (session.getState() === 'running' || session.getState() === 'ready')) {
      return session;
    }
    return undefined;
  }

  /**
   * Returns all active server sessions.
   */
  public getAllSessions(): LspServerSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Returns a status overview for all sessions.
   */
  public getStatusOverview(): ServerSessionStatus[] {
    return Array.from(this.sessions.values()).map((s) => s.getStatus());
  }

  /**
   * Restarts a session by session ID.
   */
  public async restartSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.restart();
    }
  }

  /**
   * Stops and disposes all sessions belonging to a specific workspace.
   */
  public async closeWorkspaceSessions(workspaceId: string): Promise<void> {
    logger.info(`LspServerManager: Closing sessions for workspace "${workspaceId}"`);
    const promises: Promise<void>[] = [];

    for (const [key, session] of Array.from(this.sessions.entries())) {
      if (session.workspaceId === workspaceId) {
        this.sessions.delete(key);
        promises.push(session.dispose());
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Complete manager shutdown and disposal.
   */
  public async dispose(): Promise<void> {
    if (this.isDisposed) return;
    this.isDisposed = true;

    this.workspaceUnsubscribe?.();

    const promises: Promise<void>[] = [];
    for (const session of this.sessions.values()) {
      promises.push(session.dispose());
    }
    this.sessions.clear();

    await Promise.allSettled(promises);
    logger.info('LspServerManager: Disposed all language server sessions');
  }

  // ---------------------------------------------------------------------------
  // Workspace Lifecycle Binding
  // ---------------------------------------------------------------------------

  private bindWorkspaceEvents(): void {
    this.workspaceUnsubscribe = globalWorkspaceEngine.on('workspace.closed', async (event) => {
      if (event.previousWorkspaceId) {
        await this.closeWorkspaceSessions(event.previousWorkspaceId);
      }
    });
  }
}

export const globalLspServerManager = LspServerManager.getInstance();
