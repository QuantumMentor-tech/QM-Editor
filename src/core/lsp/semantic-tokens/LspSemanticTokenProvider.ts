/**
 * QM Editor - LSP Semantic Tokens Provider
 * Phase 06, Step 64 — LSP Semantic Tokens, Semantic Highlighting & Incremental Token Synchronization
 * 
 * Manages communication with active Language Servers for semantic token requests:
 * textDocument/semanticTokens/full, full/delta, and range.
 * Handles legend synchronization, caching, delta patching, and validation.
 */

import { LspServerManager, globalLspServerManager } from '../LspServerManager';
import { SettingsService } from '../../settings/SettingsService';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { LspUriMapper } from '../LspUriMapper';
import { Logger } from '../../../utils/logger';
import { CancellationToken } from '../../symbols/SymbolTypes';
import {
  DecodedSemanticToken,
  LspRange,
  LspSemanticTokensResponse,
  LspSemanticTokensDeltaResponse,
  SemanticTokensCacheEntry,
} from './LspSemanticTokenTypes';
import { globalSemanticTokenLegend } from './LspSemanticTokenLegend';
import { LspSemanticTokenDecoder } from './LspSemanticTokenDecoder';
import { LspSemanticTokenValidator } from './LspSemanticTokenValidator';

export interface SemanticTokenResult {
  tokens: DecodedSemanticToken[];
  resultId?: string;
  isDelta: boolean;
}

export class LspSemanticTokenProvider {
  private static instance: LspSemanticTokenProvider | null = null;
  private readonly cache = new Map<string, SemanticTokensCacheEntry>();
  private isDisposed = false;

  constructor(
    private readonly serverManager: LspServerManager = globalLspServerManager,
    private readonly settingsService: SettingsService = SettingsService.getInstance(),
    private readonly workspaceEngine: WorkspaceEngine = globalWorkspaceEngine,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine
  ) {}

  public static getInstance(): LspSemanticTokenProvider {
    if (!LspSemanticTokenProvider.instance) {
      LspSemanticTokenProvider.instance = new LspSemanticTokenProvider();
    }
    return LspSemanticTokenProvider.instance;
  }

  public isEnabled(): boolean {
    const val = this.settingsService.get('lsp.semanticTokens.enabled');
    return val !== false;
  }

  public isDeltaEnabled(): boolean {
    const val = this.settingsService.get('lsp.semanticTokens.enableDeltas');
    return val !== false;
  }

