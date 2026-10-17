/**
 * QM Editor - LSP Inlay Hints Provider
 * Phase 06, Step 65 — LSP Inlay Hints, Parameter Names, Type Information & Inline Semantic Annotations
 * 
 * Manages communication with active Language Servers for `textDocument/inlayHint` requests.
 * Handles server capability checking, range computation, validation, mapping, caching,
 * and double-revision stale response protection.
 */

import { LspServerManager, globalLspServerManager } from '../LspServerManager';
import { SettingsService } from '../../settings/SettingsService';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { LspUriMapper } from '../LspUriMapper';
import { Logger } from '../../../utils/logger';
import { CancellationToken } from '../../symbols/SymbolTypes';
import {
  EditorInlayHintDecoration,
  InlayHintsCacheEntry,
  InlayHintRequestOptions,
  LspInlayHintResponse,
  LspRange,
} from './LspInlayHintTypes';
import { LspInlayHintValidator } from './LspInlayHintValidator';
import { LspInlayHintMapper } from './LspInlayHintMapper';

export interface InlayHintResult {
  readonly hints: EditorInlayHintDecoration[];
  readonly documentRevision: number;
}

export class LspInlayHintProvider {
  private static instance: LspInlayHintProvider | null = null;
  private readonly cache = new Map<string, InlayHintsCacheEntry>();
  private isDisposed = false;

  constructor(
    private readonly serverManager: LspServerManager = globalLspServerManager,
    private readonly settingsService: SettingsService = SettingsService.getInstance(),
    private readonly workspaceEngine: WorkspaceEngine = globalWorkspaceEngine,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine
  ) {}

  public static getInstance(): LspInlayHintProvider {
    if (!LspInlayHintProvider.instance) {
      LspInlayHintProvider.instance = new LspInlayHintProvider();
    }
    return LspInlayHintProvider.instance;
  }

  public isEnabled(): boolean {
    const val = this.settingsService.get('lsp.inlayHints.enabled');
    return val !== false;
  }

  public areTypeHintsEnabled(): boolean {
    const val = this.settingsService.get('lsp.inlayHints.typeHints');
    return val !== false;
  }

  public areParameterHintsEnabled(): boolean {
    const val = this.settingsService.get('lsp.inlayHints.parameterNames');
    return val !== false;
  }

  public getCache(uri: string): InlayHintsCacheEntry | undefined {
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
   * Requests inlay hints for a given document resource URI.
   */
  public async requestInlayHints(
    uri: string,
    options: InlayHintRequestOptions = {},
    token?: CancellationToken
  ): Promise<InlayHintResult | null> {
    if (this.isDisposed || !this.isEnabled() || token?.isCancellationRequested) {
      return null;
    }

    const docRecord = this.documentEngine.getByResource(uri);
    if (!docRecord) {
      Logger.debug('LspInlayHintProvider: Document not found in DocumentEngine', { uri });
      return null;
    }

    const requestRevision = docRecord.contentRevision;
    const documentText = docRecord.content ?? '';
    const lines = documentText.split('\n');

    const targetWorkspaceId = docRecord.workspaceId || this.workspaceEngine?.getWorkspaceId?.();
    const allSessions = this.serverManager.getAllSessions();
    const session = allSessions.find((s) => {
      if (targetWorkspaceId && s.workspaceId !== targetWorkspaceId) return false;
      const state = s.getState();
      if (state !== 'ready' && state !== 'running') return false;
      const caps = s.getCapabilities();
      return !!caps?.inlayHintProvider;
    });

    if (!session) {
      Logger.debug('LspInlayHintProvider: No active session with inlayHintProvider capability');
      return null;
    }

    const lspUri = LspUriMapper.pathToUri(uri);

    // Compute range if not explicitly provided
    const range: LspRange = options.range ?? {
      start: { line: 0, character: 0 },
      end: {
        line: Math.max(0, lines.length - 1),
        character: lines[Math.max(0, lines.length - 1)]?.length ?? 0,
      },
    };

    try {
      const response = await session.getClient().sendRequest<LspInlayHintResponse>(
        'textDocument/inlayHint',
        {
          textDocument: { uri: lspUri },
          range,
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
        Logger.debug('LspInlayHintProvider: Discarded response due to newer document revision', {
          uri,
          requestRevision,
          currentRevision: currentDoc?.contentRevision,
        });
        return null;
      }

      // Validate raw hints
      const validated = LspInlayHintValidator.validateResponse(response, lines);

      // Map to canonical editor decorations
      const decorations = LspInlayHintMapper.mapToDecorations(
        uri,
        validated,
        documentText,
        {
          includeParameters: this.areParameterHintsEnabled(),
          includeTypes: this.areTypeHintsEnabled(),
        }
      );

      // Update cache
      this.cache.set(uri, {
        uri,
        documentRevision: requestRevision,
        sessionId: session.sessionId,
        hints: decorations,
        timestamp: Date.now(),
      });

      return {
        hints: decorations,
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
        Logger.debug('LspInlayHintProvider: Inlay hint request cancelled', { uri });
        return null;
      }

      Logger.warn('LspInlayHintProvider: textDocument/inlayHint request failed', err);
      return null;
    }
  }
}

export const globalInlayHintProvider = LspInlayHintProvider.getInstance();
