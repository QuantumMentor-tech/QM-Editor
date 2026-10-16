/**
 * QM Editor Canonical LSP Diagnostics Bridge
 * Phase 06, Step 57 — LSP Diagnostics Integration, Problems Synchronization & Diagnostic Lifecycle
 *
 * Central orchestrator connecting external language server diagnostics to QM Editor's
 * authoritative Diagnostics Engine. Manages per-server diagnostic collections, enforces
 * strict session and workspace generation fencing, performs deep validation, handles empty
 * publication clearing, and synchronizes with document and server lifecycles.
 */

import {
  PublishDiagnosticsParams,
  LspDiagnosticSessionContext,
} from './LspTypes';
import {
  Diagnostic,
  DiagnosticCollection,
} from '../diagnostics/DiagnosticTypes';
import { DiagnosticService, globalDiagnosticService } from '../diagnostics/DiagnosticService';
import { globalWorkspaceEngine } from '../workspace/WorkspaceEngine';
import { SettingsService } from '../settings/SettingsService';
import { LspUriMapper } from './LspUriMapper';
import { LspDiagnosticValidator } from './diagnostics/LspDiagnosticValidator';
import { LspDiagnosticMapper } from './diagnostics/LspDiagnosticMapper';
import { logger } from '../../utils/logger';

export class LspDiagnosticsBridge {
  private static instance: LspDiagnosticsBridge | null = null;
  private readonly diagnosticService: DiagnosticService;
  private readonly settingsService: SettingsService;
  private readonly collections = new Map<string, DiagnosticCollection>();
  private readonly sessionGenerations = new Map<string, number>();
  private isDisposed: boolean = false;

  private constructor(
    diagnosticService: DiagnosticService = globalDiagnosticService,
    settingsService: SettingsService = SettingsService.getInstance()
  ) {
    this.diagnosticService = diagnosticService;
    this.settingsService = settingsService;

    // Initialize default collection for backwards-compatibility / unscoped calls
    this.getOrCreateCollection('lsp', 'Language Server Protocol');
  }

  public static getInstance(): LspDiagnosticsBridge {
    if (!LspDiagnosticsBridge.instance) {
      LspDiagnosticsBridge.instance = new LspDiagnosticsBridge();
    }
    return LspDiagnosticsBridge.instance;
  }

  /**
   * Retrieves or creates an owner-scoped DiagnosticCollection for an LSP server.
   */
  public getOrCreateCollection(providerId: string, displayName?: string): DiagnosticCollection {
    let col = this.collections.get(providerId);
    if (!col) {
      // Register formal provider with DiagnosticService
      try {
        col = this.diagnosticService.registerProvider({
          providerId,
          displayName: displayName || (providerId === 'lsp' ? 'Language Server Protocol' : providerId),
          capabilities: {
            supportsDocumentDiagnostics: true,
            supportsResourceMarkers: true,
            supportsRelatedInformation: true,
            supportsCodes: true,
          },
          priority: 100,
        }) as DiagnosticCollection;
      } catch {
        // If provider already registered or registerProvider fails, fallback to createCollection
        col = this.diagnosticService.createCollection(providerId);
      }
      this.collections.set(providerId, col);
    }
    return col;
  }

  /**
   * Registers or updates the active generation for an LSP session.
   */
  public registerSession(sessionId: string, generation: number): void {
    this.sessionGenerations.set(sessionId, generation);
  }