  public getCache(uri: string): SemanticTokensCacheEntry | undefined {
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
   * Request full semantic tokens for a document, using delta requests when supported and cached.
   */
  public async requestDocumentSemanticTokens(
    uri: string,
    token?: CancellationToken
  ): Promise<SemanticTokenResult | null> {
    if (this.isDisposed || !this.isEnabled() || token?.isCancellationRequested) {
      return null;
    }

    const docRecord = this.documentEngine.getByResource(uri);
    if (!docRecord) {
      Logger.debug('LspSemanticTokenProvider: Document not found in DocumentEngine', { uri });
      return null;
    }

    const requestRevision = docRecord.contentRevision;

    const targetWorkspaceId = docRecord.workspaceId || this.workspaceEngine?.getWorkspaceId?.();
    const allSessions = this.serverManager.getAllSessions();
    const session = allSessions.find((s) => {
      if (targetWorkspaceId && s.workspaceId !== targetWorkspaceId) return false;
      const state = s.getState();
      if (state !== 'ready' && state !== 'running') return false;
      const caps = s.getCapabilities();
      return !!caps?.semanticTokensProvider;
    });

    if (!session) {
      Logger.debug('LspSemanticTokenProvider: No active session with semanticTokensProvider capability');
      return null;
    }

    const semCaps = session.getCapabilities()?.semanticTokensProvider;
    if (!semCaps) {
      return null;
    }

    // Register or synchronize the server session's legend
    const legendGen = globalSemanticTokenLegend.syncServerLegend(
      session.sessionId,
      semCaps.legend
    );

    const lspUri = LspUriMapper.pathToUri(uri);
    const existingCache = this.cache.get(uri);
    const supportsDelta =
      this.isDeltaEnabled() &&
      semCaps.full &&
      typeof semCaps.full === 'object' &&
      semCaps.full.delta === true;

    // Try delta request if cached resultId exists and legend has not changed
    if (
      supportsDelta &&
      existingCache &&
      existingCache.resultId &&
      existingCache.sessionId === session.sessionId &&
      existingCache.legendGeneration === legendGen
    ) {
      try {
        const deltaResult = await session.getClient().sendRequest<LspSemanticTokensDeltaResponse>(
          'textDocument/semanticTokens/full/delta',
          {
            textDocument: { uri: lspUri },
            previousResultId: existingCache.resultId,
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

        if (deltaResult) {
          // Check for mid-request document edits
          const latestDoc = this.documentEngine.getByResource(uri);
          if (!latestDoc || latestDoc.contentRevision !== requestRevision) {
            Logger.debug('LspSemanticTokenProvider: Document revision changed during delta request, discarding stale tokens', { uri });
            return null;
          }

          // If server returned edits
          if ('edits' in deltaResult && Array.isArray(deltaResult.edits)) {
            const patchedRawTokens = LspSemanticTokenDecoder.applyDeltaEdits(
              existingCache.rawTokens,
              deltaResult.edits
            );

            if (!patchedRawTokens) {
              Logger.warn('LspSemanticTokenProvider: Delta edits invalid or incompatible with base tokens; falling back to full tokens');
            } else {
              return this.processAndCacheRawTokens({
                uri,
                documentId: latestDoc.id,
                documentRevision: latestDoc.contentRevision,
                workspaceGeneration: this.workspaceEngine?.getGeneration ? this.workspaceEngine.getGeneration() : 0,
                sessionId: session.sessionId,
                legendGeneration: legendGen,
                resultId: deltaResult.resultId || existingCache.resultId,
                rawTokens: patchedRawTokens,
                docText: latestDoc.content,
                isDelta: true,
              });
            }
          }

          // If server responded with full tokens instead of edits
          if ('data' in deltaResult && Array.isArray(deltaResult.data)) {
            return this.processAndCacheRawTokens({
              uri,
              documentId: latestDoc.id,
              documentRevision: latestDoc.contentRevision,
              workspaceGeneration: this.workspaceEngine?.getGeneration ? this.workspaceEngine.getGeneration() : 0,
              sessionId: session.sessionId,
              legendGeneration: legendGen,
              resultId: deltaResult.resultId,
              rawTokens: deltaResult.data,
              docText: latestDoc.content,
              isDelta: false,
            });
          }
        }
      } catch (deltaErr) {
        // Delta request failed or result expired (e.g. LSP error -32802), fall back to full request
        Logger.debug('LspSemanticTokenProvider: Delta request failed, falling back to full request', deltaErr);
      }
    }

    // Full semantic tokens request
    try {
      const fullResult = await session.getClient().sendRequest<LspSemanticTokensResponse>(
        'textDocument/semanticTokens/full',
        {
          textDocument: { uri: lspUri },
        },
        {
          category: 'interactive',
          cancellationToken: token,
          timeoutMs: 5000,
        }
      );

      if (token?.isCancellationRequested || !fullResult || !Array.isArray(fullResult.data)) {
        return null;
      }

      // Check for mid-request document edits
      const latestDoc = this.documentEngine.getByResource(uri);
      if (!latestDoc || latestDoc.contentRevision !== requestRevision) {
        Logger.debug('LspSemanticTokenProvider: Document revision changed during request, discarding stale tokens', { uri });
        return null;
      }

      return this.processAndCacheRawTokens({
        uri,
        documentId: latestDoc.id,
        documentRevision: latestDoc.contentRevision,
        workspaceGeneration: this.workspaceEngine?.getGeneration ? this.workspaceEngine.getGeneration() : 0,
        sessionId: session.sessionId,
        legendGeneration: legendGen,
        resultId: fullResult.resultId,
        rawTokens: fullResult.data,
        docText: latestDoc.content,
        isDelta: false,
      });
    } catch (err) {
      Logger.warn('LspSemanticTokenProvider: textDocument/semanticTokens/full request failed', err);
      return null;
    }
  }

  /**
   * Request semantic tokens for a specific document range.
   */
  public async requestRangeSemanticTokens(
    uri: string,
    range: LspRange,
    token?: CancellationToken
  ): Promise<DecodedSemanticToken[] | null> {
    if (this.isDisposed || !this.isEnabled() || token?.isCancellationRequested) {
      return null;
    }

    const docRecord = this.documentEngine.getByResource(uri);
    if (!docRecord) return null;

    const targetWorkspaceId = docRecord.workspaceId || this.workspaceEngine?.getWorkspaceId?.();
    const allSessions = this.serverManager.getAllSessions();
    const session = allSessions.find((s) => {
      if (targetWorkspaceId && s.workspaceId !== targetWorkspaceId) return false;
      const state = s.getState();
      if (state !== 'ready' && state !== 'running') return false;
      const caps = s.getCapabilities();
      return !!caps?.semanticTokensProvider?.range;
    });

    if (!session) return null;

    const lspUri = LspUriMapper.pathToUri(uri);

    try {
      const rangeResult = await session.getClient().sendRequest<LspSemanticTokensResponse>(
        'textDocument/semanticTokens/range',
        {
          textDocument: { uri: lspUri },
          range,
        },
        {
          category: 'interactive',
          cancellationToken: token,
          timeoutMs: 3000,
        }
      );

      if (token?.isCancellationRequested || !rangeResult || !Array.isArray(rangeResult.data)) {
        return null;
      }

      const validated = LspSemanticTokenValidator.validateRawData(rangeResult.data);
      const decoded = LspSemanticTokenDecoder.decode(validated.sanitizedData, session.sessionId);
      const lines = docRecord.content.split('\n');
      const bounded = LspSemanticTokenValidator.validateAgainstDocument(decoded, lines);
      return LspSemanticTokenValidator.resolveOverlaps(bounded);
    } catch (err) {
      Logger.warn('LspSemanticTokenProvider: textDocument/semanticTokens/range request failed', err);
      return null;
    }
  }

  private processAndCacheRawTokens(params: {
    uri: string;
    documentId: string;
    documentRevision: number;
    workspaceGeneration: number;
    sessionId: string;
    legendGeneration: number;
    resultId?: string;
    rawTokens: number[];
    docText: string;
    isDelta: boolean;
  }): SemanticTokenResult {
    const validated = LspSemanticTokenValidator.validateRawData(params.rawTokens);
    const decoded = LspSemanticTokenDecoder.decode(validated.sanitizedData, params.sessionId);
    const lines = params.docText.split('\n');
    const bounded = LspSemanticTokenValidator.validateAgainstDocument(decoded, lines);
    const resolved = LspSemanticTokenValidator.resolveOverlaps(bounded);

    this.cache.set(params.uri, {
      uri: params.uri,
      documentId: params.documentId,
      documentRevision: params.documentRevision,
      workspaceGeneration: params.workspaceGeneration,
      sessionId: params.sessionId,
      legendGeneration: params.legendGeneration,
      resultId: params.resultId,
      rawTokens: validated.sanitizedData,
      decorations: [], // Populated on-demand or by Coordinator
      timestamp: Date.now(),
    });

    return {
      tokens: resolved,
      resultId: params.resultId,
      isDelta: params.isDelta,
    };
  }
}

export const globalSemanticTokenProvider = LspSemanticTokenProvider.getInstance();
