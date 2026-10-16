/**
 * QM Editor Canonical LSP Provider Adapter
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 *
 * Implements the existing Phase 04 `LanguageIntelligenceProvider` contract, integrating
 * LSP seamlessly behind the authoritative LanguageIntelligenceRegistry without altering
 * application-facing contracts.
 */

import {
  LanguageIntelligenceProvider,
  CompletionRequest,
  CompletionItem,
  HoverRequest,
  HoverResult,
  SignatureHelpRequest,
  SignatureHelpResult,
} from '../language-intelligence/LanguageIntelligenceTypes';
import { Location } from '../navigation/LocationTypes';
import { CancellationToken } from '../symbols/SymbolTypes';
import {
  LspNavigationProvider,
  globalLspNavigationProvider,
  LspNavigationRequest,
  LspReferenceRequest,
  ReferenceResult,
} from './navigation';
import { LspServerManager, globalLspServerManager } from './LspServerManager';
import { LspDiagnosticsBridge, globalLspDiagnosticsBridge } from './LspDiagnosticsBridge';
import { LspUriMapper } from './LspUriMapper';
import {
  LspCompletionMapper,
  LspCompletionValidator,
} from './completion';
import {
  LspContextValidator,
  LspContextMapper,
} from './context';
import {
  LspCompletionParams,
  LspCompletionResponse,
  LspCompletionTriggerKind,
  LspCompletionItem,
  LspHoverResponse,
  LspSignatureHelpResponse,
  LspSignatureHelpContext,
  LspSignatureHelpTriggerKind,
  LspPosition,
} from './LspTypes';
import { SettingsService } from '../settings/SettingsService';
import { logger } from '../../utils/logger';

export class LspProviderAdapter implements LanguageIntelligenceProvider {
  public readonly providerId = 'lsp.provider';
  public readonly displayName = 'Language Server Protocol Intelligence Provider';
  public readonly supportedLanguages = ['*'];
  public readonly priority = 100; // Takes precedence over built-in word completion fallback (priority 5)

  public readonly capabilities = {
    completion: {
      triggerCharacters: ['.', ':', '>', '@', '"', "'", '/', '<'],
      supportsResolveDetails: true,
      priority: 100,
    },
    hover: {
      priority: 100,
    },
    signatureHelp: {
      triggerCharacters: ['(', ','],
      retriggerCharacters: [',', ')'],
      priority: 100,
    },
    definition: true,
  };

  private readonly serverManager: LspServerManager;
  private readonly diagnosticsBridge: LspDiagnosticsBridge;
  private readonly settingsService: SettingsService;
  private readonly navigationProvider: LspNavigationProvider;
  private boundSessions = new Set<string>();

  constructor(
    serverManager: LspServerManager = globalLspServerManager,
    diagnosticsBridge: LspDiagnosticsBridge = globalLspDiagnosticsBridge,
    settingsService: SettingsService = SettingsService.getInstance(),
    navigationProvider: LspNavigationProvider = globalLspNavigationProvider
  ) {
    this.serverManager = serverManager;
    this.diagnosticsBridge = diagnosticsBridge;
    this.settingsService = settingsService;
    this.navigationProvider = navigationProvider;
  }

  // ---------------------------------------------------------------------------
  // 1. Completion Provider Implementation
  // ---------------------------------------------------------------------------

