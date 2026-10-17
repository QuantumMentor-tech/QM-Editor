/**
 * QM Editor — LSP Folding Tree Builder
 * Phase 06, Step 68 — LSP Folding Ranges, Smart Code Folding & Safe Document Structure Navigation
 * 
 * Constructs a normalized, strictly-nested fold hierarchy from validated folding ranges.
 * Eliminates duplicates, resolves non-nested overlaps safely, and limits nesting depth.
 */

import { CanonicalFoldingRange, FoldingTreeNode, FoldingRangeTree } from './LspFoldingTypes';
import { LspFoldingValidator } from './LspFoldingValidator';
import { Logger } from '../../../utils/logger';

export class LspFoldingTreeBuilder {
  /**
   * Builds a normalized folding tree from canonical folding ranges.
   * Uses an efficient O(N log N) stack-based algorithm.
   */
  public static buildTree(ranges: CanonicalFoldingRange[]): FoldingRangeTree {
    if (!ranges || ranges.length === 0) {
      return { roots: [], allRanges: [] };
    }

    // 1. Deduplicate exact duplicate ranges (same startLine, endLine, kind)
    const uniqueMap = new Map<string, CanonicalFoldingRange>();
    for (const r of ranges) {
      const key = `${r.startLine}:${r.endLine}:${r.kind || ''}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, r);
      }
    }
    const deduplicated = Array.from(uniqueMap.values());

    // 2. Sort ranges: primary startLine ASC, secondary endLine DESC (outermost first)
    deduplicated.sort((a, b) => {
      if (a.startLine !== b.startLine) {
        return a.startLine - b.startLine;
      }
      return b.endLine - a.endLine;
    });

    const roots: FoldingTreeNode[] = [];
    const stack: FoldingTreeNode[] = [];
    const acceptedRanges: CanonicalFoldingRange[] = [];

    // 3. Stack-based hierarchical nesting
    for (const range of deduplicated) {
      const node: FoldingTreeNode = {
        range,
        children: [],
      };

      // Pop items from stack that do not enclose range (stack top ends before range starts)
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.range.endLine < range.startLine) {
          stack.pop();
        } else {
          break;
        }
      }

      if (stack.length === 0) {
        // Root-level range
        roots.push(node);
        stack.push(node);
        acceptedRanges.push(range);
      } else {
        const top = stack[stack.length - 1];

        // Check if range is strictly enclosed within top
        if (range.endLine <= top.range.endLine) {
          // Check depth limit
          if (stack.length < LspFoldingValidator.MAX_NESTING_DEPTH) {
            node.parent = top;
            top.children.push(node);
            stack.push(node);
            acceptedRanges.push(range);
          } else {
            Logger.warn('LspFoldingTreeBuilder: Dropping range exceeding maximum nesting depth', {
              startLine: range.startLine,
              endLine: range.endLine,
              depth: stack.length,
            });
          }
        } else {
          // Non-nested partial overlap: range starts inside top, but ends after top!
          // In text editor folding, partially intersecting folds are illegal.
          // Discard range to preserve outer structural fold integrity.
          Logger.warn('LspFoldingTreeBuilder: Discarding overlapping non-nested fold range', {
            enclosing: { start: top.range.startLine, end: top.range.endLine },
            conflicting: { start: range.startLine, end: range.endLine },
          });
        }
      }
    }

    return {
      roots,
      allRanges: acceptedRanges,
    };
  }
}
