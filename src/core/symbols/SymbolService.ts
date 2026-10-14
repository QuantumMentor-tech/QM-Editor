/**
 * QM Editor Canonical Symbol & Outline Service
 * Phase 04, Step 35 & Step 41 — Symbol Infrastructure, Outline & Symbol Navigation
 */

import { DocumentModel } from '../../types';
import {
  DocumentSymbol,
  WorkspaceSymbol,
  CancellationToken,
} from './SymbolTypes';
import { globalSymbolEngine } from './SymbolEngine';

export class SymbolService {
  private static instance: SymbolService | null = null;
  private readonly legacyCache = new Map<string, { revision: number; symbols: DocumentSymbol[] }>();
  private isDisposed: boolean = false;

  public static getInstance(): SymbolService {
    if (!SymbolService.instance) {
      SymbolService.instance = new SymbolService();
    }
    return SymbolService.instance;
  }

  /**
   * Retrieves symbols for a specific document, delegating to the canonical SymbolEngine.
   */
  public async getDocumentSymbols(
    document: DocumentModel,
    token?: CancellationToken
  ): Promise<DocumentSymbol[]> {
    if (this.isDisposed || !document) return [];

    if (token?.isCancellationRequested) {
      return [];
    }

    const cached = this.legacyCache.get(document.id);
    if (cached && cached.revision === document.contentRevision) {
      return cached.symbols;
    }

    const uri = document.fileResource?.uri || document.filePath || document.title;
    const res = await globalSymbolEngine.getDocumentSymbols(
      {
        id: document.id,
        uri,
        content: document.content,
        language: document.language,
        contentRevision: document.contentRevision,
      },
      token
    );

    if (token?.isCancellationRequested) {
      return [];
    }

    const legacySymbols = this.mapToLegacyDocumentSymbols(res.symbols);
    this.legacyCache.set(document.id, {
      revision: document.contentRevision,
      symbols: legacySymbols,
    });

    return legacySymbols;
  }

  /**
   * Searches symbols across all indexed workspace resources via canonical SymbolEngine.
   */
  public async getWorkspaceSymbols(
    query: string,
    token?: CancellationToken
  ): Promise<WorkspaceSymbol[]> {
    if (this.isDisposed) return [];

    const symbols = await globalSymbolEngine.getWorkspaceSymbols(query, token);
    return symbols.map((s) => ({
      name: s.name,
      kind: s.kind,
      tags: s.tags,
      containerName: s.containerName,
      location: {
        uri: s.location.uri,
        range: s.location.range || {
          startLine: 1,
          startColumn: 1,
          endLine: 1,
          endColumn: 1,
        },
      },
    }));
  }

  private mapToLegacyDocumentSymbols(symbols: any[]): DocumentSymbol[] {
    return symbols.map((s) => {
      const range = s.location?.range || {
        startLine: 1,
        startColumn: 1,
        endLine: 1,
        endColumn: 1,
      };
      const selectionRange = s.selectionRange || range;

      return {
        name: s.name,
        detail: s.detail,
        kind: s.kind,
        tags: s.tags,
        range,
        selectionRange,
        containerName: s.containerName,
        children: s.children ? this.mapToLegacyDocumentSymbols(s.children) : undefined,
      };
    });
  }

  public clearCache(documentId?: string): void {
    if (documentId) {
      this.legacyCache.delete(documentId);
      globalSymbolEngine.invalidateDocument(documentId);
    } else {
      this.legacyCache.clear();
      globalSymbolEngine.clearCache();
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.legacyCache.clear();
    globalSymbolEngine.clearCache();
  }
}

export const globalSymbolService = SymbolService.getInstance();
