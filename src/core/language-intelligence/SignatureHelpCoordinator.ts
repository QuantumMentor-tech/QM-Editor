/**
 * QM Editor Canonical Signature Help Coordinator
 * Phase 04, Step 43 — Hover Information, Signature Help & Contextual Language Intelligence
 */

import {
  SignatureHelpRequest,
  SignatureHelpResult,
  SignatureHelpTriggerKind,
} from './LanguageIntelligenceTypes';
import {
  LanguageIntelligenceRegistry,
} from './LanguageIntelligenceRegistry';
import { globalDocumentEngine, DocumentEngine } from '../documents/DocumentEngine';
import { globalLanguageRegistry } from '../languageRegistry';
import { globalWorkspaceEngine } from '../workspace';
import { CancellationTokenSource } from '../symbols/CancellationToken';
import { Position } from '../navigation/LocationTypes';
import { logger } from '../../utils/logger';

export interface SignatureHelpInvocationOptions {
  triggerKind?: SignatureHelpTriggerKind;
  triggerCharacter?: string;
  isRetrigger?: boolean;
}

export class SignatureHelpCoordinator {
  private static instance: SignatureHelpCoordinator | null = null;
  private currentGeneration: number = 0;
  private activeCts: CancellationTokenSource | null = null;
  private isDisposed: boolean = false;

  constructor(
    private readonly registry: LanguageIntelligenceRegistry = LanguageIntelligenceRegistry.getInstance(),
    private readonly documentEngine: DocumentEngine = globalDocumentEngine
  ) {}

  public static getInstance(): SignatureHelpCoordinator {
    if (!SignatureHelpCoordinator.instance) {
      SignatureHelpCoordinator.instance = new SignatureHelpCoordinator();
    }
    return SignatureHelpCoordinator.instance;
  }

  public static resetInstance(): void {
    if (SignatureHelpCoordinator.instance) {
      SignatureHelpCoordinator.instance.dispose();
      SignatureHelpCoordinator.instance = null;
    }
  }

  /**
   * Primary entry point: queries eligible signature providers for parameter hints at a given position.
   */
  public async requestSignatureHelp(
    documentId: string,
    position: Position,
    options: SignatureHelpInvocationOptions = {}
  ): Promise<SignatureHelpResult | null> {
    if (this.isDisposed) return null;

    const doc = this.documentEngine.getDocument(documentId);
    if (!doc) return null;

    const uri = doc.resourceUri || doc.filePath || doc.title;
    const resolvedLanguage = globalLanguageRegistry.resolveLanguage(uri, doc.languageId).id;

    // Cancel previous in-flight request
    this.activeCts?.cancel();
    const cts = new CancellationTokenSource();
    this.activeCts = cts;

    const generation = ++this.currentGeneration;
    const requestId = `sig-${Date.now()}-${generation}`;
    const initialWorkspaceId = globalWorkspaceEngine.getWorkspaceId();

    // Calculate line prefix and character offset
    const lines = doc.content.split('\n');
    const safeLine = Math.max(1, Math.min(position.line, lines.length));
    const currentLineText = lines[safeLine - 1] || '';
    const safeCol = Math.max(1, Math.min(position.column, currentLineText.length + 1));

    let offset = 0;
    for (let i = 0; i < safeLine - 1; i++) {
      offset += lines[i].length + 1;
    }
    offset += safeCol - 1;

    const request: SignatureHelpRequest = {
      requestId,
      documentId: doc.id,
      uri,
      languageId: resolvedLanguage,
      revision: doc.contentRevision,
      position: { line: safeLine, column: safeCol },
      offset,
      triggerKind: options.triggerKind || 'invoked',
      triggerCharacter: options.triggerCharacter,
      isRetrigger: options.isRetrigger,
      workspaceId: doc.workspaceId || initialWorkspaceId || undefined,
    };

    // Query compatible signature help providers
    const providers = this.registry.getSignatureHelpProviders(resolvedLanguage);
    if (providers.length === 0) {
      return null;
    }

    // Query providers in parallel with isolated exception shields
    const providerPromises = providers.map(async (provider) => {
      try {
        if (!provider.provideSignatureHelp) return null;
        const res = await provider.provideSignatureHelp(request, cts.token);
        if (cts.token.isCancellationRequested || !res || res.signatures.length === 0) return null;

        return {
          result: res,
          priority: provider.priority ?? 50,
          providerId: provider.providerId,
        };
      } catch (err) {
        logger.error('SignatureHelpCoordinator: provider failed', {
          providerId: provider.providerId,
          error: (err as Error).message,
        });
        return null;
      }
    });

    const settled = await Promise.allSettled(providerPromises);

    // Stale generation check
    if (generation !== this.currentGeneration || cts.token.isCancellationRequested) {
      return null;
    }

    // Workspace switch check
    const currentWorkspaceId = globalWorkspaceEngine.getWorkspaceId();
    if (initialWorkspaceId && currentWorkspaceId && initialWorkspaceId !== currentWorkspaceId) {
      return null;
    }

    // Document revision check
    const freshDoc = this.documentEngine.getDocument(documentId);
    if (!freshDoc || freshDoc.contentRevision !== request.revision) {
      return null;
    }

    // Filter valid results
    const validResults: Array<{ result: SignatureHelpResult; priority: number; providerId: string }> = [];
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value && s.value.result.signatures.length > 0) {
        validResults.push(s.value);
      }
    }

    if (validResults.length === 0) {
      return null;
    }

    // Pick highest priority provider for coherent signature context (Rule 23)
    validResults.sort((a, b) => b.priority - a.priority);
    const chosen = validResults[0];

    // Ensure active signature and parameter bounds are safe
    const activeSig = Math.max(
      0,
      Math.min(chosen.result.activeSignature ?? 0, chosen.result.signatures.length - 1)
    );
    const targetSignature = chosen.result.signatures[activeSig];
    const paramCount = targetSignature.parameters?.length ?? 0;
    const activeParam = paramCount > 0
      ? Math.max(0, Math.min(chosen.result.activeParameter ?? 0, paramCount - 1))
      : 0;

    return {
      signatures: chosen.result.signatures,
      activeSignature: activeSig,
      activeParameter: activeParam,
      providerId: chosen.providerId,
      requestId,
      generation,
      revision: freshDoc.contentRevision,
    };
  }

  public cancelActiveRequest(): void {
    if (this.activeCts) {
      this.activeCts.cancel();
      this.activeCts = null;
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.cancelActiveRequest();
  }

  public reset(): void {
    this.isDisposed = false;
    this.cancelActiveRequest();
  }
}

export const globalSignatureHelpCoordinator = SignatureHelpCoordinator.getInstance();
