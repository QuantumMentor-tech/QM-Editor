/**
 * QM Editor Canonical Symbol Engine
 * Phase 04, Step 41 — Code Navigation, Symbols, Locations & Outline Engine
 */

import {
  Symbol,
  DocumentSymbol,
  WorkspaceSymbol,
  DocumentSymbolResult,
  DocumentSymbolInput,
  SymbolProvider,
  CancellationToken,
} from './SymbolTypes';
import { Range } from '../navigation/LocationTypes';
import { normalizeLocationUri, createLocation } from '../navigation/LocationValidation';
import { extractDocumentSymbols } from './SymbolExtractors';
import { workspaceIndexService } from '../../services/WorkspaceIndexService';
import { fileService } from '../../services/FileService';
import { globalWorkspaceEngine } from '../workspace';
import { logger } from '../../utils/logger';

interface CacheEntry {
  documentUri: string;
  revision: number;
  generation: number;
  providerId: string;
  symbols: Symbol[];
  timestamp: number;
}

/**
 * Built-in Symbol Provider leveraging regex patterns for fast out-of-the-box outlining.
 */
export class BuiltinRegexSymbolProvider implements SymbolProvider {
  public readonly providerId = 'builtin.regex';
  public readonly displayName = 'QM Editor Built-in Symbol Extractor';
  public readonly capabilities = {
    supportsDocumentSymbols: true,
    supportsWorkspaceSymbols: true,
    supportsHierarchicalSymbols: true,
    priority: 10,
  };

  public async provideDocumentSymbols(
    document: DocumentSymbolInput,
    token?: CancellationToken
  ): Promise<Symbol[]> {
    if (token?.isCancellationRequested) return [];

    const rawSymbols = extractDocumentSymbols(document.content, document.language);
    if (token?.isCancellationRequested) return [];

    return this.convertToCanonicalSymbols(rawSymbols, document.uri, document.workspaceId);
  }

  public async provideWorkspaceSymbols(
    query: string,
    token?: CancellationToken
  ): Promise<Symbol[]> {
    if (token?.isCancellationRequested) return [];

    const trimmedQuery = query.trim().toLowerCase();
    const results: Symbol[] = [];

    const resources = workspaceIndexService.getResources();
    if (!resources || resources.length === 0) return [];

    const codeResources = resources.filter((res) => {
      const ext = res.name.split('.').pop()?.toLowerCase();
      return (
        ext &&
        ['ts', 'tsx', 'js', 'jsx', 'py', 'md', 'json', 'html', 'css', 'go', 'rs', 'c', 'cpp'].includes(ext)
      );
    });

    for (const res of codeResources) {
      if (token?.isCancellationRequested) return [];

      try {
        let content: string | null = null;
        if (res.handle && 'kind' in res.handle && (res.handle as any).kind === 'file') {
          const fileData = await fileService.readFile(res.handle as FileSystemFileHandle);
          content = fileData.content;
        }

        if (token?.isCancellationRequested) return [];

        if (content) {
          const ext = res.name.split('.').pop() || 'plaintext';
          const docSymbols = extractDocumentSymbols(content, ext);
          const canonical = this.convertToCanonicalSymbols(docSymbols, res.uri);
          const flattened = this.flattenSymbols(canonical);

          for (const sym of flattened) {
            if (!trimmedQuery || sym.name.toLowerCase().includes(trimmedQuery)) {
              results.push(sym);
            }
          }
        }
      } catch (err) {
        logger.debug('BuiltinRegexSymbolProvider: Failed to index resource', {
          uri: res.uri,
          error: (err as Error).message,
        });
      }
    }

    return results;
  }

