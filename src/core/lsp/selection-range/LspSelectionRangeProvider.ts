/**
 * QM Editor — LSP Selection Range Provider
 * Phase 06, Step 69 — LSP Selection Ranges, Smart Structural Selection & Context-Aware Cursor Expansion
 *
 * Communicates with language servers via textDocument/selectionRange, validates capabilities,
 * enforces stale revision protection, and produces canonical selection hierarchies.
 */

import { Logger } from '../../../utils/logger';
import { LspServerManager, globalLspServerManager } from '../LspServerManager';
import { SettingsService } from '../../settings/SettingsService';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { LspUriMapper } from '../LspUriMapper';
import { CancellationToken } from '../../symbols/SymbolTypes';
import { LspPosition, LspSelectionRangeParams, LspSelectionRangeResponse } from '../LspTypes';
import {
  SelectionHierarchy,
  SelectionRangeCapabilityState,
} from './LspSelectionRangeTypes';
import { LspSelectionRangeValidator } from './LspSelectionRangeValidator';
import { LspSelectionRangeMapper } from './LspSelectionRangeMapper';

export interface SelectionRangeCacheEntry {
  uri: string;
  documentRevision: number;
  hierarchies: SelectionHierarchy[];
  timestamp: number;
}

export class LspSelectionRangeProvider {
  private static instance: LspSelectionRangeProvider | null = null;
  private readonly cache = new Map<string, SelectionRangeCacheEntry>();
  private readonly inFlightRequests = new Map<string, string>(); // uri -> requestId
  private isDisposed = false;

  constructor(
    private readonly serverManager: LspServerManager = globalLspServerManager,
    private readonly settingsService: SettingsService = SettingsService.getInstance(),
    private readonly workspaceEngine: WorkspaceEngine = globalWorkspaceEngine,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine
  ) {}

  public static getInstance(): LspSelectionRangeProvider {
    if (!LspSelectionRangeProvider.instance) {
      LspSelectionRangeProvider.instance = new LspSelectionRangeProvider();
    }
    return LspSelectionRangeProvider.instance;
  }

  public isEnabled(): boolean {
    const lspVal = this.settingsService.get('lsp.selectionRange.enabled');
    const editorVal = this.settingsService.get('editor.selectionExpansion.enabled');
    const useLsp = this.settingsService.get('editor.selectionExpansion.useLanguageServer');
    return lspVal !== false && editorVal !== false && useLsp !== false;
  }

  public getMaxDepth(): number {
    const setting = this.settingsService.get('lsp.selectionRange.maxDepth');
    return typeof setting === 'number' && setting > 0 ? setting : 50;
  }

  public getCache(uri: string): SelectionRangeCacheEntry | undefined {
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
    this.inFlightRequests.clear();
  }

  /**
   * Evaluates the selectionRange capability state for a language server session.
   */
  public getCapabilityState(languageId: string, workspaceId: string): SelectionRangeCapabilityState {
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

    const caps = session.getCapabilities();
    const supported = Boolean(caps?.selectionRangeProvider);

    return {
      supported,
      sessionId: session.sessionId,
      workspaceId: session.workspaceId,
      languageId,
      generation: session.getSessionGeneration(),
    };
  }

  /**
   * Requests selection ranges for the given document and positions.
   *
   * @param documentUri URI of the target document
   * @param positions Cursor or selection anchor positions to evaluate
   * @param token Optional cancellation token
   * @returns Array of SelectionHierarchy objects matching the requested positions
   */
  public async requestSelectionRanges(
    documentUri: string,
    positions: LspPosition[],
    token?: CancellationToken
  ): Promise<SelectionHierarchy[] | null> {
    if (this.isDisposed || !this.isEnabled() || positions.length === 0) {
      return null;
    }

    const doc = this.documentEngine.getByResource(documentUri);
    if (!doc) {
      return null;
    }

    const workspaceId = this.workspaceEngine.getWorkspaceId() || doc.workspaceId || 'default-workspace';
    const session = this.serverManager.getActiveSession(doc.languageId, workspaceId);
    if (!session || (session.getState() !== 'ready' && session.getState() !== 'running')) {
      return null;
    }

    const caps = session.getCapabilities();
    if (!caps?.selectionRangeProvider) {
      return null;
    }

    const initialRevision = doc.contentRevision;
    const initialGeneration = session.getSessionGeneration();
    const requestId = `sel_range_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.inFlightRequests.set(documentUri, requestId);

    const client = session.getClient();
    const lspUri = LspUriMapper.pathToUri(documentUri);

    const params: LspSelectionRangeParams = {
      textDocument: { uri: lspUri },
      positions,
    };

    try {
      if (token?.isCancellationRequested) {
        return null;
      }

      const response = await client.sendRequest<LspSelectionRangeResponse>(
        'textDocument/selectionRange',
        params,
        {
          category: 'interactive',
          cancellationToken: token,
          timeoutMs: 5000,
        }
      );

      // Stale check 1: Was this request superseded by a newer one?
      if (this.inFlightRequests.get(documentUri) !== requestId) {
        Logger.debug('LspSelectionRangeProvider: Discarded response due to newer in-flight request', {
          uri: documentUri,
        });
        return null;
      }

      // Stale check 2: Cancellation
      if (token?.isCancellationRequested) {
        return null;
      }

      // Stale check 3: Document revision & server generation mismatch
      const currentDoc = this.documentEngine.getDocument(doc.id);
      if (!currentDoc || currentDoc.contentRevision !== initialRevision) {
        Logger.debug('LspSelectionRangeProvider: Discarded response due to document revision change', {
          initialRevision,
          currentRevision: currentDoc?.contentRevision,
        });
        return null;
      }

      if (session.getSessionGeneration() !== initialGeneration) {
        Logger.debug('LspSelectionRangeProvider: Discarded response due to session restart');
        return null;
      }

      if (!response || !Array.isArray(response)) {
        return null;
      }

      // Validate untrusted server response
      const maxDepth = this.getMaxDepth();
      const validatedRoots = LspSelectionRangeValidator.validateSelectionRangeResponse(
        response,
        positions.length,
        maxDepth
      );

      const offsets = LspSelectionRangeMapper.computeLineOffsets(currentDoc.content);
      const hierarchies: SelectionHierarchy[] = [];

      for (let i = 0; i < positions.length; i++) {
        const rootNode = validatedRoots[i];
        const canonicalRoot = LspSelectionRangeMapper.mapToCanonicalHierarchy(rootNode, {
          documentId: currentDoc.id,
          resourceId: currentDoc.resourceUri,
          workspaceId,
          providerId: session.sessionId,
          providerGeneration: initialGeneration,
          documentRevision: initialRevision,
          offsets,
        });

        const flattened = LspSelectionRangeMapper.flattenHierarchy(canonicalRoot);
        hierarchies.push({
          cursorPosition: positions[i],
          ranges: flattened,
        });
      }

      // Update cache
      this.cache.set(documentUri, {
        uri: documentUri,
        documentRevision: initialRevision,
        hierarchies,
        timestamp: Date.now(),
      });

      return hierarchies;
    } catch (err) {
      if (!this.isDisposed) {
        Logger.warn('LspSelectionRangeProvider: textDocument/selectionRange request failed', {
          uri: documentUri,
          error: (err as Error).message,
        });
      }
      return null;
    } finally {
      if (this.inFlightRequests.get(documentUri) === requestId) {
        this.inFlightRequests.delete(documentUri);
      }
    }
  }
}

export const globalSelectionRangeProvider = LspSelectionRangeProvider.getInstance();
