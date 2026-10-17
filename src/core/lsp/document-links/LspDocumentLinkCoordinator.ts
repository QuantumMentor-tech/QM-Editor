/**
 * QM Editor - LSP Document Link Coordinator
 * Phase 06, Step 67 — LSP Document Links, Clickable Resource References & Safe URI Navigation
 * 
 * Orchestrates Document Link requests, debounce timing, document updates,
 * lazy resolution, security validation, and safe URI navigation.
 */

import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { SettingsService } from '../../settings/SettingsService';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { Logger } from '../../../utils/logger';
import { LspDocumentLinkProvider, globalDocumentLinkProvider } from './LspDocumentLinkProvider';
import {
  CanonicalDocumentLink,
  EditorDocumentLinkDecoration,
} from './LspDocumentLinkTypes';
import { CancellationTokenSource } from '../../symbols/CancellationToken';
import { LspDocumentLinkExtension } from './LspDocumentLinkExtension';
import { globalNavigationCoordinator, NavigationCoordinator } from '../../navigation/NavigationCoordinator';
import { globalFeedbackService, FeedbackService } from '../../feedback/FeedbackService';
import { LspDocumentLinkSecurityValidator } from './LspDocumentLinkSecurityValidator';
import { Location, Range } from '../../navigation/LocationTypes';

export type DocumentLinkEventType = 'linksUpdated' | 'linksCleared';

export interface DocumentLinkEvent {
  type: DocumentLinkEventType;
  uri: string;
  decorations?: EditorDocumentLinkDecoration[];
}

export type DocumentLinkListener = (event: DocumentLinkEvent) => void;

export class LspDocumentLinkCoordinator {
  private static instance: LspDocumentLinkCoordinator | null = null;
  private readonly listeners = new Set<DocumentLinkListener>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly activeDecorations = new Map<string, EditorDocumentLinkDecoration[]>();
  private readonly activeLinks = new Map<string, Map<string, CanonicalDocumentLink>>();
  private readonly docIdToUri = new Map<string, string>();
  private readonly cancellationTokens = new Map<string, CancellationTokenSource>();
  private readonly unsubscribers: Array<() => void> = [];
  private isDisposed = false;

  constructor(
    private readonly provider: LspDocumentLinkProvider = globalDocumentLinkProvider,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine,
    private readonly workspaceEngine: WorkspaceEngine = globalWorkspaceEngine,
    private readonly settingsService: SettingsService = SettingsService.getInstance(),
    private readonly navigationCoordinator: NavigationCoordinator = globalNavigationCoordinator,
    private readonly feedbackService: FeedbackService = globalFeedbackService
  ) {
    this.bindDocumentEvents();
    this.bindSettingsEvents();

    // Connect link click dispatcher
    LspDocumentLinkExtension.setLinkClickHandler((linkId: string) => {
      this.executeLink(linkId);
    });
  }

  public static getInstance(): LspDocumentLinkCoordinator {
    if (!LspDocumentLinkCoordinator.instance) {
      LspDocumentLinkCoordinator.instance = new LspDocumentLinkCoordinator();
    }
    return LspDocumentLinkCoordinator.instance;
  }

  private bindDocumentEvents(): void {
    const unsubOpen = this.documentEngine.on('document.opened', (e) => {
      const doc = this.documentEngine.getDocument(e.documentId);
      if (doc?.resourceUri) {
        this.docIdToUri.set(e.documentId, doc.resourceUri);
        this.requestDocumentLinks(doc.resourceUri, true);
      }
    });

    const unsubChange = this.documentEngine.on('document.changed', (e) => {
      const doc = this.documentEngine.getDocument(e.documentId);
      if (doc?.resourceUri) {
        this.docIdToUri.set(e.documentId, doc.resourceUri);
        this.requestDocumentLinks(doc.resourceUri, false);
      }
    });

    const unsubClose = this.documentEngine.on('document.closed', (e: any) => {
      const uri = e.uri || (e.documentId ? this.docIdToUri.get(e.documentId) : undefined);
      if (e.documentId) {
        this.docIdToUri.delete(e.documentId);
      }
      if (uri) {
        this.clearLinks(uri);
      }
    });

    this.unsubscribers.push(unsubOpen, unsubChange, unsubClose);
  }

