/**
 * QM Editor - LSP Code Lens Coordinator
 * Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration
 * 
 * Orchestrates Code Lens requests, debounce timing, document updates,
 * lazy resolution, security validation, and safe command execution.
 */

import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { SettingsService } from '../../settings/SettingsService';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { Logger } from '../../../utils/logger';
import { LspCodeLensProvider, globalCodeLensProvider } from './LspCodeLensProvider';
import {
  CanonicalCodeLens,
  EditorCodeLensLine,
} from './LspCodeLensTypes';
import { CancellationTokenSource } from '../../symbols/CancellationToken';
import { CodeLensWidget } from './LspCodeLensWidget';
import { globalCommandRegistry, CommandRegistry } from '../../commands/CommandRegistry';
import { CommandContext } from '../../commands/CommandTypes';
import { globalLspNavigationCoordinator, LspNavigationCoordinator } from '../navigation/LspNavigationCoordinator';
import { globalFeedbackService, FeedbackService } from '../../feedback/FeedbackService';
import { LspCodeLensSecurityValidator } from './LspCodeLensSecurityValidator';

export type CodeLensEventType = 'lensesUpdated' | 'lensesCleared';

export interface CodeLensEvent {
  type: CodeLensEventType;
  uri: string;
  lines?: EditorCodeLensLine[];
}

export type CodeLensListener = (event: CodeLensEvent) => void;

export class LspCodeLensCoordinator {
  private static instance: LspCodeLensCoordinator | null = null;
  private readonly listeners = new Set<CodeLensListener>();
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly activeLines = new Map<string, EditorCodeLensLine[]>();
  private readonly activeLenses = new Map<string, Map<string, CanonicalCodeLens>>();
  private readonly docIdToUri = new Map<string, string>();
  private readonly cancellationTokens = new Map<string, CancellationTokenSource>();
  private readonly unsubscribers: Array<() => void> = [];
  private isDisposed = false;

  constructor(
    private readonly provider: LspCodeLensProvider = globalCodeLensProvider,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine,
    private readonly workspaceEngine: WorkspaceEngine = globalWorkspaceEngine,
    private readonly settingsService: SettingsService = SettingsService.getInstance(),
    private readonly commandRegistry: CommandRegistry = globalCommandRegistry,
    private readonly navigationCoordinator: LspNavigationCoordinator = globalLspNavigationCoordinator,
    private readonly feedbackService: FeedbackService = globalFeedbackService
  ) {
    this.bindDocumentEvents();
    this.bindSettingsEvents();

    // Connect CodeLensWidget click dispatcher
    CodeLensWidget.setActionClickHandler((lensId: string) => {
      this.executeLens(lensId);
    });
  }

  private bindDocumentEvents(): void {
    const unsubOpen = this.documentEngine.on('document.opened', (e) => {
      const doc = this.documentEngine.getDocument(e.documentId);
      if (doc?.resourceUri) {
        this.docIdToUri.set(e.documentId, doc.resourceUri);
        this.requestCodeLenses(doc.resourceUri, true);
      }
    });

    const unsubChange = this.documentEngine.on('document.changed', (e) => {
      const doc = this.documentEngine.getDocument(e.documentId);
      if (doc?.resourceUri) {
        this.docIdToUri.set(e.documentId, doc.resourceUri);
        this.requestCodeLenses(doc.resourceUri, false);
      }
    });

    const unsubClose = this.documentEngine.on('document.closed', (e: any) => {
      const uri = e.uri || (e.documentId ? this.docIdToUri.get(e.documentId) : undefined);
      if (e.documentId) {
        this.docIdToUri.delete(e.documentId);
      }
      if (uri) {
        this.clearLenses(uri);
      }
    });

    this.unsubscribers.push(unsubOpen, unsubChange, unsubClose);
  }

  private bindSettingsEvents(): void {
    if (this.settingsService && typeof this.settingsService.subscribe === 'function') {
      const unsubSettings = this.settingsService.subscribe('lsp.codeLens.*', (e) => {
        if (e.key === 'lsp.codeLens.enabled' && e.currentValue === false) {
          this.clearLenses();
        } else {
          // Re-request for all active document URIs
          for (const uri of this.activeLines.keys()) {
            this.requestCodeLenses(uri, true);
          }
        }
      });
      this.unsubscribers.push(unsubSettings);
    }
  }

  public static getInstance(): LspCodeLensCoordinator {
    if (!LspCodeLensCoordinator.instance) {
      LspCodeLensCoordinator.instance = new LspCodeLensCoordinator();
    }
    return LspCodeLensCoordinator.instance;
  }

  public isEnabled(): boolean {
    const val = this.settingsService.get('lsp.codeLens.enabled');
    return val !== false;
  }

  public getDebounceMs(): number {
    const val = this.settingsService.get<number>('lsp.codeLens.requestDebounceMs');
    return typeof val === 'number' && val >= 0 ? val : 250;
  }

