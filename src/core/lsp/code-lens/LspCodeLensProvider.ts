/**
 * QM Editor - LSP Code Lens Provider
 * Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration
 * 
 * Dispatches `textDocument/codeLens` requests to language servers, validates capabilities,
 * enforces stale revision protection, manages resolution, and caches computed lens lines.
 */

import { LspServerManager, globalLspServerManager } from '../LspServerManager';
import { SettingsService } from '../../settings/SettingsService';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { LspUriMapper } from '../LspUriMapper';
import { Logger } from '../../../utils/logger';
import { CancellationToken } from '../../symbols/SymbolTypes';
import { globalCommandRegistry, CommandRegistry } from '../../commands/CommandRegistry';
import {
  CanonicalCodeLens,
  CodeLensCacheEntry,
  CodeLensRequestOptions,
  EditorCodeLensLine,
  LspCodeLensResponse,
} from './LspCodeLensTypes';
import { LspCodeLensMapper } from './LspCodeLensMapper';
import { LspCodeLensResolver } from './LspCodeLensResolver';

export interface CodeLensResult {
  readonly lenses: CanonicalCodeLens[];
  readonly lines: EditorCodeLensLine[];
  readonly documentRevision: number;
}

export class LspCodeLensProvider {
  private static instance: LspCodeLensProvider | null = null;
  private readonly cache = new Map<string, CodeLensCacheEntry>();
  private readonly resolver: LspCodeLensResolver;
  private isDisposed = false;

  constructor(
    private readonly serverManager: LspServerManager = globalLspServerManager,
    private readonly settingsService: SettingsService = SettingsService.getInstance(),
    private readonly workspaceEngine: WorkspaceEngine = globalWorkspaceEngine,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine,
    private readonly commandRegistry: CommandRegistry = globalCommandRegistry
  ) {
    this.resolver = new LspCodeLensResolver(this.serverManager, this.commandRegistry);
  }

  public static getInstance(): LspCodeLensProvider {
    if (!LspCodeLensProvider.instance) {
      LspCodeLensProvider.instance = new LspCodeLensProvider();
    }
    return LspCodeLensProvider.instance;
  }

  public isEnabled(): boolean {
    const val = this.settingsService.get('lsp.codeLens.enabled');
    return val !== false;
  }

  public getCache(uri: string): CodeLensCacheEntry | undefined {
    return this.cache.get(uri);
  }

  public clearCache(uri?: string): void {
    if (uri) {
      this.cache.delete(uri);
    } else {
      this.cache.clear();
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    this.cache.clear();
  }

  /**
   * Resolves command metadata for a canonical code lens.
   */
  public async resolveLens(
    lens: CanonicalCodeLens,
    token?: CancellationToken
  ): Promise<CanonicalCodeLens> {
    return this.resolver.resolveCodeLens(lens, token);
  }

  /**
   * Resolves command metadata for a canonical code lens (convenience alias).
   */
  public async resolveCodeLens(
    uriOrLens: string | CanonicalCodeLens,
    lensOrToken?: CanonicalCodeLens | CancellationToken,
    token?: CancellationToken
  ): Promise<CanonicalCodeLens> {
    const targetLens = typeof uriOrLens === 'object' ? uriOrLens : (lensOrToken as CanonicalCodeLens);
    const targetToken = typeof uriOrLens === 'object' ? (lensOrToken as CancellationToken) : token;
    return this.resolveLens(targetLens, targetToken);
  }

  /**
   * Requests Code Lenses for a given document resource URI.
   */
  public async requestCodeLenses(
    uri: string,
    _options: CodeLensRequestOptions = {},
    token?: CancellationToken
  ): Promise<CodeLensResult | null> {
    if (this.isDisposed || !this.isEnabled() || token?.isCancellationRequested) {
      return null;
    }

    const docRecord = this.documentEngine.getByResource(uri);
    if (!docRecord) {
      Logger.debug('LspCodeLensProvider: Document not found in DocumentEngine', { uri });
      return null;
    }

    const requestRevision = docRecord.contentRevision;
    const documentText = docRecord.content ?? '';

    const targetWorkspaceId = docRecord.workspaceId || this.workspaceEngine?.getWorkspaceId?.();
    const allSessions = this.serverManager.getAllSessions();
    const session = allSessions.find((s) => {
      if (targetWorkspaceId && s.workspaceId !== targetWorkspaceId) return false;
      const state = s.getState();
      if (state !== 'ready' && state !== 'running') return false;
      const caps = s.getCapabilities();
      return Boolean(caps?.codeLensProvider);
    });

    if (!session) {
      Logger.debug('LspCodeLensProvider: No active session with codeLensProvider capability');
      return null;
    }

    const lspUri = LspUriMapper.pathToUri(uri);

    try {
      const response = await session.getClient().sendRequest<LspCodeLensResponse>(
        'textDocument/codeLens',
        {
          textDocument: { uri: lspUri },
        },
        {
          category: 'interactive',
          cancellationToken: token,
          timeoutMs: 5000,
        }
      );

      if (token?.isCancellationRequested) {
        return null;
      }

      // Stale revision check: ensure document content hasn't changed during in-flight request
      const currentDoc = this.documentEngine.getByResource(uri);
      if (!currentDoc || currentDoc.contentRevision !== requestRevision) {
        Logger.debug('LspCodeLensProvider: Discarded response due to newer document revision', {
          uri,
          requestRevision,
          currentRevision: currentDoc?.contentRevision,
        });
        return null;
      }

      // Map raw response to canonical models and line groupings
      const { lenses, lines } = LspCodeLensMapper.mapToLines(
        uri,
        requestRevision,
        session.serverDefinition.serverDefinitionId,
        session.sessionId,
        response,
        documentText,
        this.commandRegistry
      );

      // Update cache
      this.cache.set(uri, {
        uri,
        documentRevision: requestRevision,
        sessionId: session.sessionId,
        lenses,
        lines,
        timestamp: Date.now(),
      });

      return {
        lenses,
        lines,
        documentRevision: requestRevision,
      };
    } catch (err: unknown) {
      const isCancelled =
        token?.isCancellationRequested ||
        (err instanceof Error &&
          (err.name === 'LspCancelledError' ||
            err.message.includes('cancelled') ||
            err.message.includes('canceled')));

      if (isCancelled) {
        Logger.debug('LspCodeLensProvider: Code Lens request cancelled', { uri });
        return null;
      }

      Logger.warn('LspCodeLensProvider: textDocument/codeLens request failed', err);
      return null;
    }
  }
}

export const globalCodeLensProvider = LspCodeLensProvider.getInstance();
