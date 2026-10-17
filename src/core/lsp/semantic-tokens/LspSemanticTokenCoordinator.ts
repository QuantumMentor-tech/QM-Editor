/**
 * QM Editor - LSP Semantic Tokens Coordinator
 * Phase 06, Step 64 — LSP Semantic Tokens, Semantic Highlighting & Incremental Token Synchronization
 * 
 * Orchestrates semantic token requests, debounce timing, document updates,
 * decoration caching, and synchronization with editor surfaces.
 */

import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { SettingsService } from '../../settings/SettingsService';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { Logger } from '../../../utils/logger';
import { LspSemanticTokenProvider, globalSemanticTokenProvider } from './LspSemanticTokenProvider';
import { LspSemanticTokenMapper } from './LspSemanticTokenMapper';
import { EditorSemanticTokenDecoration } from './LspSemanticTokenTypes';
import { CancellationTokenSource } from '../../symbols/CancellationToken';

export type SemanticTokenEventType = 'tokensUpdated' | 'tokensCleared';

export interface SemanticTokenEvent {
  type: SemanticTokenEventType;
  uri: string;
  decorations?: EditorSemanticTokenDecoration[];
}

export type SemanticTokenListener = (event: SemanticTokenEvent) => void;

export class LspSemanticTokenCoordinator {
  private static instance: LspSemanticTokenCoordinator | null = null;
  private readonly listeners = new Set<SemanticTokenListener>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly activeTokens = new Map<string, EditorSemanticTokenDecoration[]>();
  private readonly cancellationTokens = new Map<string, CancellationTokenSource>();
  private readonly unsubscribers: Array<() => void> = [];
  private isDisposed = false;

  constructor(
    private readonly provider: LspSemanticTokenProvider = globalSemanticTokenProvider,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine,
    private readonly workspaceEngine: WorkspaceEngine = globalWorkspaceEngine,
    private readonly settingsService: SettingsService = SettingsService.getInstance()
  ) {
    this.bindDocumentEvents();
  }

  private bindDocumentEvents(): void {
    const unsubOpen = this.documentEngine.on('document.opened', (e) => {
      const doc = this.documentEngine.getDocument(e.documentId);
      if (doc?.resourceUri) {
        this.requestSemanticTokens(doc.resourceUri, true);
      }
    });

    const unsubChange = this.documentEngine.on('document.changed', (e) => {
      const doc = this.documentEngine.getDocument(e.documentId);
      if (doc?.resourceUri) {
        this.requestSemanticTokens(doc.resourceUri, false);
      }
    });

    const unsubClose = this.documentEngine.on('document.closed', (e) => {
      if (e.documentId) {
        // Document record might already be closed, search cache by docId or URI
        const doc = this.documentEngine.getDocument(e.documentId);
        if (doc?.resourceUri) {
          this.clearTokens(doc.resourceUri);
        }
      }
    });

    this.unsubscribers.push(unsubOpen, unsubChange, unsubClose);
  }

  public static getInstance(): LspSemanticTokenCoordinator {
    if (!LspSemanticTokenCoordinator.instance) {
      LspSemanticTokenCoordinator.instance = new LspSemanticTokenCoordinator();
    }
    return LspSemanticTokenCoordinator.instance;
  }

  public isEnabled(): boolean {
    const val = this.settingsService.get('lsp.semanticTokens.enabled');
    return val !== false;
  }

  public getDebounceMs(): number {
    const val = this.settingsService.get<number>('lsp.semanticTokens.requestDebounceMs');
    return typeof val === 'number' && val >= 0 ? val : 250;
  }

  public subscribe(listener: SemanticTokenListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getDecorations(uri: string): EditorSemanticTokenDecoration[] {
    return this.activeTokens.get(uri) || [];
  }

  /**
   * Request semantic tokens for a document URI, with debouncing by default.
   */
  public async requestSemanticTokens(uri: string, immediate: boolean = false): Promise<void> {
    if (this.isDisposed || !this.isEnabled() || !uri) {
      return;
    }

    // Cancel existing debounce timer for this URI
    const existingTimer = this.debounceTimers.get(uri);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.debounceTimers.delete(uri);
    }

    if (immediate) {
      await this.executeRequest(uri);
    } else {
      const debounceMs = this.getDebounceMs();
      const timer = setTimeout(() => {
        this.debounceTimers.delete(uri);
        this.executeRequest(uri);
      }, debounceMs);
      this.debounceTimers.set(uri, timer);
    }
  }

  /**
   * Immediately clears cached tokens and notifies subscribers.
   */
  public clearTokens(uri?: string): void {
    if (uri) {
      const existingTimer = this.debounceTimers.get(uri);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.debounceTimers.delete(uri);
      }

      const cts = this.cancellationTokens.get(uri);
      if (cts) {
        cts.cancel();
        this.cancellationTokens.delete(uri);
      }

      this.activeTokens.delete(uri);
      this.provider.clearCache(uri);
      this.notifyListeners({ type: 'tokensCleared', uri });
    } else {
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();

      for (const cts of this.cancellationTokens.values()) {
        cts.cancel();
      }
      this.cancellationTokens.clear();

      this.activeTokens.clear();
      this.provider.clearCache();
      this.notifyListeners({ type: 'tokensCleared', uri: '' });
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
    this.clearTokens();
    this.listeners.clear();
  }

  private async executeRequest(uri: string): Promise<void> {
    if (this.isDisposed || !this.isEnabled()) return;

    const docRecord = this.documentEngine.getByResource(uri);
    if (!docRecord) {
      return;
    }

    const requestWorkspaceGen = this.workspaceEngine?.getGeneration ? this.workspaceEngine.getGeneration() : 0;
    const requestDocRevision = docRecord.contentRevision;

    // Cancel any prior in-flight request for this URI
    const prevCts = this.cancellationTokens.get(uri);
    if (prevCts) {
      prevCts.cancel();
    }

    const cts = new CancellationTokenSource();
    this.cancellationTokens.set(uri, cts);

    try {
      const result = await this.provider.requestDocumentSemanticTokens(uri, cts.token);

      if (cts.token.isCancellationRequested || !result) {
        return;
      }

      // Ensure doc revision and workspace generation haven't changed out from under us
      const currentWorkspaceGen = this.workspaceEngine?.getGeneration ? this.workspaceEngine.getGeneration() : 0;
      if (currentWorkspaceGen !== requestWorkspaceGen) {
        Logger.debug('LspSemanticTokenCoordinator: Workspace switched during request, discarding', { uri });
        return;
      }

      const currentDoc = this.documentEngine.getByResource(uri);
      if (!currentDoc || currentDoc.contentRevision !== requestDocRevision) {
        Logger.debug('LspSemanticTokenCoordinator: Document revision changed during request', {
          uri,
          reqRev: requestDocRevision,
          currRev: currentDoc?.contentRevision,
        });
        return;
      }

      const decorations = LspSemanticTokenMapper.toEditorDecorations(
        result.tokens,
        currentDoc.content
      );

      this.activeTokens.set(uri, decorations);

      this.notifyListeners({
        type: 'tokensUpdated',
        uri,
        decorations,
      });
    } catch (err) {
      Logger.warn('LspSemanticTokenCoordinator: Failed to execute semantic tokens request', err);
    } finally {
      if (this.cancellationTokens.get(uri) === cts) {
        this.cancellationTokens.delete(uri);
      }
    }
  }

  private notifyListeners(event: SemanticTokenEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        Logger.error('LspSemanticTokenCoordinator: Error in listener', err);
      }
    }
  }
}

export const globalSemanticTokenCoordinator = LspSemanticTokenCoordinator.getInstance();
