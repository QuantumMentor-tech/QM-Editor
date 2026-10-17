/**
 * QM Editor — LSP Call Hierarchy Provider
 * Phase 06, Step 70 — LSP Call Hierarchy, Callers, Callees & Safe Cross-File Code Relationship Navigation
 *
 * Communicates with language servers via:
 * - textDocument/prepareCallHierarchy
 * - callHierarchy/incomingCalls
 * - callHierarchy/outgoingCalls
 *
 * Enforces capability negotiation, stale response protection, and defensive validation.
 */

import { Logger } from '../../../utils/logger';
import { LspServerManager, globalLspServerManager } from '../LspServerManager';
import { SettingsService } from '../../settings/SettingsService';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { LspUriMapper } from '../LspUriMapper';
import { CancellationToken } from '../../symbols/SymbolTypes';
import {
  LspCallHierarchyIncomingCallsResponse,
  LspCallHierarchyOutgoingCallsResponse,
  LspCallHierarchyPrepareParams,
  LspCallHierarchyPrepareResponse,
  LspPosition,
} from '../LspTypes';
import {
  CallHierarchyCapabilityState,
  QmCallHierarchyItem,
  QmIncomingCall,
  QmOutgoingCall,
} from './LspCallHierarchyTypes';
import { LspCallHierarchyValidator } from './LspCallHierarchyValidator';
import { LspCallHierarchyMapper } from './LspCallHierarchyMapper';

export class LspCallHierarchyProvider {
  private static instance: LspCallHierarchyProvider | null = null;
  private readonly inFlightRequests = new Map<string, string>(); // key -> requestId
  private isDisposed = false;

  constructor(
    private readonly serverManager: LspServerManager = globalLspServerManager,
    private readonly settingsService: SettingsService = SettingsService.getInstance(),
    private readonly workspaceEngine: WorkspaceEngine = globalWorkspaceEngine,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine
  ) {}

  public static getInstance(): LspCallHierarchyProvider {
    if (!LspCallHierarchyProvider.instance) {
      LspCallHierarchyProvider.instance = new LspCallHierarchyProvider();
    }
    return LspCallHierarchyProvider.instance;
  }

  public isEnabled(): boolean {
    const lspVal = this.settingsService.get('lsp.callHierarchy.enabled');
    return lspVal !== false;
  }

  public getMaxDepth(): number {
    const setting = this.settingsService.get('editor.callHierarchy.maxDepth');
    return typeof setting === 'number' && setting > 0 ? setting : 20;
  }

  public dispose(): void {
    this.isDisposed = true;
    this.inFlightRequests.clear();
  }

  /**
   * Evaluates whether call hierarchy is supported for the given language and workspace.
   */
  public getCapabilityState(languageId: string, workspaceId: string): CallHierarchyCapabilityState {
    const session = this.serverManager.getActiveSession(languageId, workspaceId);
    if (!session || (session.getState() !== 'ready' && session.getState() !== 'running')) {
      return { supported: false, generation: 0 };
    }

    const caps = session.getCapabilities();
    const supported = Boolean(caps?.callHierarchyProvider);

    return {
      supported,
      sessionId: session.sessionId,
      workspaceId: session.workspaceId,
      languageId,
      generation: session.getSessionGeneration(),
    };
  }