  public subscribe(listener: CodeLensListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getLines(uri: string): EditorCodeLensLine[] {
    return this.activeLines.get(uri) || [];
  }

  public getLens(uri: string, lensId: string): CanonicalCodeLens | undefined {
    return this.activeLenses.get(uri)?.get(lensId);
  }

  /**
   * Schedules or immediately dispatches a Code Lens request for a document.
   */
  public requestCodeLenses(uri: string, immediate = false): void {
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
   * Immediately clears cached lenses and notifies subscribers.
   */
  public clearLenses(uri?: string): void {
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

      this.activeLines.delete(uri);
      this.activeLenses.delete(uri);
      this.provider.clearCache(uri);
      this.notifyListeners({ type: 'lensesCleared', uri });
    } else {
      for (const timer of this.debounceTimers.values()) {
        clearTimeout(timer);
      }
      this.debounceTimers.clear();

      for (const cts of this.cancellationTokens.values()) {
        cts.cancel();
      }
      this.cancellationTokens.clear();

      this.activeLines.clear();
      this.activeLenses.clear();
      this.provider.clearCache();
      this.notifyListeners({ type: 'lensesCleared', uri: '' });
    }
  }

  /**
   * Safely executes an action triggered from an inline Code Lens.
   */
  public async executeLens(lensId: string): Promise<boolean> {
    if (this.isDisposed) return false;

    // Search active lenses across all documents
    let targetLens: CanonicalCodeLens | undefined;
    let targetUri: string | undefined;

    for (const [uri, lensMap] of this.activeLenses.entries()) {
      if (lensMap.has(lensId)) {
        targetLens = lensMap.get(lensId);
        targetUri = uri;
        break;
      }
    }

    if (!targetLens || !targetUri) {
      Logger.warn('LspCodeLensCoordinator: Attempted to execute unknown Code Lens', { lensId });
      return false;
    }

    const docRecord = this.documentEngine.getByResource(targetUri);
    if (!docRecord) {
      Logger.warn('LspCodeLensCoordinator: Document not found for Code Lens', { lensId, targetUri });
      return false;
    }

    // Lazy resolve if command is not yet resolved
    if (!targetLens.isResolved || !targetLens.command) {
      try {
        targetLens = await this.provider.resolveLens(targetLens);
        this.activeLenses.get(targetUri)?.set(lensId, targetLens);
      } catch (err) {
        Logger.warn('LspCodeLensCoordinator: Failed to resolve Code Lens prior to execution', err);
        return false;
      }
    }

    const command = targetLens.command;
    if (!command) {
      Logger.debug('LspCodeLensCoordinator: Code Lens has no command to execute', { lensId });
      return false;
    }

    // Security validation check
    const validation = LspCodeLensSecurityValidator.validateCommand(command, this.commandRegistry);
    if (!validation.isValid || !validation.sanitizedCommand) {
      this.feedbackService.show({
        severity: 'warning',
        message: `Blocked untrusted Code Lens command: ${validation.reason ?? 'Security validation failed'}`,
      });
      Logger.warn('LspCodeLensCoordinator: Blocked untrusted Code Lens command', {
        lensId,
        command: command.command,
        reason: validation.reason,
      });
      return false;
    }

    const safeCmd = validation.sanitizedCommand;

    // Special handling for standard reference navigation commands
    if (
      safeCmd.command === 'editor.showReferences' ||
      safeCmd.command === 'editor.action.showReferences'
    ) {
      const pos = {
        line: targetLens.range.start.line + 1,
        column: targetLens.range.start.character + 1,
      };

      try {
        await this.navigationCoordinator.findReferences(
          docRecord.id,
          pos,
          targetUri,
          docRecord.languageId,
          docRecord.contentRevision,
          docRecord.workspaceId
        );
        return true;
      } catch (err) {
        Logger.error('LspCodeLensCoordinator: Error running references navigation', err);
        return false;
      }
    }

    // Standard command execution via CommandRegistry
    if (this.commandRegistry.get(safeCmd.command)) {
      const ctx: CommandContext = {
        activeDoc: docRecord as any,
        shellState: {} as any,
        workspaceActions: {
          saveDoc: () => {},
          createDoc: () => {},
          closeDoc: () => {},
          activateDoc: () => {},
        },
        shellActions: {
          toggleSidebar: () => {},
          togglePanel: () => {},
          toggleTheme: () => {},
        },
        contextualTarget: safeCmd.arguments,
      };

      try {
        await this.commandRegistry.execute(safeCmd.command, ctx);
        return true;
      } catch (err) {
        Logger.error('LspCodeLensCoordinator: Error executing registered command', err);
        return false;
      }
    }

    Logger.warn('LspCodeLensCoordinator: Command not found in CommandRegistry', { command: safeCmd.command });
    return false;
  }

  public dispose(): void {
    this.isDisposed = true;
    CodeLensWidget.setActionClickHandler(null);
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
    this.clearLenses();
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
      const result = await this.provider.requestCodeLenses(uri, {}, cts.token);

      if (cts.token.isCancellationRequested || !result) {
        return;
      }

      // Ensure doc revision and workspace generation haven't changed
      const currentWorkspaceGen = this.workspaceEngine?.getGeneration ? this.workspaceEngine.getGeneration() : 0;
      if (currentWorkspaceGen !== requestWorkspaceGen) {
        Logger.debug('LspCodeLensCoordinator: Workspace switched during request, discarding', { uri });
        return;
      }

      const currentDoc = this.documentEngine.getByResource(uri);
      if (!currentDoc || currentDoc.contentRevision !== requestDocRevision) {
        Logger.debug('LspCodeLensCoordinator: Document revision changed during request', {
          uri,
          reqRev: requestDocRevision,
          currRev: currentDoc?.contentRevision,
        });
        return;
      }

      this.activeLines.set(uri, result.lines);

      const lensMap = new Map<string, CanonicalCodeLens>();
      for (const lens of result.lenses) {
        lensMap.set(lens.id, lens);
      }
      this.activeLenses.set(uri, lensMap);

      this.notifyListeners({
        type: 'lensesUpdated',
        uri,
        lines: result.lines,
      });
    } catch (err) {
      Logger.warn('LspCodeLensCoordinator: Failed to execute code lens request', err);
    } finally {
      if (this.cancellationTokens.get(uri) === cts) {
        this.cancellationTokens.delete(uri);
      }
    }
  }

  private notifyListeners(event: CodeLensEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        Logger.error('LspCodeLensCoordinator: Error in listener', err);
      }
    }
  }
}

export const globalCodeLensCoordinator = LspCodeLensCoordinator.getInstance();
