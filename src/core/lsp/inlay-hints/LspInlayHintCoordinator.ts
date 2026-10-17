/**
 * QM Editor - LSP Inlay Hints Coordinator
 * Phase 06, Step 65 — LSP Inlay Hints, Parameter Names, Type Information & Inline Semantic Annotations
 * 
 * Orchestrates inlay hint requests, debounce timing, document updates,
 * decoration caching, and synchronization with editor surfaces.
 */

import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { SettingsService } from '../../settings/SettingsService';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { Logger } from '../../../utils/logger';
import { LspInlayHintProvider, globalInlayHintProvider } from './LspInlayHintProvider';
import { EditorInlayHintDecoration } from './LspInlayHintTypes';
import { CancellationTokenSource } from '../../symbols/CancellationToken';

export type InlayHintEventType = 'hintsUpdated' | 'hintsCleared';

export interface InlayHintEvent {
  type: InlayHintEventType;
  uri: string;
  decorations?: EditorInlayHintDecoration[];
}

export type InlayHintListener = (event: InlayHintEvent) => void;

export class LspInlayHintCoordinator {
  private static instance: LspInlayHintCoordinator | null = null;
  private readonly listeners = new Set<InlayHintListener>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly activeHints = new Map<string, EditorInlayHintDecoration[]>();
  private readonly docIdToUri = new Map<string, string>();
  private readonly cancellationTokens = new Map<string, CancellationTokenSource>();
  private readonly unsubscribers: Array<() => void> = [];
  private isDisposed = false;

  constructor(
    private readonly provider: LspInlayHintProvider = globalInlayHintProvider,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine,
    private readonly workspaceEngine: WorkspaceEngine = globalWorkspaceEngine,
    private readonly settingsService: SettingsService = SettingsService.getInstance()
  ) {
    this.bindDocumentEvents();
    this.bindSettingsEvents();
  }

  private bindDocumentEvents(): void {
    const unsubOpen = this.documentEngine.on('document.opened', (e) => {
      const doc = this.documentEngine.getDocument(e.documentId);
      if (doc?.resourceUri) {
        this.docIdToUri.set(e.documentId, doc.resourceUri);
        this.requestInlayHints(doc.resourceUri, true);
      }
    });

    const unsubChange = this.documentEngine.on('document.changed', (e) => {
      const doc = this.documentEngine.getDocument(e.documentId);
      if (doc?.resourceUri) {
        this.docIdToUri.set(e.documentId, doc.resourceUri);
        this.requestInlayHints(doc.resourceUri, false);
      }
    });

    const unsubClose = this.documentEngine.on('document.closed', (e: any) => {
      const uri = e.uri || (e.documentId ? this.docIdToUri.get(e.documentId) : undefined);
      if (e.documentId) {
        this.docIdToUri.delete(e.documentId);
      }
      if (uri) {
        this.clearHints(uri);
      }
    });

    this.unsubscribers.push(unsubOpen, unsubChange, unsubClose);
  }

  private bindSettingsEvents(): void {
    if (this.settingsService && typeof this.settingsService.subscribe === 'function') {
      const unsubSettings = this.settingsService.subscribe('lsp.inlayHints.*', (e) => {
        if (e.key === 'lsp.inlayHints.enabled' && e.currentValue === false) {
          this.clearHints();
        } else {
          // Re-request for all active document URIs
          for (const uri of this.activeHints.keys()) {
            this.requestInlayHints(uri, true);
          }
        }
      });
      this.unsubscribers.push(unsubSettings);
    }
  }

  public static getInstance(): LspInlayHintCoordinator {
    if (!LspInlayHintCoordinator.instance) {
      LspInlayHintCoordinator.instance = new LspInlayHintCoordinator();
    }
    return LspInlayHintCoordinator.instance;
  }

  public isEnabled(): boolean {
    const val = this.settingsService.get('lsp.inlayHints.enabled');
    return val !== false;
  }

  public getDebounceMs(): number {
    const val = this.settingsService.get<number>('lsp.inlayHints.requestDebounceMs');
    return typeof val === 'number' && val >= 0 ? val : 250;
  }

  public subscribe(listener: InlayHintListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getDecorations(uri: string): EditorInlayHintDecoration[] {
    return this.activeHints.get(uri) || [];
  }

  /**
   * Schedules or immediately dispatches an inlay hint request for a document.
   */
  public requestInlayHints(uri: string, immediate = false): void {
    if (this.isDisposed || !this.isEnabled()) return;

    const existingTimer = this.debounceTimers.get(uri);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.debounceTimers.delete(uri);
    }

    if (immediate) {
      this.executeRequest(uri);
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
   * Immediately clears cached hints and notifies subscribers.
   */
  public clearHints(uri?: string): void {
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

      this.activeHints.delete(uri);
      this.provider.clearCache(uri);
      this.notifyListeners({ type: 'hintsCleared', uri });
    } else {
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();

      for (const cts of this.cancellationTokens.values()) {
        cts.cancel();
      }
      this.cancellationTokens.clear();

      this.activeHints.clear();
      this.provider.clearCache();
      this.notifyListeners({ type: 'hintsCleared', uri: '' });
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
    this.clearHints();
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
      const result = await this.provider.requestInlayHints(uri, {}, cts.token);

      if (cts.token.isCancellationRequested || !result) {
        return;
      }

      // Ensure doc revision and workspace generation haven't changed
      const currentWorkspaceGen = this.workspaceEngine?.getGeneration ? this.workspaceEngine.getGeneration() : 0;
      if (currentWorkspaceGen !== requestWorkspaceGen) {
        Logger.debug('LspInlayHintCoordinator: Workspace switched during request, discarding', { uri });
        return;
      }

      const currentDoc = this.documentEngine.getByResource(uri);
      if (!currentDoc || currentDoc.contentRevision !== requestDocRevision) {
        Logger.debug('LspInlayHintCoordinator: Document revision changed during request', {
          uri,
          reqRev: requestDocRevision,
          currRev: currentDoc?.contentRevision,
        });
        return;
      }

      this.activeHints.set(uri, result.hints);

      this.notifyListeners({
        type: 'hintsUpdated',
        uri,
        decorations: result.hints,
      });
    } catch (err) {
      Logger.warn('LspInlayHintCoordinator: Failed to execute inlay hints request', err);
    } finally {
      if (this.cancellationTokens.get(uri) === cts) {
        this.cancellationTokens.delete(uri);
      }
    }
  }

  private notifyListeners(event: InlayHintEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        Logger.error('LspInlayHintCoordinator: Error in listener', err);
      }
    }
  }
}

export const globalInlayHintCoordinator = LspInlayHintCoordinator.getInstance();
