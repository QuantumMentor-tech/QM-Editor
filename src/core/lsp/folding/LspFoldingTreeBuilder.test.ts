/**
 * QM Editor — LSP Folding Tree Builder Tests
 * Phase 06, Step 68 — LSP Folding Ranges, Smart Code Folding & Safe Document Structure Navigation
 */

import { describe, it, expect } from 'vitest';
import { LspFoldingTreeBuilder } from './LspFoldingTreeBuilder';
import { CanonicalFoldingRange } from './LspFoldingTypes';

function createRange(startLine: number, endLine: number, kind?: string): CanonicalFoldingRange {
  return {
    id: `fold:test:${startLine}:${endLine}:${kind || 'generic'}:1`,
    documentUri: 'file:///test.ts',
    startLine,
    endLine,
    from: startLine * 20,
    to: endLine * 20 + 10,
    kind,
    providerId: 'test-provider',
    providerGeneration: 1,
    documentRevision: 1,
    source: 'lsp',
  };
}

describe('LspFoldingTreeBuilder', () => {
  it('returns empty roots when given empty array', () => {
    const tree = LspFoldingTreeBuilder.buildTree([]);
    expect(tree.roots).toEqual([]);
    expect(tree.allRanges).toEqual([]);
  });

  it('builds flat tree for sibling non-overlapping ranges', () => {
    const ranges = [
      createRange(0, 10),
      createRange(12, 20),
      createRange(25, 30),
    ];

    const tree = LspFoldingTreeBuilder.buildTree(ranges);
    expect(tree.roots).toHaveLength(3);
    expect(tree.allRanges).toHaveLength(3);
    expect(tree.roots[0].range.startLine).toBe(0);
    expect(tree.roots[1].range.startLine).toBe(12);
    expect(tree.roots[2].range.startLine).toBe(25);
  });

  it('builds nested hierarchy for enclosed ranges', () => {
    // Class A (0-20), Method B (2-10), Conditional C (11-18)
    const ranges = [
      createRange(2, 10, 'region'),
      createRange(0, 20, 'region'),
      createRange(11, 18, 'region'),
    ];

    const tree = LspFoldingTreeBuilder.buildTree(ranges);
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].range.startLine).toBe(0);
    expect(tree.roots[0].children).toHaveLength(2);
    expect(tree.roots[0].children[0].range.startLine).toBe(2);
    expect(tree.roots[0].children[1].range.startLine).toBe(11);
    expect(tree.allRanges).toHaveLength(3);
  });

  it('eliminates exact duplicate ranges', () => {
    const ranges = [
      createRange(0, 10, 'comment'),
      createRange(0, 10, 'comment'),
      createRange(0, 10, 'comment'),
    ];

    const tree = LspFoldingTreeBuilder.buildTree(ranges);
    expect(tree.roots).toHaveLength(1);
    expect(tree.allRanges).toHaveLength(1);
  });

  it('discards overlapping non-nested ranges to preserve structural tree integrity', () => {
    // Range A: 0-10
    // Range B: 5-15 (starts inside A, ends outside A -> illegal partial overlap)
    const ranges = [
      createRange(0, 10),
      createRange(5, 15),
    ];

    const tree = LspFoldingTreeBuilder.buildTree(ranges);
    // Outer range A should be retained, conflicting overlapping range B discarded
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].range.startLine).toBe(0);
    expect(tree.roots[0].range.endLine).toBe(10);
    expect(tree.allRanges).toHaveLength(1);
  });

  it('handles multi-level deep nesting correctly', () => {
    const ranges = [
      createRange(0, 50),
      createRange(5, 40),
      createRange(10, 30),
      createRange(15, 20),
    ];

    const tree = LspFoldingTreeBuilder.buildTree(ranges);
    expect(tree.roots).toHaveLength(1);
    const l1 = tree.roots[0];
    expect(l1.range.startLine).toBe(0);
    expect(l1.children).toHaveLength(1);

    const l2 = l1.children[0];
    expect(l2.range.startLine).toBe(5);
    expect(l2.children).toHaveLength(1);

    const l3 = l2.children[0];
    expect(l3.range.startLine).toBe(10);
    expect(l3.children).toHaveLength(1);

    const l4 = l3.children[0];
    expect(l4.range.startLine).toBe(15);
    expect(l4.children).toHaveLength(0);
  });
});