  public async provideCompletions(
    request: CompletionRequest,
    token?: CancellationToken
  ): Promise<CompletionItem[]> {
    if (token?.isCancellationRequested) return [];

    const isEnabled = this.isCompletionEnabled();
    const session = this.serverManager.getActiveSession(request.languageId, request.workspaceId);

    const validation = LspCompletionValidator.validateContext(request, session, isEnabled);
    if (!validation.valid || !session) {
      logger.debug('LspProviderAdapter: skipping completion', { reason: validation.error });
      return [];
    }

    this.ensureSessionNotifications(session);

    try {
      const lspUri = LspUriMapper.pathToUri(request.uri);
      const lspPosition = {
        line: Math.max(0, request.position.line - 1),
        character: Math.max(0, request.position.column - 1),
      };

      const triggerKind = this.mapTriggerKind(request.triggerKind, request.triggerCharacter);
      const params: LspCompletionParams = {
        textDocument: { uri: lspUri },
        position: lspPosition,
        context: {
          triggerKind,
          triggerCharacter: request.triggerCharacter,
        },
      };

      const maxItems = this.getMaxItems();
      const timeoutMs = this.getInteractiveTimeoutMs();

      const result = await session.getClient().sendRequest<LspCompletionResponse>(
        'textDocument/completion',
        params,
        {
          category: 'interactive',
          documentId: request.documentId,
          documentRevision: request.revision,
          workspaceId: request.workspaceId,
          cancellationToken: token,
          timeoutMs,
        }
      );

      if (!result) return [];

      const canonicalResult = LspCompletionMapper.toCanonicalCompletionResult(
        result,
        request,
        this.providerId,
        this.priority,
        maxItems
      );

      return canonicalResult.items;
    } catch (err) {
      logger.debug('LspProviderAdapter: Error during completion request', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  public async resolveCompletionItem(
    item: CompletionItem,
    token?: CancellationToken
  ): Promise<CompletionItem> {
    if (token?.isCancellationRequested) return item;
    if (!item.data || typeof item.data !== 'object') return item;

    const rawData = item.data as { rawItem?: LspCompletionItem };
    if (!rawData.rawItem) return item;

    const sessions = this.serverManager.getAllSessions();
    const readySession = sessions.find((s) => {
      const caps = s.getCapabilities();
      const state = s.getState();
      return (state === 'ready' || state === 'running') && caps?.completionProvider?.resolveProvider === true;
    });

    if (!readySession) {
      return item;
    }

    try {
      const resolved = await readySession.getClient().sendRequest<LspCompletionItem>(
        'completionItem/resolve',
        rawData.rawItem,
        {
          category: 'interactive',
          cancellationToken: token,
          timeoutMs: this.getInteractiveTimeoutMs(),
        }
      );

      if (!resolved) return item;

      const sanitizedDetail = typeof resolved.detail === 'string'
        ? resolved.detail.slice(0, LspCompletionValidator.MAX_DETAIL_LENGTH)
        : item.detail;

      const sanitizedDoc = LspCompletionValidator.sanitizeDocumentation(resolved.documentation) ?? item.documentation;

      return {
        ...item,
        detail: sanitizedDetail,
        documentation: sanitizedDoc,
      };
    } catch (err) {
      logger.debug('LspProviderAdapter: Error during completionItem/resolve', {
        error: (err as Error).message,
      });
      return item;
    }
  }

  private isCompletionEnabled(): boolean {
    try {
      const val = this.settingsService.get<boolean>('lsp.completion.enabled');
      return typeof val === 'boolean' ? val : true;
    } catch {
      return true;
    }
  }

  private getMaxItems(): number {
    try {
      const val = this.settingsService.get<number>('lsp.completion.maxItems');
      return typeof val === 'number' && val > 0 ? val : 500;
    } catch {
      return 500;
    }
  }

  private getInteractiveTimeoutMs(): number {
    try {
      const val = this.settingsService.get<number>('lsp.interactiveTimeoutMs');
      return typeof val === 'number' && val > 0 ? val : 5000;
    } catch {
      return 5000;
    }
  }

  private mapTriggerKind(
    kind: string,
    triggerChar?: string
  ): LspCompletionTriggerKind {
    if (kind === 'triggerCharacter' || (triggerChar && triggerChar.length > 0)) {
      return 2; // TriggerCharacter
    }
    return 1; // Invoked
  }

  private isHoverEnabled(): boolean {
    try {
      const val = this.settingsService.get<boolean>('lsp.hover.enabled');
      return typeof val === 'boolean' ? val : true;
    } catch {
      return true;
    }
  }

  private isSignatureHelpEnabled(): boolean {
    try {
      const val = this.settingsService.get<boolean>('lsp.signatureHelp.enabled');
      return typeof val === 'boolean' ? val : true;
    } catch {
      return true;
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Hover Provider Implementation
  // ---------------------------------------------------------------------------

  public async provideHover(
    request: HoverRequest,
    token?: CancellationToken
  ): Promise<HoverResult | null> {
    if (!this.isHoverEnabled()) return null;
    if (token?.isCancellationRequested) return null;

    const session = this.serverManager.getActiveSession(request.languageId, request.workspaceId);
    if (!session) {
      return null;
    }

    const state = session.getState();
    if (state !== 'ready' && state !== 'running') {
      return null;
    }

    const caps = session.getCapabilities();
    if (!caps?.hoverProvider) {
      return null;
    }

    this.ensureSessionNotifications(session);

    try {
      const lspUri = LspUriMapper.pathToUri(request.uri);
      const lspPosition: LspPosition = {
        line: Math.max(0, request.position.line - 1),
        character: Math.max(0, request.position.column - 1),
      };

      const rawResult = await session.getClient().sendRequest<LspHoverResponse>(
        'textDocument/hover',
        {
          textDocument: { uri: lspUri },
          position: lspPosition,
        },
        {
          category: 'interactive',
          documentId: request.documentId,
          documentRevision: request.revision,
          cancellationToken: token,
          timeoutMs: this.getInteractiveTimeoutMs(),
        }
      );

      if (token?.isCancellationRequested) return null;

      const validated = LspContextValidator.validateHoverResponse(rawResult);
      if (!validated) return null;

      return LspContextMapper.mapLspHover(validated, request, this.providerId);
    } catch (err) {
      logger.debug('LspProviderAdapter: Error during hover request', {
        error: (err as Error).message,
      });
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Signature Help Provider Implementation
  // ---------------------------------------------------------------------------

  public async provideSignatureHelp(
    request: SignatureHelpRequest,
    token?: CancellationToken
  ): Promise<SignatureHelpResult | null> {
    if (!this.isSignatureHelpEnabled()) return null;
    if (token?.isCancellationRequested) return null;

    const session = this.serverManager.getActiveSession(request.languageId, request.workspaceId);
    if (!session) {
      return null;
    }

    const state = session.getState();
    if (state !== 'ready' && state !== 'running') {
      return null;
    }

    const caps = session.getCapabilities();
    if (!caps?.signatureHelpProvider) {
      return null;
    }

    this.ensureSessionNotifications(session);

    try {
      const lspUri = LspUriMapper.pathToUri(request.uri);
      const lspPosition: LspPosition = {
        line: Math.max(0, request.position.line - 1),
        character: Math.max(0, request.position.column - 1),
      };

      let triggerKind: LspSignatureHelpTriggerKind = 1; // Invoked
      if (request.triggerKind === 'triggerCharacter') {
        triggerKind = 2;
      } else if (request.triggerKind === 'retrigger' || request.isRetrigger) {
        triggerKind = 3;
      }

      const context: LspSignatureHelpContext = {
        triggerKind,
        triggerCharacter: request.triggerCharacter,
        isRetrigger: Boolean(request.isRetrigger || request.triggerKind === 'retrigger'),
      };

      const rawResult = await session.getClient().sendRequest<LspSignatureHelpResponse>(
        'textDocument/signatureHelp',
        {
          textDocument: { uri: lspUri },
          position: lspPosition,
          context,
        },
        {
          category: 'interactive',
          documentId: request.documentId,
          documentRevision: request.revision,
          cancellationToken: token,
          timeoutMs: this.getInteractiveTimeoutMs(),
        }
      );

      if (token?.isCancellationRequested) return null;

      const validated = LspContextValidator.validateSignatureHelpResponse(rawResult);
      if (!validated) return null;

      return LspContextMapper.mapLspSignatureHelp(validated, request, this.providerId);
    } catch (err) {
      logger.debug('LspProviderAdapter: Error during signatureHelp request', {
        error: (err as Error).message,
      });
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Code Navigation Provider Implementations
  // ---------------------------------------------------------------------------

  public async provideDefinition(
    request: LspNavigationRequest,
    token?: CancellationToken
  ): Promise<Location[]> {
    return this.navigationProvider.provideDefinition(request, token);
  }

  public async provideDeclaration(
    request: LspNavigationRequest,
    token?: CancellationToken
  ): Promise<Location[]> {
    return this.navigationProvider.provideDeclaration(request, token);
  }

  public async provideTypeDefinition(
    request: LspNavigationRequest,
    token?: CancellationToken
  ): Promise<Location[]> {
    return this.navigationProvider.provideTypeDefinition(request, token);
  }

  public async provideReferences(
    request: LspReferenceRequest,
    token?: CancellationToken
  ): Promise<ReferenceResult | null> {
    return this.navigationProvider.provideReferences(request, token);
  }

  // ---------------------------------------------------------------------------
  // 5. Session Notification Binding
  // ---------------------------------------------------------------------------

  private ensureSessionNotifications(session: any): void {
    if (this.boundSessions.has(session.sessionId)) return;
    this.boundSessions.add(session.sessionId);

    session.getClient().onNotification('textDocument/publishDiagnostics', (params: any) => {
      this.diagnosticsBridge.handlePublishDiagnostics(params);
    });
  }

  public dispose(): void {
    this.boundSessions.clear();
  }
}

export const globalLspProviderAdapter = new LspProviderAdapter();