  /**
   * Handles incoming publishDiagnostics notification payload from an LSP server.
   */
  public handlePublishDiagnostics(
    params: PublishDiagnosticsParams,
    sessionContext?: LspDiagnosticSessionContext
  ): void {
    if (this.isDisposed || !params) return;

    // 1. Check Settings: Is LSP diagnostics reporting enabled?
    if (!this.isDiagnosticsEnabled()) {
      logger.debug('LspDiagnosticsBridge: Dropped diagnostics publication (lsp.diagnostics.enabled is false)');
      return;
    }

    // 2. Validate Session Context & Generation Freshness
    if (sessionContext) {
      if (!LspDiagnosticValidator.isSessionValid(sessionContext)) {
        logger.warn('LspDiagnosticsBridge: Rejected diagnostics from inactive or disposed session', {
          sessionId: sessionContext.sessionId,
          state: sessionContext.sessionState,
        });
        return;
      }

      const activeGeneration = this.sessionGenerations.get(sessionContext.sessionId);
      if (typeof activeGeneration === 'number' && sessionContext.generation < activeGeneration) {
        logger.warn('LspDiagnosticsBridge: Rejected stale diagnostics from superseded session generation', {
          sessionId: sessionContext.sessionId,
          publishedGen: sessionContext.generation,
          activeGen: activeGeneration,
        });
        return;
      }

      // Check Workspace Isolation
      const activeWorkspaceId = globalWorkspaceEngine.getWorkspaceId();
      if (activeWorkspaceId && sessionContext.workspaceId && sessionContext.workspaceId !== activeWorkspaceId) {
        logger.warn('LspDiagnosticsBridge: Rejected diagnostics belonging to different workspace', {
          publishedWorkspace: sessionContext.workspaceId,
          activeWorkspace: activeWorkspaceId,
        });
        return;
      }
    }

    // 3. Deep Validation & Sanitization of Diagnostic Payload
    const maxPerDoc = this.getMaxDiagnosticsPerDocument();
    const validationResult = LspDiagnosticValidator.validatePayload(params, maxPerDoc);
    if (!validationResult.valid || !validationResult.sanitizedParams) {
      logger.error('LspDiagnosticsBridge: Dropped invalid publishDiagnostics payload', {
        error: validationResult.error,
        uri: (params as any)?.uri,
      });
      return;
    }

    const { sanitizedParams } = validationResult;
    const resourceUri = LspUriMapper.uriToPath(sanitizedParams.uri);

    // 4. Resolve Provider Collection
    const providerId = sessionContext
      ? `lsp:${sessionContext.serverDefinitionId}`
      : 'lsp';
    const collection = this.getOrCreateCollection(providerId, sessionContext?.displayName);

    // 5. Handle Empty Diagnostics Array -> Clear prior diagnostics for this file
    if (sanitizedParams.diagnostics.length === 0) {
      logger.debug(`LspDiagnosticsBridge: Clearing diagnostics for ${resourceUri} from provider ${providerId}`);
      collection.set(resourceUri, [], {
        generation: sessionContext?.generation,
        workspaceGeneration: globalWorkspaceEngine.getGeneration(),
      });
      return;
    }

    // 6. Convert to Canonical Diagnostic Models with Hint Filtering
    const showHints = this.showHints();
    const canonicalDiagnostics: Diagnostic[] = [];

    sanitizedParams.diagnostics.forEach((lspDiag, idx) => {
      // Filter out hints if setting disabled
      if (!showHints && lspDiag.severity === 4) {
        return;
      }

      const canonical = LspDiagnosticMapper.toCanonicalDiagnostic(
        lspDiag,
        resourceUri,
        idx,
        sessionContext,
        sanitizedParams.version
      );
      canonicalDiagnostics.push(canonical);
    });

    // 7. Publish into DiagnosticService Collection
    logger.debug(
      `LspDiagnosticsBridge: Publishing ${canonicalDiagnostics.length} diagnostics for ${resourceUri} (${providerId})`
    );

    collection.set(resourceUri, canonicalDiagnostics, {
      generation: sessionContext?.generation,
      workspaceGeneration: globalWorkspaceEngine.getGeneration(),
    });
  }

  /**
   * Clears all diagnostics published by a specific language server definition.
   */
  public clearForServer(serverDefinitionId: string): void {
    const providerId = `lsp:${serverDefinitionId}`;
    const col = this.collections.get(providerId);
    if (col) {
      col.clear();
      logger.info(`LspDiagnosticsBridge: Cleared all diagnostics for server ${serverDefinitionId}`);
    }
  }

  /**
   * Clears diagnostics for a given session.
   */
  public clearForSession(sessionId: string): void {
    this.sessionGenerations.delete(sessionId);
    if (sessionId.includes('::')) {
      const serverDefId = sessionId.split('::')[0];
      this.clearForServer(serverDefId);
    }
  }

  /**
   * Clears diagnostics for a specific resource across all or a specific LSP collection.
   */
  public clearForResource(uriOrPath: string, serverDefinitionId?: string): void {
    const resourceUri = LspUriMapper.uriToPath(uriOrPath);
    if (serverDefinitionId) {
      const providerId = `lsp:${serverDefinitionId}`;
      this.collections.get(providerId)?.delete(resourceUri);
    } else {
      for (const col of this.collections.values()) {
        col.delete(resourceUri);
      }
    }
  }

  /**
   * Clears all LSP diagnostics from all collections.
   */
  public clearAll(): void {
    for (const col of this.collections.values()) {
      col.clear();
    }
    this.sessionGenerations.clear();
  }

  /**
   * Gets aggregated LSP diagnostics for a specific resource.
   */
  public getDiagnosticsForResource(uriOrPath: string): Diagnostic[] {
    const resourceUri = LspUriMapper.uriToPath(uriOrPath);
    const results: Diagnostic[] = [];
    for (const col of this.collections.values()) {
      results.push(...col.get(resourceUri));
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // Settings Query Helpers
  // ---------------------------------------------------------------------------

  private isDiagnosticsEnabled(): boolean {
    try {
      const val = this.settingsService.get<boolean>('lsp.diagnostics.enabled');
      return typeof val === 'boolean' ? val : true;
    } catch {
      return true;
    }
  }

  private showHints(): boolean {
    try {
      const val = this.settingsService.get<boolean>('lsp.diagnostics.showHints');
      return typeof val === 'boolean' ? val : true;
    } catch {
      return true;
    }
  }

  private getMaxDiagnosticsPerDocument(): number {
    try {
      const val = this.settingsService.get<number>('lsp.diagnostics.maxPerDocument');
      return typeof val === 'number' && val > 0 ? val : 1000;
    } catch {
      return 1000;
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.clearAll();
    this.collections.clear();
  }
}

export const globalLspDiagnosticsBridge = LspDiagnosticsBridge.getInstance();
