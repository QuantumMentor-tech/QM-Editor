/**
 * QM Editor LSP Navigation Provider
 * Phase 06, Step 60 — LSP Code Navigation, Definitions, Declarations, Type Definitions & References
 *
 * Implements the language-server navigation bridge behind the existing NavigationCoordinator.
 * Exposes canonical application operations (definition, declaration, typeDefinition, references)
 * without leaking LSP protocol specifics to outside callers.
 */

import { Location } from '../../navigation/LocationTypes';
import { CancellationToken } from '../../symbols/SymbolTypes';
import { LspServerManager, globalLspServerManager } from '../LspServerManager';
import { LspUriMapper } from '../LspUriMapper';
import {
  LspNavigationRequest,
  LspReferenceRequest,
  ReferenceResult,
} from './LspNavigationTypes';
import { LspLocationValidator } from './LspLocationValidator';
import { LspLocationMapper } from './LspLocationMapper';
import {
  LspPosition,
  LspDefinitionResponse,
  LspDeclarationResponse,
  LspTypeDefinitionResponse,
  LspReferencesResponse,
  LspReferenceParams,
} from '../LspTypes';
import { SettingsService } from '../../settings/SettingsService';
import { logger } from '../../../utils/logger';

export class LspNavigationProvider {
  public readonly providerId = 'lsp.navigation';
  public readonly displayName = 'LSP Code Navigation Provider';

  constructor(
    private readonly serverManager: LspServerManager = globalLspServerManager,
    private readonly settingsService: SettingsService = SettingsService.getInstance()
  ) {}

  // ---------------------------------------------------------------------------
  // 1. Settings & Capability Helpers
  // ---------------------------------------------------------------------------

  public isNavigationEnabled(): boolean {
    const val = this.settingsService.get('lsp.navigation.enabled');
    return val !== false;
  }

  public getInteractiveTimeoutMs(): number {
    const val = this.settingsService.get<number>('lsp.interactiveTimeoutMs');
    return typeof val === 'number' && val > 0 ? val : 3000;
  }

  // ---------------------------------------------------------------------------
  // 2. Go to Definition
  // ---------------------------------------------------------------------------