  private bindSettingsEvents(): void {
    if (this.settingsService && typeof this.settingsService.subscribe === 'function') {
      const unsubSettings = this.settingsService.subscribe('lsp.documentLinks.*', (e) => {
        if (e.key === 'lsp.documentLinks.enabled' && e.currentValue === false) {
          this.clearLinks();
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

  public subscribe(listener: DocumentLinkListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getDecorations(uri: string): EditorDocumentLinkDecoration[] {
    return this.activeDecorations.get(uri) || [];
  }

  public requestDocumentLinks(uri: string, immediate = false): void {
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

    const debounceMs = this.settingsService.get('lsp.documentLinks.requestDebounceMs') ?? 250;
    const timer = setTimeout(() => {
      this.debounceTimers.delete(uri);
      this.executeRequest(uri);
    }, debounceMs);

    this.debounceTimers.set(uri, timer);
  }

  public clearLinks(uri?: string): void {
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
      this.activeDecorations.delete(uri);
      this.activeLinks.delete(uri);
      this.provider.clearCache(uri);
      this.notifyListeners({ type: 'linksCleared', uri });
    } else {
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();

      for (const cts of this.cancellationTokens.values()) {
        cts.cancel();
      }
      this.cancellationTokens.clear();

      this.activeDecorations.clear();
      this.activeLinks.clear();
      this.provider.clearCache();
      this.notifyListeners({ type: 'linksCleared', uri: '' });
    }
  }

  /**
   * Safely executes navigation for an activated Document Link.
   */
  public async executeLink(linkId: string): Promise<boolean> {
    if (this.isDisposed) return false;

    // 1. Locate the link across active documents
    let targetLink: CanonicalDocumentLink | undefined;
    let targetUri: string | undefined;

    for (const [uri, linkMap] of this.activeLinks.entries()) {
      if (linkMap.has(linkId)) {
        targetLink = linkMap.get(linkId);
        targetUri = uri;
        break;
      }
    }

    if (!targetLink || !targetUri) {
      Logger.warn('LspDocumentLinkCoordinator: Attempted to navigate unknown Document Link', { linkId });
      return false;
    }

    const docRecord = this.documentEngine.getByResource(targetUri);
    if (!docRecord) {
      Logger.warn('LspDocumentLinkCoordinator: Document not found for Document Link', { linkId, targetUri });
      return false;
    }

    // 2. Lazy resolution if target URI is not yet resolved
    if (!targetLink.isResolved || !targetLink.target) {
      try {
        targetLink = await this.provider.resolveDocumentLink(targetLink);
        this.activeLinks.get(targetUri)?.set(linkId, targetLink);
      } catch (err) {
        Logger.warn('LspDocumentLinkCoordinator: Failed to resolve Document Link prior to navigation', err);
        return false;
      }
    }

    const target = targetLink.target;
    if (!target) {
      Logger.debug('LspDocumentLinkCoordinator: Document Link has no target to navigate', { linkId });
      return false;
    }

    // 3. Central security validation
    const roots = this.workspaceEngine?.getRoots ? this.workspaceEngine.getRoots() : [];
    const rootUris = roots.map((r: any) => r.uri || r.path || String(r));
    const valRes = LspDocumentLinkSecurityValidator.classifyAndValidateUri(target, targetUri, rootUris);

    if (!valRes.isValid) {
      this.feedbackService.show({
        severity: 'warning',
        message: `Blocked unsafe link: ${valRes.reason ?? 'Security validation failed'}`,
      });
      Logger.warn('LspDocumentLinkCoordinator: Blocked unsafe link', {
        linkId,
        target,
        reason: valRes.reason,
      });
      return false;
    }

    const classification = valRes.classification;
    const safeTarget = valRes.normalizedUri || target;

    // 4. Handle same-document navigation
    if (classification === 'same-document') {
      const fragment = valRes.fragment || '';
      const range = this.parseFragmentRange(fragment, targetLink.range);
      const loc: Location = {
        uri: targetUri,
        range,
      };

      try {
        await this.navigationCoordinator.navigateToLocation(loc);
        return true;
      } catch (err) {
        Logger.error('LspDocumentLinkCoordinator: Failed same-document navigation', err);
        return false;
      }
    }

    // 5. Handle external web links
    if (classification === 'external-web') {
      const allowExternal = this.settingsService.get('lsp.documentLinks.externalLinks');
      if (allowExternal === false) {
        this.feedbackService.show({
          severity: 'info',
          message: 'External web links are disabled in settings.',
        });
        return false;
      }

      try {
        if (typeof window !== 'undefined' && window.open) {
          window.open(safeTarget, '_blank', 'noopener,noreferrer');
          return true;
        }
      } catch (err) {
        Logger.error('LspDocumentLinkCoordinator: Failed to open external web link', err);
        this.feedbackService.show({
          severity: 'warning',
          message: `Unable to open external link: ${safeTarget}`,
        });
        return false;
      }
      return false;
    }

    // 6. Handle local workspace or external local files
    if (classification === 'workspace-local' || classification === 'outside-workspace') {
      const range: Range = {
        startLine: 1,
        startColumn: 1,
        endLine: 1,
        endColumn: 1,
      };

      const loc: Location = {
        uri: safeTarget,
        range,
      };

      try {
        const res = await this.navigationCoordinator.navigateToLocation(loc);
        if (!res.success) {
          this.feedbackService.show({
            severity: 'warning',
            message: res.error || `Target resource not found: ${safeTarget}`,
          });
          return false;
        }
        return true;
      } catch (err) {
        Logger.error('LspDocumentLinkCoordinator: Failed file navigation', err);
        this.feedbackService.show({
          severity: 'warning',
          message: `Failed to open target resource: ${safeTarget}`,
        });
        return false;
      }
    }

    Logger.warn('LspDocumentLinkCoordinator: Unhandled link classification', { classification, target });
    return false;
  }

  public dispose(): void {
    this.isDisposed = true;
    LspDocumentLinkExtension.setLinkClickHandler(null);
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
    this.clearLinks();
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

    // Cancel prior in-flight request for this URI
    const prevCts = this.cancellationTokens.get(uri);
    if (prevCts) {
      prevCts.cancel();
    }

    const cts = new CancellationTokenSource();
    this.cancellationTokens.set(uri, cts);

    try {
      const result = await this.provider.requestDocumentLinks(uri, {}, cts.token);

      if (cts.token.isCancellationRequested || !result) {
        return;
      }

      // Check revision and workspace generation
      const currentWorkspaceGen = this.workspaceEngine?.getGeneration ? this.workspaceEngine.getGeneration() : 0;
      if (currentWorkspaceGen !== requestWorkspaceGen) {
        Logger.debug('LspDocumentLinkCoordinator: Workspace switched during request, discarding', { uri });
        return;
      }

      const currentDoc = this.documentEngine.getByResource(uri);
      if (!currentDoc || currentDoc.contentRevision !== requestDocRevision) {
        Logger.debug('LspDocumentLinkCoordinator: Document revision changed during request', {
          uri,
          reqRev: requestDocRevision,
          currRev: currentDoc?.contentRevision,
        });
        return;
      }

      this.activeDecorations.set(uri, result.decorations);

      const linkMap = new Map<string, CanonicalDocumentLink>();
      for (const link of result.links) {
        linkMap.set(link.id, link);
      }
      this.activeLinks.set(uri, linkMap);

      this.notifyListeners({
        type: 'linksUpdated',
        uri,
        decorations: result.decorations,
      });
    } catch (err) {
      Logger.warn('LspDocumentLinkCoordinator: Failed to execute document link request', err);
    } finally {
      if (this.cancellationTokens.get(uri) === cts) {
        this.cancellationTokens.delete(uri);
      }
    }
  }

  private refreshAllActiveDocuments(): void {
    const docs = this.documentEngine.getAllDocuments();
    for (const d of docs) {
      if (d.resourceUri) {
        this.requestDocumentLinks(d.resourceUri, true);
      }
    }
  }

  private parseFragmentRange(fragment: string, fallbackRange: Range | any): Range {
    // Check patterns like L15, L15,C5, or 15:5
    const matchLineCol = fragment.match(/^L?(\d+)(?:[;,:]C?(\d+))?$/i);
    if (matchLineCol) {
      const line = parseInt(matchLineCol[1], 10);
      const col = matchLineCol[2] ? parseInt(matchLineCol[2], 10) : 1;
      return {
        startLine: line,
        startColumn: col,
        endLine: line,
        endColumn: col,
      };
    }

    return {
      startLine: (fallbackRange.start?.line ?? 0) + 1,
      startColumn: (fallbackRange.start?.character ?? 0) + 1,
      endLine: (fallbackRange.end?.line ?? 0) + 1,
      endColumn: (fallbackRange.end?.character ?? 0) + 1,
    };
  }

  private notifyListeners(event: DocumentLinkEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        Logger.error('LspDocumentLinkCoordinator: Error in listener', err);
      }
    }
  }
}

export const globalDocumentLinkCoordinator = LspDocumentLinkCoordinator.getInstance();