  private convertToCanonicalSymbols(
    raw: DocumentSymbol[],
    uri: string,
    workspaceId?: string,
    containerName?: string
  ): Symbol[] {
    return raw.map((item, index) => {
      const range: Range = {
        startLine: item.range.startLine,
        startColumn: item.range.startColumn,
        endLine: item.range.endLine,
        endColumn: item.range.endColumn,
      };

      const selectionRange: Range = {
        startLine: item.selectionRange.startLine,
        startColumn: item.selectionRange.startColumn,
        endLine: item.selectionRange.endLine,
        endColumn: item.selectionRange.endColumn,
      };

      const location = createLocation(uri, range, selectionRange, workspaceId);
      const symbolId = `${this.providerId}:${uri}:${item.name}:${range.startLine}:${index}`;

      const children = item.children && item.children.length > 0
        ? this.convertToCanonicalSymbols(item.children, uri, workspaceId, item.name)
        : undefined;

      return {
        id: symbolId,
        name: item.name,
        kind: item.kind,
        location,
        selectionRange,
        containerName: item.containerName || containerName,
        detail: item.detail,
        tags: item.tags,
        children,
        sourceProviderId: this.providerId,
        workspaceId,
      };
    });
  }

  private flattenSymbols(symbols: Symbol[]): Symbol[] {
    const list: Symbol[] = [];
    for (const sym of symbols) {
      list.push(sym);
      if (sym.children && sym.children.length > 0) {
        list.push(...this.flattenSymbols(sym.children));
      }
    }
    return list;
  }
}

export class SymbolEngine {
  private static instance: SymbolEngine | null = null;

  private readonly providers: Map<string, SymbolProvider> = new Map();
  private readonly documentCache: Map<string, CacheEntry> = new Map();
  private queryGeneration: number = 0;
  private isDisposed: boolean = false;

  constructor() {
    // Register default built-in regex provider
    this.registerProvider(new BuiltinRegexSymbolProvider());
  }

  public static getInstance(): SymbolEngine {
    if (!SymbolEngine.instance) {
      SymbolEngine.instance = new SymbolEngine();
    }
    return SymbolEngine.instance;
  }

  // ---------------------------------------------------------------------------
  // Provider Registry
  // ---------------------------------------------------------------------------

  public registerProvider(provider: SymbolProvider): () => void {
    if (!provider || !provider.providerId) {
      throw new Error('SymbolProvider must have a valid providerId.');
    }

    this.providers.set(provider.providerId, provider);
    logger.info(`SymbolEngine: registered provider ${provider.providerId}`);

    return () => {
      this.unregisterProvider(provider.providerId);
    };
  }

  public unregisterProvider(providerId: string): void {
    const existing = this.providers.get(providerId);
    if (existing) {
      this.providers.delete(providerId);
      // Evict any cached symbols from this provider
      for (const [key, entry] of this.documentCache.entries()) {
        if (entry.providerId === providerId) {
          this.documentCache.delete(key);
        }
      }
      try {
        existing.dispose?.();
      } catch {
        // Safe disposal
      }
      logger.info(`SymbolEngine: unregistered provider ${providerId}`);
    }
  }

  public getProviders(): SymbolProvider[] {
    return Array.from(this.providers.values()).sort(
      (a, b) => (b.capabilities?.priority || 0) - (a.capabilities?.priority || 0)
    );
  }

  public getProvider(providerId: string): SymbolProvider | undefined {
    return this.providers.get(providerId);
  }

  // ---------------------------------------------------------------------------
  // Document Symbols (with Generation & Revision Protection)
  // ---------------------------------------------------------------------------

