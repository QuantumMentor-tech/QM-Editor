/**
 * QM Editor Canonical Symbol & Outline Service
 * Phase 04, Step 35 — Symbol Infrastructure, Outline & Symbol Navigation
 */

import { DocumentModel } from '../../types';
import {
  DocumentSymbol,
  WorkspaceSymbol,
  CancellationToken,
} from './SymbolTypes';
import { extractDocumentSymbols } from './SymbolExtractors';
import { workspaceIndexService } from '../../services/WorkspaceIndexService';
import { fileService } from '../../services/FileService';
import { logger } from '../../utils/logger';

interface CachedDocSymbols {
  revision: number;
  symbols: DocumentSymbol[];
}

export class SymbolService {
  private static instance: SymbolService | null = null;

  private readonly documentCache: Map<string, CachedDocSymbols> = new Map();
  private querySequence: number = 0;
  private isDisposed: boolean = false;

  public static getInstance(): SymbolService {
    if (!SymbolService.instance) {
      SymbolService.instance = new SymbolService();
    }
    return SymbolService.instance;
  }

  /**
   * Retrieves symbols for a specific document, leveraging cached revision structures.
   */
  public async getDocumentSymbols(
    document: DocumentModel,
    token?: CancellationToken
  ): Promise<DocumentSymbol[]> {
    if (this.isDisposed || !document) return [];

    if (token?.isCancellationRequested) {
      return [];
    }

    const cached = this.documentCache.get(document.id);
    if (cached && cached.revision === document.contentRevision) {
      return cached.symbols;
    }

    const symbols = extractDocumentSymbols(document.content, document.language);

    if (token?.isCancellationRequested) {
      return [];
    }

    this.documentCache.set(document.id, {
      revision: document.contentRevision,
      symbols,
    });

    return symbols;
  }

  /**
   * Searches symbols across all indexed workspace resources with cancellation and stale-result protection.
   */
  public async getWorkspaceSymbols(
    query: string,
    token?: CancellationToken
  ): Promise<WorkspaceSymbol[]> {
    if (this.isDisposed) return [];

    const currentSeq = ++this.querySequence;
    const trimmedQuery = query.trim().toLowerCase();
    const results: WorkspaceSymbol[] = [];

    const resources = workspaceIndexService.getResources();
    if (!resources || resources.length === 0) {
      return [];
    }

    // Filter relevant code resources (skip binaries, images, lockfiles)
    const codeResources = resources.filter((res) => {
      const ext = res.name.split('.').pop()?.toLowerCase();
      return (
        ext &&
        ['ts', 'tsx', 'js', 'jsx', 'py', 'md', 'json', 'html', 'css', 'go', 'rs', 'c', 'cpp'].includes(ext)
      );
    });

    for (const res of codeResources) {
      if (token?.isCancellationRequested || currentSeq !== this.querySequence) {
        return [];
      }

      try {
        let content: string | null = null;
        if (res.handle && 'kind' in res.handle && (res.handle as any).kind === 'file') {
          const fileData = await fileService.readFile(res.handle as FileSystemFileHandle);
          content = fileData.content;
        }

        if (token?.isCancellationRequested || currentSeq !== this.querySequence) {
          return [];
        }

        if (content) {
          const docSymbols = extractDocumentSymbols(content, res.name.split('.').pop() || 'plaintext');
          const flattened = this.flattenSymbols(docSymbols, res.uri);

          for (const sym of flattened) {
            if (!trimmedQuery || sym.name.toLowerCase().includes(trimmedQuery)) {
              results.push(sym);
            }
          }
        }
      } catch (err) {
        logger.debug('Failed to index file for workspace symbols', {
          uri: res.uri,
          error: (err as Error).message,
        });
      }
    }

    if (token?.isCancellationRequested || currentSeq !== this.querySequence) {
      return [];
    }

    // Sort results: exact matches first, then prefix matches, then alphabetical
    return results.sort((a, b) => {
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

  /**
   * Flattens a hierarchy of DocumentSymbols into WorkspaceSymbols with container tracking.
   */
  private flattenSymbols(symbols: DocumentSymbol[], uri: string, parentContainer?: string): WorkspaceSymbol[] {
    const list: WorkspaceSymbol[] = [];

    for (const sym of symbols) {
      list.push({
        name: sym.name,
        kind: sym.kind,
        tags: sym.tags,
        containerName: sym.containerName || parentContainer,
        location: {
          uri,
          range: sym.range,
        },
      });

      if (sym.children && sym.children.length > 0) {
        list.push(...this.flattenSymbols(sym.children, uri, sym.name));
      }
    }

    return list;
  }

  public clearCache(documentId?: string): void {
    if (documentId) {
      this.documentCache.delete(documentId);
    } else {
      this.documentCache.clear();
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.documentCache.clear();
  }
}

export const globalSymbolService = SymbolService.getInstance();
