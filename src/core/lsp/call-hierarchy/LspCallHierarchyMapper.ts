/**
 * QM Editor — LSP Call Hierarchy Mapper
 * Phase 06, Step 70 — LSP Call Hierarchy, Callers, Callees & Safe Cross-File Code Relationship Navigation
 *
 * Converts protocol-level Call Hierarchy items and relationships into canonical QM Editor models,
 * coordinates, and navigable locations.
 */

import { Location, Range } from '../../navigation/LocationTypes';
import { SymbolKind, SymbolTag } from '../../symbols/SymbolTypes';
import { LspWorkspaceSymbolMapper } from '../workspace-symbols/LspWorkspaceSymbolMapper';
import { LspUriMapper } from '../LspUriMapper';
import {
  LspCallHierarchyItem,
  LspCallHierarchyIncomingCall,
  LspCallHierarchyOutgoingCall,
  LspRange,
  LspSymbolTag,
} from '../LspTypes';
import {
  QmCallHierarchyItem,
  QmIncomingCall,
  QmOutgoingCall,
} from './LspCallHierarchyTypes';

export class LspCallHierarchyMapper {
  /**
   * Maps a numeric LSP symbol kind to canonical SymbolKind string.
   */
  public static mapKind(kind: number): SymbolKind {
    return LspWorkspaceSymbolMapper.mapKind(kind);
  }

  /**
   * Converts a 0-based LSP range into a 1-based canonical Range.
   */
  public static mapRange(lspRange: LspRange): Range {
    return {
      startLine: Math.max(1, lspRange.start.line + 1),
      startColumn: Math.max(1, lspRange.start.character + 1),
      endLine: Math.max(1, lspRange.end.line + 1),
      endColumn: Math.max(1, lspRange.end.character + 1),
    };
  }

  /**
   * Maps an array of LSP symbol tags into canonical SymbolTags.
   */
  public static mapTags(tags?: LspSymbolTag[]): SymbolTag[] | undefined {
    if (!tags || tags.length === 0) return undefined;
    const result: SymbolTag[] = [];
    for (const tag of tags) {
      if (tag === 1) {
        result.push('deprecated');
      }
    }
    return result.length > 0 ? result : undefined;
  }

  /**
   * Converts a validated LSP CallHierarchyItem into a canonical QmCallHierarchyItem.
   */
  public static mapItem(
    item: LspCallHierarchyItem,
    context: {
      workspaceId: string;
      providerId: string;
      providerGeneration: number;
      documentRevision: number;
    }
  ): QmCallHierarchyItem {
    const canonicalUri = LspUriMapper.uriToPath(item.uri);
    const displayUri = canonicalUri.split(/[\\/]/).pop() || canonicalUri;
    const range = this.mapRange(item.range);
    const selectionRange = this.mapRange(item.selectionRange);
    const kind = LspWorkspaceSymbolMapper.mapKind(item.kind);
    const tags = this.mapTags(item.tags);

    const id = `${context.workspaceId}:${canonicalUri}:${item.name}:${range.startLine}:${range.startColumn}`;

    return {
      id,
      name: item.name,
      kind,
      tags,
      detail: item.detail,
      uri: canonicalUri,
      displayUri,
      range,
      selectionRange,
      providerId: context.providerId,
      providerGeneration: context.providerGeneration,
      documentRevision: context.documentRevision,
      rawItem: item,
    };
  }

  /**
   * Alias for mapItem.
   */
  public static mapCallHierarchyItem(
    item: LspCallHierarchyItem,
    context: {
      workspaceId: string;
      providerId: string;
      providerGeneration: number;
      documentRevision: number;
    }
  ): QmCallHierarchyItem {
    return this.mapItem(item, context);
  }

  /**
   * Converts a validated LSP incoming call into a canonical QmIncomingCall.
   */
  public static mapIncomingCall(
    call: LspCallHierarchyIncomingCall,
    parentItemId: string,
    context: {
      workspaceId: string;
      providerId: string;
      providerGeneration: number;
      documentRevision: number;
    }
  ): QmIncomingCall {
    const from = this.mapItem(call.from, context);
    const fromRanges = call.fromRanges.map((r) => this.mapRange(r));

    const id = `inc:${parentItemId}<-${from.id}`;

    return {
      id,
      from,
      fromRanges,
      parentItemId,
      providerId: context.providerId,
      providerGeneration: context.providerGeneration,
    };
  }

  /**
   * Converts a validated LSP outgoing call into a canonical QmOutgoingCall.
   */
  public static mapOutgoingCall(
    call: LspCallHierarchyOutgoingCall,
    parentItemId: string,
    context: {
      workspaceId: string;
      providerId: string;
      providerGeneration: number;
      documentRevision: number;
    }
  ): QmOutgoingCall {
    const to = this.mapItem(call.to, context);
    const fromRanges = call.fromRanges.map((r) => this.mapRange(r));

    const id = `out:${parentItemId}->${to.id}`;

    return {
      id,
      to,
      fromRanges,
      parentItemId,
      providerId: context.providerId,
      providerGeneration: context.providerGeneration,
    };
  }

  /**
   * Converts a canonical Call Hierarchy item into a navigable Location (targeting its selectionRange).
   */
  public static itemToLocation(item: QmCallHierarchyItem): Location {
    return {
      uri: item.uri,
      range: item.selectionRange,
      selectionRange: item.selectionRange,
    };
  }

  /**
   * Converts a call-site range into a navigable Location within the caller's document.
   */
  public static callSiteToLocation(item: QmCallHierarchyItem, callSiteRange: Range): Location {
    return {
      uri: item.uri,
      range: callSiteRange,
      selectionRange: callSiteRange,
    };
  }
}
