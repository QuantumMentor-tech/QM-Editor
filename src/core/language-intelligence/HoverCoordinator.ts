/**
 * QM Editor Canonical Hover Coordinator
 * Phase 04, Step 43 — Hover Information, Signature Help & Contextual Language Intelligence
 */

import {
  HoverRequest,
  HoverResult,
  HoverContentPart,
  HoverTriggerKind,
} from './LanguageIntelligenceTypes';
import {
  LanguageIntelligenceRegistry,
} from './LanguageIntelligenceRegistry';
import { globalDocumentEngine, DocumentEngine } from '../documents/DocumentEngine';
import { globalLanguageRegistry } from '../languageRegistry';
import { globalWorkspaceEngine } from '../workspace';
import { CancellationTokenSource } from '../symbols/CancellationToken';
import { Position, Range, Location } from '../navigation/LocationTypes';
import { logger } from '../../utils/logger';

export interface HoverInvocationOptions {
  triggerKind?: HoverTriggerKind;
}

export class HoverCoordinator {
  private static instance: HoverCoordinator | null = null;
  private currentGeneration: number = 0;
  private activeCts: CancellationTokenSource | null = null;
  private isDisposed: boolean = false;

  // Bounded recent cache: key -> HoverResult
  private cache = new Map<string, HoverResult>();
  private readonly maxCacheEntries = 50;

  constructor(
    private readonly registry: LanguageIntelligenceRegistry = LanguageIntelligenceRegistry.getInstance(),
    private readonly documentEngine: DocumentEngine = globalDocumentEngine
  ) {}

  public static getInstance(): HoverCoordinator {
    if (!HoverCoordinator.instance) {
      HoverCoordinator.instance = new HoverCoordinator();
    }
    return HoverCoordinator.instance;
  }

  public static resetInstance(): void {
    if (HoverCoordinator.instance) {
      HoverCoordinator.instance.dispose();
      HoverCoordinator.instance = null;
    }
  }

  /**
   * Primary entry point: queries eligible hover providers for contextual documentation at a given position.
   */
  public async requestHover(
    documentId: string,
    position: Position,
    options: HoverInvocationOptions = {}
  ): Promise<HoverResult | null> {
    if (this.isDisposed) return null;

    const doc = this.documentEngine.getDocument(documentId);
    if (!doc) return null;

    const uri = doc.resourceUri || doc.filePath || doc.title;
    const resolvedLanguage = globalLanguageRegistry.resolveLanguage(uri, doc.languageId).id;

    // Cache lookup
    const cacheKey = `${documentId}:${doc.contentRevision}:${position.line}:${position.column}:${resolvedLanguage}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) || null;
    }

    // Cancel previous in-flight request
    this.activeCts?.cancel();
    const cts = new CancellationTokenSource();
    this.activeCts = cts;

    const generation = ++this.currentGeneration;
    const requestId = `hover-${Date.now()}-${generation}`;
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

    const request: HoverRequest = {
      requestId,
      documentId: doc.id,
      uri,
      languageId: resolvedLanguage,
      revision: doc.contentRevision,
      position: { line: safeLine, column: safeCol },
      offset,
      triggerKind: options.triggerKind || 'mouse',
      workspaceId: doc.workspaceId || initialWorkspaceId || undefined,
    };

    // Query compatible hover providers
    const providers = this.registry.getHoverProviders(resolvedLanguage);
    if (providers.length === 0) {
      return null;
    }

    // Query providers in parallel with isolated exception shields
    const providerPromises = providers.map(async (provider) => {
      try {
        if (!provider.provideHover) return null;
        const res = await provider.provideHover(request, cts.token);
        if (cts.token.isCancellationRequested || !res) return null;

        return {
          result: res,
          priority: provider.priority ?? 50,
          providerId: provider.providerId,
        };
      } catch (err) {
        logger.error('HoverCoordinator: provider failed', {
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
    const validResults: Array<{ result: HoverResult; priority: number; providerId: string }> = [];
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value && s.value.result.contents.length > 0) {
        validResults.push(s.value);
      }
    }

    if (validResults.length === 0) {
      return null;
    }

    // Sort valid results by provider priority descending
    validResults.sort((a, b) => b.priority - a.priority);

    // Aggregate contents
    const aggregatedContents: HoverContentPart[] = [];
    let bestRange: Range | undefined;
    let bestLocation: Location | undefined;
    const primaryProviderId = validResults[0].providerId;

    for (const item of validResults) {
      aggregatedContents.push(...item.result.contents);
      if (!bestRange && item.result.range) {
        bestRange = item.result.range;
      }
      if (!bestLocation && item.result.location) {
        bestLocation = item.result.location;
      }
    }

    const finalResult: HoverResult = {
      contents: aggregatedContents,
      range: bestRange,
      location: bestLocation,
      providerId: primaryProviderId,
      requestId,
      generation,
      revision: freshDoc.contentRevision,
    };

    // Store in cache
    if (this.cache.size >= this.maxCacheEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, finalResult);

    return finalResult;
  }

  public cancelActiveRequest(): void {
    if (this.activeCts) {
      this.activeCts.cancel();
      this.activeCts = null;
    }
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.cancelActiveRequest();
    this.clearCache();
  }

  public reset(): void {
    this.isDisposed = false;
    this.cancelActiveRequest();
    this.clearCache();
  }
}

export const globalHoverCoordinator = HoverCoordinator.getInstance();