  public async getDocumentSymbols(
    document: DocumentSymbolInput,
    token?: CancellationToken
  ): Promise<DocumentSymbolResult> {
    if (this.isDisposed || !document || !document.uri) {
      return {
        documentUri: document?.uri || '',
        revision: document?.contentRevision ?? 0,
        providerId: '',
        symbols: [],
        timestamp: Date.now(),
        generation: this.queryGeneration,
      };
    }

    const normalizedUri = normalizeLocationUri(document.uri);
    const revision = document.contentRevision ?? 0;
    const currentGeneration = ++this.queryGeneration;
    const initialWorkspaceId = globalWorkspaceEngine.getWorkspaceId();

    const sortedProviders = this.getProviders().filter((p) => {
      if (!p.provideDocumentSymbols) return false;
      if (p.capabilities?.supportedLanguages && p.capabilities.supportedLanguages.length > 0) {
        return p.capabilities.supportedLanguages.includes(document.language);
      }
      return true;
    });

    if (sortedProviders.length === 0) {
      return {
        documentUri: normalizedUri,
        revision,
        providerId: '',
        symbols: [],
        timestamp: Date.now(),
        generation: currentGeneration,
      };
    }

    // Use highest priority provider
    const primaryProvider = sortedProviders[0];
    const cacheKey = `${normalizedUri}:${primaryProvider.providerId}`;

    // 1. Check in-memory revision cache
    const cached = this.documentCache.get(cacheKey);
    if (cached && cached.revision === revision) {
      return {
        documentUri: normalizedUri,
        revision: cached.revision,
        providerId: cached.providerId,
        symbols: cached.symbols,
        timestamp: cached.timestamp,
        generation: cached.generation,
      };
    }

    const startTime = Date.now();

    try {
      const rawSymbols = await primaryProvider.provideDocumentSymbols!(document, token);

      // 2. Cancellation check
      if (token?.isCancellationRequested) {
        return {
          documentUri: normalizedUri,
          revision,
          providerId: primaryProvider.providerId,
          symbols: [],
          timestamp: Date.now(),
          generation: currentGeneration,
        };
      }

      // 3. Workspace generation switch check
      const currentWorkspaceId = globalWorkspaceEngine.getWorkspaceId();
      if (initialWorkspaceId && currentWorkspaceId && initialWorkspaceId !== currentWorkspaceId) {
        logger.debug('SymbolEngine: workspace switched during document symbol resolution, discarding');
        return {
          documentUri: normalizedUri,
          revision,
          providerId: primaryProvider.providerId,
          symbols: [],
          timestamp: Date.now(),
          generation: currentGeneration,
        };
      }

      // 4. Stale query generation check
      if (currentGeneration < this.queryGeneration) {
        logger.debug('SymbolEngine: stale symbol query generation superseded');
      }

      // 5. Canonicalize symbols
      const canonicalSymbols = this.normalizeToCanonical(
        rawSymbols,
        normalizedUri,
        primaryProvider.providerId,
        document.workspaceId || currentWorkspaceId || undefined
      );

      // 6. Cache valid result
      this.documentCache.set(cacheKey, {
        documentUri: normalizedUri,
        revision,
        generation: currentGeneration,
        providerId: primaryProvider.providerId,
        symbols: canonicalSymbols,
        timestamp: Date.now(),
      });

      return {
        documentUri: normalizedUri,
        revision,
        providerId: primaryProvider.providerId,
        symbols: canonicalSymbols,
        timestamp: Date.now(),
        generation: currentGeneration,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      logger.error('SymbolEngine: error providing document symbols', {
        providerId: primaryProvider.providerId,
        uri: normalizedUri,
        error: (err as Error).message,
      });

      return {
        documentUri: normalizedUri,
        revision,
        providerId: primaryProvider.providerId,
        symbols: [],
        timestamp: Date.now(),
        generation: currentGeneration,
      };
    }
  }

  /**
   * Searches workspace-wide symbols across all capable providers.
   */
  public async getWorkspaceSymbols(
    query: string,
    token?: CancellationToken
  ): Promise<Symbol[]> {
    if (this.isDisposed) return [];

    const currentGeneration = ++this.queryGeneration;
    const initialWorkspaceId = globalWorkspaceEngine.getWorkspaceId();
    const trimmedQuery = query.trim().toLowerCase();

    const capableProviders = this.getProviders().filter((p) => p.provideWorkspaceSymbols);
    const combined: Symbol[] = [];

    for (const provider of capableProviders) {
      if (token?.isCancellationRequested) return [];

      try {
        const results = await provider.provideWorkspaceSymbols!(query, token);
        if (token?.isCancellationRequested) return [];

        const normalized = this.normalizeToCanonical(
          results,
          '',
          provider.providerId,
          initialWorkspaceId || undefined
        );
        combined.push(...normalized);
      } catch (err) {
        logger.debug('SymbolEngine: error querying provider workspace symbols', {
          providerId: provider.providerId,
          error: (err as Error).message,
        });
      }
    }

    // Workspace switch check
    const currentWorkspaceId = globalWorkspaceEngine.getWorkspaceId();
    if (initialWorkspaceId && currentWorkspaceId && initialWorkspaceId !== currentWorkspaceId) {
      return [];
    }

    // Stale generation check
    if (currentGeneration !== this.queryGeneration) {
      return [];
    }

    // Sort: exact matches first, then prefix, then alphabetical
    return combined.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      if (trimmedQuery) {
        const aExact = aName === trimmedQuery;
        const bExact = bName === trimmedQuery;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = aName.startsWith(trimmedQuery);
        const bStarts = bName.startsWith(trimmedQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
      }
      return aName.localeCompare(bName);
    });
  }

