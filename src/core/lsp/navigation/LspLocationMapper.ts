/**
 * QM Editor LSP Location Mapper
 * Phase 06, Step 60 — LSP Code Navigation, Definitions, Declarations, Type Definitions & References
 */

import { Location, Range } from '../../navigation/LocationTypes';
import { LspLocation, LspLocationLink, LspRange } from '../LspTypes';
import { LspUriMapper } from '../LspUriMapper';
import { LspLocationValidator } from './LspLocationValidator';
import { ReferenceGroup, ReferenceResult } from './LspNavigationTypes';

export class LspLocationMapper {
  /**
   * Converts a 0-based LSP range into a 1-based canonical Range.
   */
  public static mapLspRange(lspRange: LspRange): Range {
    return {
      startLine: Math.max(1, lspRange.start.line + 1),
      startColumn: Math.max(1, lspRange.start.character + 1),
      endLine: Math.max(1, lspRange.end.line + 1),
      endColumn: Math.max(1, lspRange.end.character + 1),
    };
  }

  /**
   * Maps a single validated LSP Location or LocationLink into a canonical Location.
   */
  public static mapItemToLocation(item: LspLocation | LspLocationLink): Location {
    if (LspLocationValidator.isLocationLink(item)) {
      const canonicalUri = LspUriMapper.uriToPath(item.targetUri);
      return {
        uri: canonicalUri,
        range: this.mapLspRange(item.targetRange),
        selectionRange: this.mapLspRange(item.targetSelectionRange),
      };
    }

    const canonicalUri = LspUriMapper.uriToPath(item.uri);
    return {
      uri: canonicalUri,
      range: this.mapLspRange(item.range),
    };
  }

  /**
   * Computes a deterministic identity key for deduplication.
   */
  public static getLocationKey(loc: Location): string {
    const r = loc.range;
    if (!r) return loc.uri;
    return `${loc.uri}#${r.startLine}:${r.startColumn}-${r.endLine}:${r.endColumn}`;
  }

  /**
   * Maps an array of validated LSP locations/links into canonical Locations, deduplicating exact matches.
   */
  public static mapToCanonicalLocations(
    items: (LspLocation | LspLocationLink)[]
  ): Location[] {
    const seen = new Set<string>();
    const results: Location[] = [];

    for (const item of items) {
      const loc = this.mapItemToLocation(item);
      const key = this.getLocationKey(loc);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(loc);
      }
    }

    return results;
  }

  /**
   * Builds a canonical ReferenceResult from canonical locations, grouping by resource and sorting.
   */
  public static buildReferenceResult(
    requestId: string,
    locations: Location[],
    durationMs?: number,
    isCancelled?: boolean
  ): ReferenceResult {
    // Sort locations deterministically: uri, then startLine, then startColumn
    const sorted = [...locations].sort((a, b) => {
      if (a.uri !== b.uri) {
        return a.uri.localeCompare(b.uri);
      }
      const aLine = a.range?.startLine ?? 0;
      const bLine = b.range?.startLine ?? 0;
      if (aLine !== bLine) return aLine - bLine;
      const aCol = a.range?.startColumn ?? 0;
      const bCol = b.range?.startColumn ?? 0;
      return aCol - bCol;
    });

    // Group by URI
    const groupMap = new Map<string, Location[]>();
    for (const loc of sorted) {
      const existing = groupMap.get(loc.uri);
      if (existing) {
        existing.push(loc);
      } else {
        groupMap.set(loc.uri, [loc]);
      }
    }

    const groups: ReferenceGroup[] = [];
    for (const [uri, locs] of groupMap.entries()) {
      const displayPath = uri.split(/[\\/]/).pop() || uri;
      groups.push({
        uri,
        displayPath,
        locations: locs,
      });
    }

    return {
      requestId,
      locations: sorted,
      totalCount: sorted.length,
      groups,
      durationMs,
      isCancelled,
    };
  }
}
