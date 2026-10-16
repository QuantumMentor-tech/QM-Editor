/**
 * QM Editor LSP Workspace Symbol Provider
 * Phase 06, Step 61 — LSP Workspace Symbols, Cross-File Symbol Search & Symbol Navigation
 *
 * Implements the SymbolProvider interface for cross-file semantic symbol search,
 * delegating to active Language Server Protocol sessions via `workspace/symbol`.
 */

import { Symbol, SymbolProvider, SymbolProviderCapabilities, CancellationToken } from '../../symbols/SymbolTypes';
import { LspServerManager, globalLspServerManager } from '../LspServerManager';
import { SettingsService } from '../../settings/SettingsService';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { logger } from '../../../utils/logger';
import { LspWorkspaceSymbolRequest } from './LspWorkspaceSymbolTypes';
import { LspWorkspaceSymbolValidator } from './LspWorkspaceSymbolValidator';
import { LspWorkspaceSymbolMapper } from './LspWorkspaceSymbolMapper';
import { LspWorkspaceSymbolResponse } from '../LspTypes';

export class LspWorkspaceSymbolProvider implements SymbolProvider {
  public readonly providerId = 'lsp.workspaceSymbols';
  public readonly displayName = 'LSP Workspace Symbols';

  public readonly capabilities: SymbolProviderCapabilities = {
    supportsWorkspaceSymbols: true,
    supportsDocumentSymbols: false,
    supportsHierarchicalSymbols: false,
    priority: 100,
  };

  private requestGeneration = 0;
  private isDisposed = false;

  constructor(
    private readonly serverManager: LspServerManager = globalLspServerManager,
    private readonly settingsService: SettingsService = SettingsService.getInstance(),
    private readonly workspaceEngine: WorkspaceEngine = globalWorkspaceEngine
  ) {}

  // ---------------------------------------------------------------------------
  // Configuration Helpers
  // ---------------------------------------------------------------------------

  public isWorkspaceSymbolsEnabled(): boolean {
    const val = this.settingsService.get('lsp.workspaceSymbols.enabled');
    return val !== false;
  }

  public allowEmptyQueries(): boolean {
    const val = this.settingsService.get('lsp.workspaceSymbols.allowEmptyQueries');
    return val === true;
  }

  public getInteractiveTimeoutMs(): number {
    const val = this.settingsService.get<number>('lsp.interactiveTimeoutMs');
    return typeof val === 'number' && val > 0 ? val : 3000;
  }

  public getMaxSymbols(): number {
    const val = this.settingsService.get<number>('lsp.workspaceSymbols.maxResults');
    return typeof val === 'number' && val > 0 ? val : 1000;
  }

  // ---------------------------------------------------------------------------
  // SymbolProvider Contract
  // ---------------------------------------------------------------------------

  public async provideWorkspaceSymbols(
    query: string,
    token?: CancellationToken
  ): Promise<Symbol[]> {
    if (this.isDisposed || token?.isCancellationRequested) {
      return [];
    }

    const isEnabled = this.isWorkspaceSymbolsEnabled();
    if (!isEnabled) {
      logger.debug('LspWorkspaceSymbolProvider: workspace symbol search disabled in settings');
      return [];
    }

    const sanitizedQuery = LspWorkspaceSymbolValidator.sanitizeQuery(query);
    if (!sanitizedQuery && !this.allowEmptyQueries()) {
      return [];
    }

    const currentWorkspaceId = this.workspaceEngine.getWorkspaceId() || 'default-workspace';
    const reqGen = ++this.requestGeneration;
    const timeoutMs = this.getInteractiveTimeoutMs();
    const maxResults = this.getMaxSymbols();

    // Find all ready sessions belonging to the current workspace with workspaceSymbolProvider capability
    const allSessions = this.serverManager.getAllSessions();
    const activeSessions = allSessions.filter((session) => {
      if (session.workspaceId !== currentWorkspaceId) return false;
      const state = session.getState();
      if (state !== 'ready' && state !== 'running') return false;

      const caps = session.getCapabilities();
      return !!caps?.workspaceSymbolProvider;
    });

    if (activeSessions.length === 0) {
      logger.debug('LspWorkspaceSymbolProvider: no active sessions with workspaceSymbolProvider capability');
      return [];
    }

    const queryPromises = activeSessions.map(async (session) => {
      const requestContext: LspWorkspaceSymbolRequest = {
        query: sanitizedQuery,
        workspaceId: currentWorkspaceId,
        serverSessionId: session.sessionId,
        serverGeneration: session.getSessionGeneration(),
        requestGeneration: reqGen,
      };

      const validation = LspWorkspaceSymbolValidator.validateRequestContext(
        requestContext,
        session,
        isEnabled
      );

      if (!validation.valid) {
        logger.debug('LspWorkspaceSymbolProvider: request context invalid for session', {
          sessionId: session.sessionId,
          error: validation.error,
        });
        return [];
      }

      try {
        const rawResult = await session.getClient().sendRequest<LspWorkspaceSymbolResponse>(
          'workspace/symbol',
          { query: sanitizedQuery },
          {
            category: 'interactive',
            cancellationToken: token,
            timeoutMs,
          }
        );

        if (token?.isCancellationRequested) {
          return [];
        }

        // Stale checks: generation or workspace changed while waiting
        if (this.requestGeneration !== reqGen) {
          logger.debug('LspWorkspaceSymbolProvider: query superseded by newer request generation');
          return [];
        }

        const nowWorkspaceId = this.workspaceEngine.getWorkspaceId() || 'default-workspace';
        if (nowWorkspaceId !== currentWorkspaceId) {
          logger.debug('LspWorkspaceSymbolProvider: workspace switched during query execution');
          return [];
        }

        const sanitizedItems = LspWorkspaceSymbolValidator.validateAndSanitizeSymbolList(
          rawResult,
          maxResults
        );

        return LspWorkspaceSymbolMapper.mapToCanonicalSymbols(
          sanitizedItems,
          session.workspaceId,
          sanitizedQuery,
          this.providerId
        );
      } catch (err) {
        logger.warn('LspWorkspaceSymbolProvider: workspace/symbol request failed', {
          sessionId: session.sessionId,
          error: (err as Error).message,
        });
        return [];
      }
    });

    const settled = await Promise.allSettled(queryPromises);

    // Stale check after all sessions respond
    if (this.requestGeneration !== reqGen || token?.isCancellationRequested) {
      return [];
    }

    const combined: Symbol[] = [];
    const seenKeys = new Set<string>();

    for (const res of settled) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        for (const sym of res.value) {
          const key = LspWorkspaceSymbolMapper.getSymbolDeduplicationKey(sym);
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            combined.push(sym);
          }
        }
      }
    }

    return combined;
  }

  // ---------------------------------------------------------------------------
  // Disposal
  // ---------------------------------------------------------------------------

  public dispose(): void {
    this.isDisposed = true;
  }
}