  // ---------------------------------------------------------------------------
  // Canonical Normalization Helper
  // ---------------------------------------------------------------------------

  private normalizeToCanonical(
    items: Array<Symbol | DocumentSymbol | WorkspaceSymbol>,
    fallbackUri: string,
    providerId: string,
    workspaceId?: string
  ): Symbol[] {
    return items.map((item, idx) => {
      // Check if already canonical Symbol
      if ('id' in item && 'sourceProviderId' in item && 'location' in item) {
        return item as Symbol;
      }

      // Check if WorkspaceSymbol
      if ('location' in item && 'uri' in (item as any).location) {
        const wsSym = item as WorkspaceSymbol;
        const uri = normalizeLocationUri(wsSym.location.uri);
        const range: Range = {
          startLine: wsSym.location.range.startLine,
          startColumn: wsSym.location.range.startColumn,
          endLine: wsSym.location.range.endLine,
          endColumn: wsSym.location.range.endColumn,
        };

        return {
          id: `${providerId}:${uri}:${wsSym.name}:${range.startLine}:${idx}`,
          name: wsSym.name,
          kind: wsSym.kind,
          location: createLocation(uri, range, undefined, workspaceId),
          containerName: wsSym.containerName,
          tags: wsSym.tags,
          sourceProviderId: providerId,
          workspaceId,
        };
      }

      // Otherwise legacy DocumentSymbol
      const docSym = item as DocumentSymbol;
      const uri = normalizeLocationUri(fallbackUri);
      const range: Range = {
        startLine: docSym.range.startLine,
        startColumn: docSym.range.startColumn,
        endLine: docSym.range.endLine,
        endColumn: docSym.range.endColumn,
      };
      const selRange: Range = {
        startLine: docSym.selectionRange.startLine,
        startColumn: docSym.selectionRange.startColumn,
        endLine: docSym.selectionRange.endLine,
        endColumn: docSym.selectionRange.endColumn,
      };

      const children = docSym.children && docSym.children.length > 0
        ? this.normalizeToCanonical(docSym.children, uri, providerId, workspaceId)
        : undefined;

      return {
        id: `${providerId}:${uri}:${docSym.name}:${range.startLine}:${idx}`,
        name: docSym.name,
        kind: docSym.kind,
        location: createLocation(uri, range, selRange, workspaceId),
        selectionRange: selRange,
        containerName: docSym.containerName,
        detail: docSym.detail,
        tags: docSym.tags,
        children,
        sourceProviderId: providerId,
        workspaceId,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Cache Management & Disposal
  // ---------------------------------------------------------------------------

  public invalidateDocument(uriOrPath: string): void {
    const normalized = normalizeLocationUri(uriOrPath);
    for (const key of this.documentCache.keys()) {
      if (key.startsWith(`${normalized}:`)) {
        this.documentCache.delete(key);
      }
    }
  }

  public clearCache(): void {
    this.documentCache.clear();
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.clearCache();
    for (const provider of this.providers.values()) {
      try {
        provider.dispose?.();
      } catch {
        // Safe disposal
      }
    }
    this.providers.clear();
  }
}

export const globalSymbolEngine = SymbolEngine.getInstance();