  public async provideDefinition(
    request: LspNavigationRequest,
    token?: CancellationToken
  ): Promise<Location[]> {
    if (token?.isCancellationRequested) return [];

    const isEnabled = this.isNavigationEnabled();
    const session = this.serverManager.getActiveSession(request.languageId, request.workspaceId);

    const validation = LspLocationValidator.validateRequestContext(request, session, isEnabled);
    if (!validation.valid || !session) {
      logger.debug('LspNavigationProvider: skipping definition', { reason: validation.error });
      return [];
    }

    const caps = session.getCapabilities();
    if (!caps || !caps.definitionProvider) {
      logger.debug('LspNavigationProvider: server lacks definitionProvider capability');
      return [];
    }

    try {
      const lspUri = LspUriMapper.pathToUri(request.uri);
      const lspPosition: LspPosition = {
        line: Math.max(0, request.position.line - 1),
        character: Math.max(0, request.position.column - 1),
      };

      const rawResult = await session.getClient().sendRequest<LspDefinitionResponse>(
        'textDocument/definition',
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

      if (token?.isCancellationRequested) return [];

      const validItems = LspLocationValidator.validateNavigationResponse(rawResult);
      return LspLocationMapper.mapToCanonicalLocations(validItems);
    } catch (err) {
      logger.debug('LspNavigationProvider: Error during definition request', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Go to Declaration
  // ---------------------------------------------------------------------------

  public async provideDeclaration(
    request: LspNavigationRequest,
    token?: CancellationToken
  ): Promise<Location[]> {
    if (token?.isCancellationRequested) return [];

    const isEnabled = this.isNavigationEnabled();
    const session = this.serverManager.getActiveSession(request.languageId, request.workspaceId);

    const validation = LspLocationValidator.validateRequestContext(request, session, isEnabled);
    if (!validation.valid || !session) {
      logger.debug('LspNavigationProvider: skipping declaration', { reason: validation.error });
      return [];
    }

    const caps = session.getCapabilities();
    if (!caps || !caps.declarationProvider) {
      logger.debug('LspNavigationProvider: server lacks declarationProvider capability');
      return [];
    }

    try {
      const lspUri = LspUriMapper.pathToUri(request.uri);
      const lspPosition: LspPosition = {
        line: Math.max(0, request.position.line - 1),
        character: Math.max(0, request.position.column - 1),
      };

      const rawResult = await session.getClient().sendRequest<LspDeclarationResponse>(
        'textDocument/declaration',
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

      if (token?.isCancellationRequested) return [];

      const validItems = LspLocationValidator.validateNavigationResponse(rawResult);
      return LspLocationMapper.mapToCanonicalLocations(validItems);
    } catch (err) {
      logger.debug('LspNavigationProvider: Error during declaration request', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Go to Type Definition
  // ---------------------------------------------------------------------------

  public async provideTypeDefinition(
    request: LspNavigationRequest,
    token?: CancellationToken
  ): Promise<Location[]> {
    if (token?.isCancellationRequested) return [];

    const isEnabled = this.isNavigationEnabled();
    const session = this.serverManager.getActiveSession(request.languageId, request.workspaceId);

    const validation = LspLocationValidator.validateRequestContext(request, session, isEnabled);
    if (!validation.valid || !session) {
      logger.debug('LspNavigationProvider: skipping typeDefinition', { reason: validation.error });
      return [];
    }

    const caps = session.getCapabilities();
    if (!caps || !caps.typeDefinitionProvider) {
      logger.debug('LspNavigationProvider: server lacks typeDefinitionProvider capability');
      return [];
    }

    try {
      const lspUri = LspUriMapper.pathToUri(request.uri);
      const lspPosition: LspPosition = {
        line: Math.max(0, request.position.line - 1),
        character: Math.max(0, request.position.column - 1),
      };

      const rawResult = await session.getClient().sendRequest<LspTypeDefinitionResponse>(
        'textDocument/typeDefinition',
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

      if (token?.isCancellationRequested) return [];

      const validItems = LspLocationValidator.validateNavigationResponse(rawResult);
      return LspLocationMapper.mapToCanonicalLocations(validItems);
    } catch (err) {
      logger.debug('LspNavigationProvider: Error during typeDefinition request', {
        error: (err as Error).message,
      });
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Find References
  // ---------------------------------------------------------------------------

  public async provideReferences(
    request: LspReferenceRequest,
    token?: CancellationToken
  ): Promise<ReferenceResult | null> {
    if (token?.isCancellationRequested) return null;

    const startTime = Date.now();
    const isEnabled = this.isNavigationEnabled();
    const session = this.serverManager.getActiveSession(request.languageId, request.workspaceId);

    const validation = LspLocationValidator.validateRequestContext(request, session, isEnabled);
    if (!validation.valid || !session) {
      logger.debug('LspNavigationProvider: skipping references', { reason: validation.error });
      return null;
    }

    const caps = session.getCapabilities();
    if (!caps || !caps.referencesProvider) {
      logger.debug('LspNavigationProvider: server lacks referencesProvider capability');
      return null;
    }

    try {
      const lspUri = LspUriMapper.pathToUri(request.uri);
      const lspPosition: LspPosition = {
        line: Math.max(0, request.position.line - 1),
        character: Math.max(0, request.position.column - 1),
      };

      const params: LspReferenceParams = {
        textDocument: { uri: lspUri },
        position: lspPosition,
        context: {
          includeDeclaration: request.includeDeclaration ?? true,
        },
      };

      const rawResult = await session.getClient().sendRequest<LspReferencesResponse>(
        'textDocument/references',
        params,
        {
          category: 'interactive',
          documentId: request.documentId,
          documentRevision: request.revision,
          cancellationToken: token,
          timeoutMs: this.getInteractiveTimeoutMs() * 2, // Allow extra time for cross-file references
        }
      );

      if (token?.isCancellationRequested) {
        return LspLocationMapper.buildReferenceResult(request.requestId, [], Date.now() - startTime, true);
      }

      const validItems = LspLocationValidator.validateNavigationResponse(rawResult);
      const canonicalLocations = LspLocationMapper.mapToCanonicalLocations(validItems);

      return LspLocationMapper.buildReferenceResult(
        request.requestId,
        canonicalLocations,
        Date.now() - startTime,
        false
      );
    } catch (err) {
      logger.debug('LspNavigationProvider: Error during references request', {
        error: (err as Error).message,
      });
      return null;
    }
  }
}

export const globalLspNavigationProvider = new LspNavigationProvider();
