/**
 * QM Editor — LSP Folding Range Provider
 * Phase 06, Step 68 — LSP Folding Ranges, Smart Code Folding & Safe Document Structure Navigation
 * 
 * Communicates with language servers via textDocument/foldingRange, checks capability negotiation,
 * enforces stale revision protection, builds fold trees, and manages runtime folding caches.
 */

import { Logger } from '../../../utils/logger';
import { LspServerManager, globalLspServerManager } from '../LspServerManager';
import { SettingsService } from '../../settings/SettingsService';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { LspUriMapper } from '../LspUriMapper';
import { CancellationToken } from '../../symbols/SymbolTypes';
import {
  CanonicalFoldingRange,
  EditorFoldingRange,
  FoldingCapabilityState,
  FoldingRangeCacheEntry,
  FoldingTreeNode,
} from './LspFoldingTypes';
import { LspFoldingRangeResponse } from '../LspTypes';
import { LspFoldingValidator } from './LspFoldingValidator';
import { LspFoldingMapper, DocumentLineInfo } from './LspFoldingMapper';
import { LspFoldingTreeBuilder } from './LspFoldingTreeBuilder';

export interface FoldingRangeResult {
  ranges: CanonicalFoldingRange[];
  editorRanges: EditorFoldingRange[];
  tree: FoldingTreeNode[];
}

export class LspFoldingProvider {
  private static instance: LspFoldingProvider | null = null;
  private readonly cache = new Map<string, FoldingRangeCacheEntry>();
  private isDisposed = false;

  constructor(
    private readonly serverManager: LspServerManager = globalLspServerManager,
    private readonly settingsService: SettingsService = SettingsService.getInstance(),
    private readonly workspaceEngine: WorkspaceEngine = globalWorkspaceEngine,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine
  ) {}

  public static getInstance(): LspFoldingProvider {
    if (!LspFoldingProvider.instance) {
      LspFoldingProvider.instance = new LspFoldingProvider();
    }
    return LspFoldingProvider.instance;
  }

  public isEnabled(): boolean {
    const lspVal = this.settingsService.get('lsp.folding.enabled');
    const editorAlias = this.settingsService.get('editor.folding.lsp.enabled');
    const generalFolding = this.settingsService.get('editor.folding');
    return lspVal !== false && editorAlias !== false && generalFolding !== false;
  }

  public areImportsEnabled(): boolean {
    return this.settingsService.get('lsp.folding.imports') !== false;
  }

  public areCommentsEnabled(): boolean {
    return this.settingsService.get('lsp.folding.comments') !== false;
  }

