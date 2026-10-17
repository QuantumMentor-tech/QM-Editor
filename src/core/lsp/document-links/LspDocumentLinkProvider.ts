/**
 * QM Editor - LSP Document Link Provider
 * Phase 06, Step 67 — LSP Document Links, Clickable Resource References & Safe URI Navigation
 * 
 * Communicates with active language server sessions to request document links,
 * performs capability negotiation, manages caching, and enforces double revision stale guards.
 */

import { Logger } from '../../../utils/logger';
import { LspServerManager, globalLspServerManager } from '../LspServerManager';
import { SettingsService } from '../../settings/SettingsService';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { LspUriMapper } from '../LspUriMapper';
import { CancellationToken } from '../../symbols/SymbolTypes';
import {
  CanonicalDocumentLink,
  DocumentLinkCacheEntry,
  DocumentLinkRequestOptions,
  DocumentLinkResult,
  LspDocumentLinkResponse,
} from './LspDocumentLinkTypes';
import { LspDocumentLinkMapper } from './LspDocumentLinkMapper';
import { LspDocumentLinkResolver } from './LspDocumentLinkResolver';

export class LspDocumentLinkProvider {
  private static instance: LspDocumentLinkProvider | null = null;
  private readonly cache = new Map<string, DocumentLinkCacheEntry>();
  private readonly resolver: LspDocumentLinkResolver;
  private isDisposed = false;

  constructor(
    private readonly serverManager: LspServerManager = globalLspServerManager,
    private readonly settingsService: SettingsService = SettingsService.getInstance(),
    private readonly workspaceEngine: WorkspaceEngine = globalWorkspaceEngine,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine
  ) {
    this.resolver = new LspDocumentLinkResolver(this.serverManager);
  }

  public static getInstance(): LspDocumentLinkProvider {
    if (!LspDocumentLinkProvider.instance) {
      LspDocumentLinkProvider.instance = new LspDocumentLinkProvider();
    }
    return LspDocumentLinkProvider.instance;
  }

  public isEnabled(): boolean {
    const lspVal = this.settingsService.get('lsp.documentLinks.enabled');
    const editorVal = this.settingsService.get('editor.documentLinks.enabled');
    return lspVal !== false && editorVal !== false;
  }

  public getCache(uri: string): DocumentLinkCacheEntry | undefined {
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
   * Resolves target URI for an unresolved document link.
   */
  public async resolveDocumentLink(
    link: CanonicalDocumentLink,
    token?: CancellationToken
  ): Promise<CanonicalDocumentLink> {
    const roots = this.workspaceEngine?.getRoots ? this.workspaceEngine.getRoots() : [];
    const rootUris = roots.map((r: any) => r.uri || r.path || String(r));
    return this.resolver.resolveDocumentLink(link, rootUris, token);
  }

  /**
   * Requests Document Links for a given document resource URI.
   */
  public async requestDocumentLinks(
    uri: string,
    _options: DocumentLinkRequestOptions = {},
    token?: CancellationToken
  ): Promise<DocumentLinkResult | null> {
    if (this.isDisposed || !this.isEnabled() || token?.isCancellationRequested) {
      return null;
    }

    const docRecord = this.documentEngine.getByResource(uri);
    if (!docRecord) {
      Logger.debug('LspDocumentLinkProvider: Document not found in engine', { uri });
      return null;
    }

    const documentText = docRecord.content;
    const requestRevision = docRecord.contentRevision;
    const targetWorkspaceId = docRecord.workspaceId || this.workspaceEngine?.getWorkspaceId?.();

    // Check capability among active sessions
    const allSessions = this.serverManager.getAllSessions();
    const session = allSessions.find((s) => {
      if (targetWorkspaceId && s.workspaceId !== targetWorkspaceId) return false;
      const state = s.getState();
      if (state !== 'ready' && state !== 'running') return false;
      const caps = s.getCapabilities();
      return Boolean(caps?.documentLinkProvider);
    });

    if (!session) {
      Logger.debug('LspDocumentLinkProvider: No active session with documentLinkProvider capability');
      return null;
    }

    const lspUri = LspUriMapper.pathToUri(uri);

    try {
      const response = await session.getClient().sendRequest<LspDocumentLinkResponse>(
        'textDocument/documentLink',
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
        Logger.debug('LspDocumentLinkProvider: Discarded response due to newer document revision', {
          uri,
          requestRevision,
          currentRevision: currentDoc?.contentRevision,
        });
        return null;
      }

      const roots = this.workspaceEngine?.getRoots ? this.workspaceEngine.getRoots() : [];
      const rootUris = roots.map((r: any) => r.uri || r.path || String(r));

      // Map raw response to canonical models and decorations
      const { links, decorations } = LspDocumentLinkMapper.mapToDecorations(
        uri,
        requestRevision,
        session.serverDefinition.serverDefinitionId,
        session.sessionId,
        response,
        documentText,
        rootUris
      );

      // Update cache
      this.cache.set(uri, {
        uri,
        documentRevision: requestRevision,
        sessionId: session.sessionId,
        links,
        decorations,
        timestamp: Date.now(),
      });

      return {
        links,
        decorations,
        documentRevision: requestRevision,
      };
    } catch (err: unknown) {
      const isCancelled =
        token?.isCancellationRequested ||
        (err instanceof Error &&
          (err.name === 'LspCancelledError' ||
            err.message.includes('cancelled') ||
            err.message.includes('canceled')));

      if (!isCancelled) {
        Logger.warn('LspDocumentLinkProvider: textDocument/documentLink failed', err);
      }
      return null;
    }
  }
}

export const globalDocumentLinkProvider = LspDocumentLinkProvider.getInstance();
