/**
 * QM Editor Canonical LSP Coordinator & Subsystem Orchestrator
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 *
 * Coordinates LSP Server Manager, Document Synchronization, Diagnostics Bridge,
 * and registers the LSP Provider Adapter into QM Editor's LanguageIntelligenceRegistry.
 */

import { LspServerManager, globalLspServerManager } from './LspServerManager';
import { LspServerRegistry, globalLspServerRegistry } from './LspServerRegistry';
import { LspDocumentSync, globalLspDocumentSync } from './LspDocumentSync';
import { LspDiagnosticsBridge, globalLspDiagnosticsBridge } from './LspDiagnosticsBridge';
import { LspProviderAdapter, globalLspProviderAdapter } from './LspProviderAdapter';
import { LspWorkspaceSymbolProvider } from './workspace-symbols/LspWorkspaceSymbolProvider';
import { globalSymbolEngine } from '../symbols/SymbolEngine';
import { LanguageIntelligenceRegistry } from '../language-intelligence/LanguageIntelligenceRegistry';
import { ServerSessionStatus } from './LspTypes';
import { logger } from '../../utils/logger';

export class LspCoordinator {
  private static instance: LspCoordinator | null = null;
  public readonly serverManager: LspServerManager;
  public readonly serverRegistry: LspServerRegistry;
  public readonly documentSync: LspDocumentSync;
  public readonly diagnosticsBridge: LspDiagnosticsBridge;
  public readonly providerAdapter: LspProviderAdapter;
  public readonly workspaceSymbolProvider: LspWorkspaceSymbolProvider;

  private unregisterProvider?: () => void;
  private unregisterWorkspaceSymbolProvider?: () => void;
  private isInitialized: boolean = false;
  private isDisposed: boolean = false;

  private constructor(
    serverManager: LspServerManager = globalLspServerManager,
    serverRegistry: LspServerRegistry = globalLspServerRegistry,
    documentSync: LspDocumentSync = globalLspDocumentSync,
    diagnosticsBridge: LspDiagnosticsBridge = globalLspDiagnosticsBridge,
    providerAdapter: LspProviderAdapter = globalLspProviderAdapter,
    workspaceSymbolProvider: LspWorkspaceSymbolProvider = new LspWorkspaceSymbolProvider()
  ) {
    this.serverManager = serverManager;
    this.serverRegistry = serverRegistry;
    this.documentSync = documentSync;
    this.diagnosticsBridge = diagnosticsBridge;
    this.providerAdapter = providerAdapter;
    this.workspaceSymbolProvider = workspaceSymbolProvider;
  }

  public static getInstance(): LspCoordinator {
    if (!LspCoordinator.instance) {
      LspCoordinator.instance = new LspCoordinator();
    }
    return LspCoordinator.instance;
  }

  /**
   * Initializes the LSP subsystem and registers the LSP provider into LanguageIntelligenceRegistry.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized || this.isDisposed) return;
    this.isInitialized = true;

    try {
      // Register LSP Provider into Language Intelligence Registry
      const intelligenceRegistry = LanguageIntelligenceRegistry.getInstance();
      this.unregisterProvider = intelligenceRegistry.registerProvider(this.providerAdapter);

      // Register LSP Workspace Symbol Provider into canonical SymbolEngine
      this.unregisterWorkspaceSymbolProvider = globalSymbolEngine.registerProvider(this.workspaceSymbolProvider);

      this.documentSync.setEnabled(true);
      logger.info('LspCoordinator: LSP subsystem initialized and provider registered');
    } catch (err) {
      logger.error('LspCoordinator: Error initializing LSP subsystem', {
        error: (err as Error).message,
      });
      throw err;
    }
  }

  /**
   * Returns a status overview for all active language server sessions.
   */
  public getStatusOverview(): ServerSessionStatus[] {
    return this.serverManager.getStatusOverview();
  }

  /**
   * Restarts an LSP server session by ID.
   */
  public async restartSession(sessionId: string): Promise<void> {
    await this.serverManager.restartSession(sessionId);
  }

  /**
   * Disposes the LSP subsystem, closing all sessions and unregistering providers.
   */
  public async dispose(): Promise<void> {
    if (this.isDisposed) return;
    this.isDisposed = true;

    this.unregisterProvider?.();
    this.unregisterWorkspaceSymbolProvider?.();
    this.workspaceSymbolProvider.dispose();
    this.documentSync.dispose();
    this.diagnosticsBridge.dispose();
    this.providerAdapter.dispose();
    await this.serverManager.dispose();

    this.isInitialized = false;
    logger.info('LspCoordinator: LSP subsystem disposed');
  }
}

export const globalLspCoordinator = LspCoordinator.getInstance();
