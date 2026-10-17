/**
 * QM Editor — LSP Folding Range Coordinator
 * Phase 06, Step 68 — LSP Folding Ranges, Smart Code Folding & Safe Document Structure Navigation
 * 
 * Orchestrates folding requests, debounce timers, document lifecycle updates,
 * settings changes, and state synchronization with editor adapter instances.
 */

import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { SettingsService } from '../../settings/SettingsService';
import { Logger } from '../../../utils/logger';
import { LspFoldingProvider, globalFoldingProvider } from './LspFoldingProvider';
import {
  CanonicalFoldingRange,
  EditorFoldingRange,
  FoldingTreeNode,
} from './LspFoldingTypes';
import { CancellationTokenSource } from '../../symbols/CancellationToken';

export type FoldingEventType = 'rangesUpdated' | 'rangesCleared';

export interface FoldingEvent {
  type: FoldingEventType;
  uri: string;
  editorRanges?: EditorFoldingRange[];
  ranges?: CanonicalFoldingRange[];
  tree?: FoldingTreeNode[];
}

export type FoldingListener = (event: FoldingEvent) => void;

export class LspFoldingCoordinator {
  private static instance: LspFoldingCoordinator | null = null;
  private readonly listeners = new Set<FoldingListener>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly activeEditorRanges = new Map<string, EditorFoldingRange[]>();
  private readonly activeTrees = new Map<string, FoldingTreeNode[]>();
  private readonly docIdToUri = new Map<string, string>();
  private readonly cancellationTokens = new Map<string, CancellationTokenSource>();
  private readonly unsubscribers: Array<() => void> = [];
  private isDisposed = false;

  constructor(
    private readonly provider: LspFoldingProvider = globalFoldingProvider,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine,
    private readonly settingsService: SettingsService = SettingsService.getInstance()
  ) {
    this.bindDocumentEvents();
    this.bindSettingsEvents();
  }

  public static getInstance(): LspFoldingCoordinator {
    if (!LspFoldingCoordinator.instance) {
      LspFoldingCoordinator.instance = new LspFoldingCoordinator();
    }
    return LspFoldingCoordinator.instance;
  }

  private bindDocumentEvents(): void {
    const unsubOpen = this.documentEngine.on('document.opened', (e) => {
      const doc = this.documentEngine.getDocument(e.documentId);
      if (doc?.resourceUri) {
        this.docIdToUri.set(e.documentId, doc.resourceUri);
        this.requestFoldingRanges(doc.resourceUri, true);
      }
    });

    const unsubChange = this.documentEngine.on('document.changed', (e) => {
      const doc = this.documentEngine.getDocument(e.documentId);
      if (doc?.resourceUri) {
        this.docIdToUri.set(e.documentId, doc.resourceUri);
        this.requestFoldingRanges(doc.resourceUri, false);
      }
    });

    const unsubClose = this.documentEngine.on('document.closed', (e: any) => {
      const uri = e.uri || (e.documentId ? this.docIdToUri.get(e.documentId) : undefined);
      if (e.documentId) {
        this.docIdToUri.delete(e.documentId);
      }
      if (uri) {
        this.clearFoldingRanges(uri);
      }
    });

    this.unsubscribers.push(unsubOpen, unsubChange, unsubClose);
  }

  private bindSettingsEvents(): void {
    if (this.settingsService && typeof this.settingsService.subscribe === 'function') {
      const unsubSettings = this.settingsService.subscribe('lsp.folding.*', (e) => {
        if (e.key === 'lsp.folding.enabled' && e.currentValue === false) {
          this.clearFoldingRanges();
        } else {
          this.refreshAllActiveDocuments();
        }
      });
      this.unsubscribers.push(unsubSettings);
    }
  }

  public isEnabled(): boolean {
    return this.provider.isEnabled();
  }

  public subscribe(listener: FoldingListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getEditorRanges(uri: string): EditorFoldingRange[] {
    return this.activeEditorRanges.get(uri) || [];
  }

  public getTree(uri: string): FoldingTreeNode[] {
    return this.activeTrees.get(uri) || [];
  }

  public requestFoldingRanges(uri: string, immediate = false): void {
    if (this.isDisposed || !this.isEnabled()) return;

    // Clear existing timer if any
    const existingTimer = this.debounceTimers.get(uri);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.debounceTimers.delete(uri);
    }

    if (immediate) {
      this.executeRequest(uri);
      return;
    }

    const debounceMs = Math.max(
      50,
      Number(this.settingsService.get('lsp.folding.requestDebounceMs')) || 300
    );

    const timer = setTimeout(() => {
      this.debounceTimers.delete(uri);
      this.executeRequest(uri);
    }, debounceMs);

    this.debounceTimers.set(uri, timer);
  }

  private async executeRequest(uri: string): Promise<void> {
    if (this.isDisposed) return;

    // Cancel in-flight request for this URI
    const existingToken = this.cancellationTokens.get(uri);
    if (existingToken) {
      existingToken.cancel();
      this.cancellationTokens.delete(uri);
    }

    const cts = new CancellationTokenSource();
    this.cancellationTokens.set(uri, cts);

    try {
      const result = await this.provider.requestFoldingRanges(uri, cts.token);
      if (this.isDisposed || cts.token.isCancellationRequested) return;

      if (!result) {
        // Empty or unsupported: if previously had ranges, keep or clear
        return;
      }

      this.activeEditorRanges.set(uri, result.editorRanges);
      this.activeTrees.set(uri, result.tree);

      this.notifyListeners({
        type: 'rangesUpdated',
        uri,
        editorRanges: result.editorRanges,
        ranges: result.ranges,
        tree: result.tree,
      });
    } catch (err) {
      Logger.debug('LspFoldingCoordinator: Error processing folding request', {
        uri,
        error: (err as Error).message,
      });
    } finally {
      if (this.cancellationTokens.get(uri) === cts) {
        this.cancellationTokens.delete(uri);
      }
    }
  }

  public clearFoldingRanges(uri?: string): void {
    if (uri) {
      const timer = this.debounceTimers.get(uri);
      if (timer) {
        clearTimeout(timer);
        this.debounceTimers.delete(uri);
      }

      const cts = this.cancellationTokens.get(uri);
      if (cts) {
        cts.cancel();
        this.cancellationTokens.delete(uri);
      }

      this.activeEditorRanges.delete(uri);
      this.activeTrees.delete(uri);
      this.provider.clearCache(uri);

      this.notifyListeners({
        type: 'rangesCleared',
        uri,
      });
    } else {
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();

      for (const cts of this.cancellationTokens.values()) {
        cts.cancel();
      }
      this.cancellationTokens.clear();

      this.activeEditorRanges.clear();
      this.activeTrees.clear();
      this.provider.clearCache();

      this.notifyListeners({
        type: 'rangesCleared',
        uri: '',
      });
    }
  }

  public refreshAllActiveDocuments(): void {
    for (const uri of this.docIdToUri.values()) {
      this.requestFoldingRanges(uri, true);
    }
  }

  private notifyListeners(event: FoldingEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        Logger.error('LspFoldingCoordinator: Listener threw error', {
          error: (err as Error).message,
        });
      }
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    for (const unsub of this.unsubscribers) {
      try {
        unsub();
      } catch {}
    }
    this.unsubscribers.length = 0;

    this.clearFoldingRanges();
    this.listeners.clear();
    this.docIdToUri.clear();
  }
}

export const globalFoldingCoordinator = LspFoldingCoordinator.getInstance();
