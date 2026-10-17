/**
 * QM Editor — LSP Selection Range Mapper
 * Phase 06, Step 69 — LSP Selection Ranges, Smart Structural Selection & Context-Aware Cursor Expansion
 *
 * Maps validated LSP selection ranges into canonical editor selections:
 * - 0-based LSP coordinates to 1-based Document Ranges
 * - 0-based LSP coordinates to CodeMirror buffer character offsets
 * - Tree/chain representation to flattened, ordered structural expansion hierarchies
 * - Containment-aware selection lookup for progressive expansion
 */

import { Range } from '../../navigation/LocationTypes';
import { OffsetRange } from '../../editor/EditorTypes';
import { LspPosition, LspRange } from '../LspTypes';
import { CanonicalSelectionRange } from './LspSelectionRangeTypes';
import { ValidatedRangeNode } from './LspSelectionRangeValidator';

export interface DocumentLineOffsets {
  lineStarts: number[];
  contentLength: number;
}

export class LspSelectionRangeMapper {
  /**
   * Precomputes line starting character offsets for fast O(1) position-to-offset conversion.
   */
  public static computeLineOffsets(content: string): DocumentLineOffsets {
    const lineStarts = [0];
    const len = content.length;

    for (let i = 0; i < len; i++) {
      if (content.charCodeAt(i) === 10) {
        // '\n'
        lineStarts.push(i + 1);
      }
    }

    return { lineStarts, contentLength: len };
  }

  /**
   * Converts a 0-based LSP Position to a 0-based buffer character offset.
   */
  public static positionToOffset(pos: LspPosition, offsets: DocumentLineOffsets): number {
    const { lineStarts, contentLength } = offsets;
    if (lineStarts.length === 0) return 0;

    const safeLine = Math.max(0, Math.min(pos.line, lineStarts.length - 1));
    const lineStart = lineStarts[safeLine];
    const nextLineStart = safeLine + 1 < lineStarts.length ? lineStarts[safeLine + 1] : contentLength + 1;
    const maxChar = Math.max(0, nextLineStart - lineStart - 1);

    const safeChar = Math.max(0, Math.min(pos.character, maxChar));
    return Math.min(contentLength, lineStart + safeChar);
  }

  /**
   * Converts a 0-based buffer character offset to a 0-based LSP Position.
   */
  public static offsetToLspPosition(offset: number, offsets: DocumentLineOffsets): LspPosition {
    const { lineStarts, contentLength } = offsets;
    const safeOffset = Math.max(0, Math.min(offset, contentLength));

    // Binary search for the line index
    let low = 0;
    let high = lineStarts.length - 1;
    let line = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lineStarts[mid] <= safeOffset) {
        line = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const character = safeOffset - lineStarts[line];
    return { line, character };
  }

  /**
   * Converts a 0-based LSP range into a 1-based canonical Range.
   */
  public static mapToCanonicalRange(lspRange: LspRange): Range {
    return {
      startLine: lspRange.start.line + 1,
      startColumn: lspRange.start.character + 1,
      endLine: lspRange.end.line + 1,
      endColumn: lspRange.end.character + 1,
    };
  }

  /**
   * Converts a 0-based LSP range into CodeMirror character offset bounds.
   */
  public static mapToOffsetRange(lspRange: LspRange, offsets: DocumentLineOffsets): OffsetRange {
    const from = this.positionToOffset(lspRange.start, offsets);
    const to = Math.max(from, this.positionToOffset(lspRange.end, offsets));
    return { from, to };
  }

  /**
   * Maps a validated node hierarchy into a linked CanonicalSelectionRange structure.
   */
  public static mapToCanonicalHierarchy(
    rootNode: ValidatedRangeNode | null,
    context: {
      documentId: string;
      resourceId: string;
      workspaceId: string;
      providerId: string;
      providerGeneration: number;
      documentRevision: number;
      offsets: DocumentLineOffsets;
    }
  ): CanonicalSelectionRange | null {
    if (!rootNode) return null;

    let idCounter = 1;

    // Iteratively build the canonical chain
    const buildCanonical = (node: ValidatedRangeNode): CanonicalSelectionRange => {
      const canonicalRange = this.mapToCanonicalRange(node.range);
      const offsetRange = this.mapToOffsetRange(node.range, context.offsets);

      const canonical: CanonicalSelectionRange = {
        id: `sel_range_${context.documentId}_${idCounter++}`,
        documentId: context.documentId,
        resourceId: context.resourceId,
        workspaceId: context.workspaceId,
        range: canonicalRange,
        offsetRange,
        providerId: context.providerId,
        providerGeneration: context.providerGeneration,
        documentRevision: context.documentRevision,
        source: 'lsp',
      };

      if (node.parent) {
        canonical.parent = buildCanonical(node.parent);
      }

      return canonical;
    };

    return buildCanonical(rootNode);
  }

  /**
   * Flattens a canonical hierarchy into an ordered array from smallest to largest enclosing range.
   */
  public static flattenHierarchy(root: CanonicalSelectionRange | null): CanonicalSelectionRange[] {
    const result: CanonicalSelectionRange[] = [];
    let current: CanonicalSelectionRange | undefined = root || undefined;

    while (current) {
      result.push(current);
      current = current.parent;
    }

    return result;
  }

  /**
   * Finds the next containing range in the hierarchy that is strictly larger than the current selection.
   *
   * @param hierarchy Ordered list of structural ranges from smallest to largest
   * @param currentFrom Active selection start offset (0-based)
   * @param currentTo Active selection end offset (0-based)
   * @returns Next strictly larger CanonicalSelectionRange, or null if hierarchy is exhausted
   */
  public static findNextContainingRange(
    hierarchy: CanonicalSelectionRange[],
    currentFrom: number,
    currentTo: number
  ): CanonicalSelectionRange | null {
    if (hierarchy.length === 0) return null;

    const selFrom = Math.min(currentFrom, currentTo);
    const selTo = Math.max(currentFrom, currentTo);
    const isCursor = selFrom === selTo;

    for (const item of hierarchy) {
      const { from, to } = item.offsetRange;

      if (isCursor) {
        // For a cursor, find the smallest range that contains the cursor
        if (from <= selFrom && to >= selTo) {
          // If range is non-empty, or if it is the only range available
          if (to > from || (from === selFrom && to === selTo)) {
            return item;
          }
        }
      } else {
        // Active selection: find next strictly larger containing range
        if (from <= selFrom && to >= selTo) {
          if (from < selFrom || to > selTo) {
            return item;
          }
        }
      }
    }

    return null;
  }
}