  public getCache(uri: string): FoldingRangeCacheEntry | undefined {
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
   * Evaluates the folding capability state for a language server session.
   */
  public getCapabilityState(languageId: string, workspaceId: string): FoldingCapabilityState {
    const allSessions = this.serverManager.getAllSessions();
    const session = allSessions.find((s) => {
      if (workspaceId && s.workspaceId !== workspaceId) return false;
      const state = s.getState();
      if (state !== 'ready' && state !== 'running') return false;
      return true;
    });

    if (!session) {
      return { supported: false, generation: 0 };
    }

    const cap = session.getCapabilities()?.foldingRangeProvider;
    if (!cap) {
      return {
        supported: false,
        sessionId: session.sessionId,
        workspaceId,
        languageId,
        generation: session.getSessionGeneration(),
      };
    }

    return {
      supported: true,
      lineFoldingOnly: typeof cap === 'object' ? (cap as any).lineFoldingOnly : false,
      rangeLimit: typeof cap === 'object' ? (cap as any).rangeLimit : undefined,
      sessionId: session.sessionId,
      workspaceId,
      languageId,
      generation: session.getSessionGeneration(),
    };
  }

  /**
   * Requests folding ranges from the language server for a document.
   */
  public async requestFoldingRanges(
    uri: string,
    token?: CancellationToken
  ): Promise<FoldingRangeResult | null> {
    if (this.isDisposed || !this.isEnabled() || token?.isCancellationRequested) {
      return null;
    }

    const docRecord = this.documentEngine.getByResource(uri);
    if (!docRecord) {
      Logger.debug('LspFoldingProvider: Document not found in engine', { uri });
      return null;
    }

    const targetWorkspaceId = docRecord.workspaceId || this.workspaceEngine.getWorkspaceId() || 'default-workspace';
    const workspaceGen = this.workspaceEngine.getGeneration();

    const allSessions = this.serverManager.getAllSessions();
    const session = allSessions.find((s) => {
      if (targetWorkspaceId && s.workspaceId !== targetWorkspaceId) return false;
      const state = s.getState();
      if (state !== 'ready' && state !== 'running') return false;
      const caps = s.getCapabilities();
      return Boolean(caps?.foldingRangeProvider);
    });

    if (!session) {
      Logger.debug('LspFoldingProvider: No active session with foldingRangeProvider capability');
      return null;
    }

    const startRevision = docRecord.contentRevision;
    const startSessionId = session.sessionId;
    const providerGen = session.getSessionGeneration();
    const canonicalUri = uri.startsWith('file://') ? uri : LspUriMapper.pathToUri(uri);

    try {
      const response = await session.getClient().sendRequest<LspFoldingRangeResponse>(
        'textDocument/foldingRange',
        {
          textDocument: {
            uri: canonicalUri,
          },
        },
        {
          category: 'interactive',
          cancellationToken: token,
          timeoutMs: 5000,
        }
      );

      // Stale response checks: discard if document changed or session restarted
      if (
        this.isDisposed ||
        token?.isCancellationRequested ||
        docRecord.contentRevision !== startRevision ||
        session.sessionId !== startSessionId ||
        this.workspaceEngine.getGeneration() !== workspaceGen
      ) {
        Logger.debug('LspFoldingProvider: Discarded stale folding range response', {
          uri,
          startRevision,
          currentRevision: docRecord.contentRevision,
        });
        return null;
      }

      const content = docRecord.content || '';
      const lines = content.split('\n');
      const totalLines = Math.max(1, lines.length);

      // Helper to compute line offsets
      const lineOffsets: number[] = [0];
      for (let i = 0; i < lines.length; i++) {
        lineOffsets.push(lineOffsets[i] + lines[i].length + 1);
      }

      const docLineInfo: DocumentLineInfo = {
        lines: totalLines,
        length: content.length,
        line: (n: number) => {
          const idx = Math.max(1, Math.min(n, totalLines)) - 1;
          const from = lineOffsets[idx];
          const len = lines[idx] ? lines[idx].length : 0;
          return {
            from,
            to: from + len,
            length: len,
            number: idx + 1,
          };
        },
      };

      // 1. Validate raw ranges
      const validated = LspFoldingValidator.validateRanges(response, totalLines);

      // 2. Map to canonical ranges
      const canonical = LspFoldingMapper.mapToCanonicalRanges(validated, docLineInfo, {
        documentUri: canonicalUri,
        documentRevision: startRevision,
        providerId: session.serverDefinition.serverDefinitionId,
        providerGeneration: providerGen,
        importsEnabled: this.areImportsEnabled(),
        commentsEnabled: this.areCommentsEnabled(),
      });

      // 3. Build strictly nested tree and eliminate illegal overlaps
      const foldTree = LspFoldingTreeBuilder.buildTree(canonical);

      // 4. Map to editor ranges for CodeMirror
      const editorRanges = LspFoldingMapper.mapToEditorRanges(foldTree.allRanges);

      const result: FoldingRangeResult = {
        ranges: foldTree.allRanges,
        editorRanges,
        tree: foldTree.roots,
      };

      // 5. Cache result
      this.cache.set(canonicalUri, {
        uri: canonicalUri,
        revision: startRevision,
        sessionId: startSessionId,
        generation: providerGen,
        ranges: foldTree.allRanges,
        tree: foldTree.roots,
        editorRanges,
        timestamp: Date.now(),
      });

      return result;
    } catch (err) {
      if ((err as Error).name === 'AbortError' || token?.isCancellationRequested) {
        return null;
      }
      Logger.warn('LspFoldingProvider: Request failed', {
        uri,
        error: (err as Error).message,
      });
      return null;
    }
  }
}

export const globalFoldingProvider = LspFoldingProvider.getInstance();