  /**
   * Prepares a Call Hierarchy root at the given document URI and cursor position.
   */
  public async prepareCallHierarchy(
    documentUri: string,
    position: LspPosition,
    token?: CancellationToken
  ): Promise<QmCallHierarchyItem[] | null> {
    if (this.isDisposed || !this.isEnabled() || token?.isCancellationRequested) {
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
    if (!caps?.callHierarchyProvider) {
      return null;
    }

    const initialRevision = doc.contentRevision;
    const initialGeneration = session.getSessionGeneration();
    const requestId = `call_prep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.inFlightRequests.set(documentUri, requestId);

    const client = session.getClient();
    const lspUri = LspUriMapper.pathToUri(documentUri);

    const params: LspCallHierarchyPrepareParams = {
      textDocument: { uri: lspUri },
      position,
    };

    try {
      if (token?.isCancellationRequested) {
        return null;
      }

      const response = await client.sendRequest<LspCallHierarchyPrepareResponse>(
        'textDocument/prepareCallHierarchy',
        params,
        {
          category: 'interactive',
          cancellationToken: token,
          timeoutMs: 5000,
        }
      );

      // Stale check 1: Superseded
      if (this.inFlightRequests.get(documentUri) !== requestId) {
        return null;
      }

      // Stale check 2: Cancellation
      if (token?.isCancellationRequested) {
        return null;
      }

      // Stale check 3: Document revision
      const currentDoc = this.documentEngine.getDocument(doc.id);
      if (!currentDoc || currentDoc.contentRevision !== initialRevision) {
        Logger.debug('LspCallHierarchyProvider: Discarded prepare response due to document modification');
        return null;
      }

      if (session.getSessionGeneration() !== initialGeneration) {
        Logger.debug('LspCallHierarchyProvider: Discarded prepare response due to server session restart');
        return null;
      }

      if (!response || !Array.isArray(response) || response.length === 0) {
        return null;
      }

      const items: QmCallHierarchyItem[] = [];
      for (const rawItem of response) {
        const val = LspCallHierarchyValidator.validateCallHierarchyItem(rawItem);
        if (val.valid && val.value) {
          const canonical = LspCallHierarchyMapper.mapItem(val.value, {
            workspaceId,
            providerId: session.sessionId,
            providerGeneration: initialGeneration,
            documentRevision: initialRevision,
          });
          items.push(canonical);
        }
      }

      return items.length > 0 ? items : null;
    } catch (err) {
      if (!this.isDisposed) {
        Logger.warn('LspCallHierarchyProvider: prepareCallHierarchy request failed', {
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

  /**
   * Fetches incoming calls (callers) for a Call Hierarchy item.
   */
  public async getIncomingCalls(
    item: QmCallHierarchyItem,
    token?: CancellationToken
  ): Promise<QmIncomingCall[] | null> {
    if (this.isDisposed || !this.isEnabled() || token?.isCancellationRequested) {
      return null;
    }

    const doc = this.documentEngine.getByResource(item.uri);
    const workspaceId = this.workspaceEngine.getWorkspaceId() || doc?.workspaceId || 'default-workspace';
    const languageId = doc?.languageId || 'typescript';

    let session = this.serverManager.getActiveSession(languageId, workspaceId);
    if (!session) {
      const allSessions = this.serverManager.getAllSessions();
      session = allSessions.find(
        (s) =>
          (s.sessionId === item.providerId || s.workspaceId === workspaceId) &&
          (s.getState() === 'ready' || s.getState() === 'running')
      );
    }

    if (!session || (session.getState() !== 'ready' && session.getState() !== 'running')) {
      return null;
    }

    const initialGeneration = session.getSessionGeneration();
    const client = session.getClient();

    try {
      const response = await client.sendRequest<LspCallHierarchyIncomingCallsResponse>(
        'callHierarchy/incomingCalls',
        { item: item.rawItem },
        {
          category: 'interactive',
          cancellationToken: token,
          timeoutMs: 5000,
        }
      );

      if (token?.isCancellationRequested || this.isDisposed) {
        return null;
      }

      if (session.getSessionGeneration() !== initialGeneration) {
        return null;
      }

      if (!response || !Array.isArray(response)) {
        return [];
      }

      const incomingCalls: QmIncomingCall[] = [];
      const seen = new Set<string>();

      for (const rawCall of response) {
        const val = LspCallHierarchyValidator.validateIncomingCall(rawCall);
        if (val.valid && val.value) {
          const canonical = LspCallHierarchyMapper.mapIncomingCall(val.value, item.id, {
            workspaceId,
            providerId: session.sessionId,
            providerGeneration: initialGeneration,
            documentRevision: item.documentRevision,
          });

          if (!seen.has(canonical.id)) {
            seen.add(canonical.id);
            incomingCalls.push(canonical);
          }
        }
      }

      return incomingCalls;
    } catch (err) {
      if (!this.isDisposed) {
        Logger.warn('LspCallHierarchyProvider: incomingCalls request failed', {
          item: item.name,
          error: (err as Error).message,
        });
      }
      return null;
    }
  }

  /**
   * Fetches outgoing calls (callees) for a Call Hierarchy item.
   */
  public async getOutgoingCalls(
    item: QmCallHierarchyItem,
    token?: CancellationToken
  ): Promise<QmOutgoingCall[] | null> {
    if (this.isDisposed || !this.isEnabled() || token?.isCancellationRequested) {
      return null;
    }

    const doc = this.documentEngine.getByResource(item.uri);
    const workspaceId = this.workspaceEngine.getWorkspaceId() || doc?.workspaceId || 'default-workspace';
    const languageId = doc?.languageId || 'typescript';

    let session = this.serverManager.getActiveSession(languageId, workspaceId);
    if (!session) {
      const allSessions = this.serverManager.getAllSessions();
      session = allSessions.find(
        (s) =>
          (s.sessionId === item.providerId || s.workspaceId === workspaceId) &&
          (s.getState() === 'ready' || s.getState() === 'running')
      );
    }

    if (!session || (session.getState() !== 'ready' && session.getState() !== 'running')) {
      return null;
    }

    const initialGeneration = session.getSessionGeneration();
    const client = session.getClient();

    try {
      const response = await client.sendRequest<LspCallHierarchyOutgoingCallsResponse>(
        'callHierarchy/outgoingCalls',
        { item: item.rawItem },
        {
          category: 'interactive',
          cancellationToken: token,
          timeoutMs: 5000,
        }
      );

      if (token?.isCancellationRequested || this.isDisposed) {
        return null;
      }

      if (session.getSessionGeneration() !== initialGeneration) {
        return null;
      }

      if (!response || !Array.isArray(response)) {
        return [];
      }

      const outgoingCalls: QmOutgoingCall[] = [];
      const seen = new Set<string>();

      for (const rawCall of response) {
        const val = LspCallHierarchyValidator.validateOutgoingCall(rawCall);
        if (val.valid && val.value) {
          const canonical = LspCallHierarchyMapper.mapOutgoingCall(val.value, item.id, {
            workspaceId,
            providerId: session.sessionId,
            providerGeneration: initialGeneration,
            documentRevision: item.documentRevision,
          });

          if (!seen.has(canonical.id)) {
            seen.add(canonical.id);
            outgoingCalls.push(canonical);
          }
        }
      }

      return outgoingCalls;
    } catch (err) {
      if (!this.isDisposed) {
        Logger.warn('LspCallHierarchyProvider: outgoingCalls request failed', {
          item: item.name,
          error: (err as Error).message,
        });
      }
      return null;
    }
  }
}

export const globalCallHierarchyProvider = LspCallHierarchyProvider.getInstance();
