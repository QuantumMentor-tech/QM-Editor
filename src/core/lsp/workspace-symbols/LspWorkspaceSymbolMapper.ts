/**
 * QM Editor LSP Workspace Symbol Mapper
 * Phase 06, Step 61 — LSP Workspace Symbols, Cross-File Symbol Search & Symbol Navigation
 */

import { Symbol, SymbolKind, SymbolTag } from '../../symbols/SymbolTypes';
import { Location } from '../../navigation/LocationTypes';
import { LspSymbolKind, LspSymbolTag } from '../LspTypes';
import { LspUriMapper } from '../LspUriMapper';
import { LspLocationMapper } from '../navigation/LspLocationMapper';
import { SanitizedWorkspaceSymbolItem } from './LspWorkspaceSymbolTypes';

export class LspWorkspaceSymbolMapper {
  /**
   * Complete 1-to-1 mapping from LSP numeric SymbolKind (1..26)
   * to QM Editor canonical SymbolKind.
   */
  private static readonly KIND_MAP: Record<number, SymbolKind> = {
    [LspSymbolKind.File]: 'file',
    [LspSymbolKind.Module]: 'module',
    [LspSymbolKind.Namespace]: 'namespace',
    [LspSymbolKind.Package]: 'package',
    [LspSymbolKind.Class]: 'class',
    [LspSymbolKind.Method]: 'method',
    [LspSymbolKind.Property]: 'property',
    [LspSymbolKind.Field]: 'field',
    [LspSymbolKind.Constructor]: 'constructor',
    [LspSymbolKind.Enum]: 'enum',
    [LspSymbolKind.Interface]: 'interface',
    [LspSymbolKind.Function]: 'function',
    [LspSymbolKind.Variable]: 'variable',
    [LspSymbolKind.Constant]: 'constant',
    [LspSymbolKind.String]: 'string',
    [LspSymbolKind.Number]: 'number',
    [LspSymbolKind.Boolean]: 'boolean',
    [LspSymbolKind.Array]: 'array',
    [LspSymbolKind.Object]: 'object',
    [LspSymbolKind.Key]: 'key',
    [LspSymbolKind.Null]: 'null',
    [LspSymbolKind.EnumMember]: 'enumMember',
    [LspSymbolKind.Struct]: 'struct',
    [LspSymbolKind.Event]: 'event',
    [LspSymbolKind.Operator]: 'operator',
    [LspSymbolKind.TypeParameter]: 'typeParameter',
  };

  /**
   * Maps an LSP numeric SymbolKind to the canonical QM Editor SymbolKind.
   * Defaults safely to 'variable' if unrecognized.
   */
  public static mapKind(lspKind: number): SymbolKind {
    return this.KIND_MAP[lspKind] || 'variable';
  }

  /**
   * Maps LSP tags and legacy deprecated flag to canonical SymbolTag array.
   */
  public static mapTags(tags?: LspSymbolTag[], deprecated?: boolean): SymbolTag[] | undefined {
    const canonicalTags: SymbolTag[] = [];
    if (deprecated || (tags && tags.includes(LspSymbolTag.Deprecated))) {
      canonicalTags.push('deprecated');
    }
    return canonicalTags.length > 0 ? canonicalTags : undefined;
  }

  /**
   * Maps a single validated and sanitized LSP symbol into a canonical QM Editor Symbol.
   */
  public static mapItemToSymbol(
    item: SanitizedWorkspaceSymbolItem,
    workspaceId?: string,
    sourceProviderId = 'lsp.workspaceSymbols'
  ): Symbol {
    const canonicalUri = LspUriMapper.uriToPath(item.location.uri);
    const canonicalRange = LspLocationMapper.mapLspRange(item.location.range);
    const kind = this.mapKind(item.kind);
    const tags = this.mapTags(item.tags, item.deprecated);

    const location: Location = {
      uri: canonicalUri,
      range: canonicalRange,
    };

    const id = `${canonicalUri}#${item.name}#${kind}#${canonicalRange.startLine}:${canonicalRange.startColumn}`;

    return {
      id,
      name: item.name,
      kind,
      location,
      containerName: item.containerName || undefined,
      tags,
      sourceProviderId,
      workspaceId: workspaceId || undefined,
    };
  }

  /**
   * Computes a deduplication key for a canonical symbol.
   */
  public static getSymbolDeduplicationKey(sym: Symbol): string {
    const r = sym.location.range;
    if (!r) {
      return `${sym.location.uri}#${sym.name}#${sym.kind}`;
    }
    return `${sym.location.uri}#${sym.name}#${sym.kind}#${r.startLine}:${r.startColumn}-${r.endLine}:${r.endColumn}`;
  }

  /**
   * Maps an array of sanitized items to canonical Symbols, deduplicating exact matches
   * and optionally sorting them by query match relevance.
   */
  public static mapToCanonicalSymbols(
    items: SanitizedWorkspaceSymbolItem[],
    workspaceId?: string,
    query?: string,
    sourceProviderId = 'lsp.workspaceSymbols'
  ): Symbol[] {
    const seen = new Set<string>();
    const results: Symbol[] = [];

    for (const item of items) {
      const sym = this.mapItemToSymbol(item, workspaceId, sourceProviderId);
      const key = this.getSymbolDeduplicationKey(sym);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(sym);
      }
    }

    if (query && query.trim().length > 0) {
      const q = query.trim().toLowerCase();
      results.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        // 1. Exact match
        const aExact = aName === q;
        const bExact = bName === q;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // 2. Prefix match
        const aPrefix = aName.startsWith(q);
        const bPrefix = bName.startsWith(q);
        if (aPrefix && !bPrefix) return -1;
        if (!aPrefix && bPrefix) return 1;

        // 3. Alphabetical by name
        const nameComp = a.name.localeCompare(b.name);
        if (nameComp !== 0) return nameComp;

        // 4. Container name
        const aContainer = a.containerName || '';
        const bContainer = b.containerName || '';
        const containerComp = aContainer.localeCompare(bContainer);
        if (containerComp !== 0) return containerComp;

        // 5. File URI
        return a.location.uri.localeCompare(b.location.uri);
      });
    }

    return results;
  }
}
