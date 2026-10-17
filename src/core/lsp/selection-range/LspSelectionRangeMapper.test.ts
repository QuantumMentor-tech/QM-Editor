/**
 * QM Editor — LSP Selection Range Mapper Tests
 * Phase 06, Step 69 — LSP Selection Ranges, Smart Structural Selection & Context-Aware Cursor Expansion
 */

import { describe, it, expect } from 'vitest';
import { LspSelectionRangeMapper } from './LspSelectionRangeMapper';
import { CanonicalSelectionRange } from './LspSelectionRangeTypes';

describe('LspSelectionRangeMapper', () => {
  const sampleContent = 'const greeting = "Hello";\nfunction test() {\n  return 42;\n}\n';

  describe('computeLineOffsets & positionToOffset / offsetToLspPosition', () => {
    it('computes line starting offsets accurately', () => {
      const offsets = LspSelectionRangeMapper.computeLineOffsets(sampleContent);
      // Line 0: "const greeting = "Hello";\n" -> length 26
      // Line 1 starts at 26
      expect(offsets.lineStarts[0]).toBe(0);
      expect(offsets.lineStarts[1]).toBe(26);
      expect(offsets.contentLength).toBe(sampleContent.length);
    });

    it('converts position to character offset and back bijectively', () => {
      const offsets = LspSelectionRangeMapper.computeLineOffsets(sampleContent);

      // Line 0, character 6 -> start of "greeting"
      const offset = LspSelectionRangeMapper.positionToOffset({ line: 0, character: 6 }, offsets);
      expect(offset).toBe(6);
      expect(sampleContent.substring(offset, offset + 8)).toBe('greeting');

      const pos = LspSelectionRangeMapper.offsetToLspPosition(offset, offsets);
      expect(pos).toEqual({ line: 0, character: 6 });

      // Line 2, character 9 -> "42"
      const offset42 = LspSelectionRangeMapper.positionToOffset({ line: 2, character: 9 }, offsets);
      expect(sampleContent.substring(offset42, offset42 + 2)).toBe('42');

      const pos42 = LspSelectionRangeMapper.offsetToLspPosition(offset42, offsets);
      expect(pos42).toEqual({ line: 2, character: 9 });
    });
  });

  describe('mapToCanonicalRange & mapToOffsetRange', () => {
    it('converts 0-based LSP range to 1-based canonical Range', () => {
      const lspRange = {
        start: { line: 0, character: 6 },
        end: { line: 0, character: 14 },
      };

      const canonical = LspSelectionRangeMapper.mapToCanonicalRange(lspRange);
      expect(canonical).toEqual({
        startLine: 1,
        startColumn: 7,
        endLine: 1,
        endColumn: 15,
      });
    });

    it('converts 0-based LSP range to buffer character offsets', () => {
      const offsets = LspSelectionRangeMapper.computeLineOffsets(sampleContent);
      const lspRange = {
        start: { line: 0, character: 6 },
        end: { line: 0, character: 14 },
      };

      const offsetRange = LspSelectionRangeMapper.mapToOffsetRange(lspRange, offsets);
      expect(offsetRange).toEqual({ from: 6, to: 14 });
      expect(sampleContent.substring(offsetRange.from, offsetRange.to)).toBe('greeting');
    });
  });

  describe('flattenHierarchy', () => {
    it('flattens a linked CanonicalSelectionRange chain into ordered array', () => {
      const c: CanonicalSelectionRange = {
        id: '3',
        documentId: 'doc1',
        resourceId: 'res1',
        workspaceId: 'ws1',
        range: { startLine: 1, startColumn: 1, endLine: 4, endColumn: 2 },
        offsetRange: { from: 0, to: 60 },
        providerId: 'p1',
        providerGeneration: 1,
        documentRevision: 1,
        source: 'lsp',
      };
      const b: CanonicalSelectionRange = {
        id: '2',
        documentId: 'doc1',
        resourceId: 'res1',
        workspaceId: 'ws1',
        range: { startLine: 2, startColumn: 1, endLine: 4, endColumn: 2 },
        offsetRange: { from: 26, to: 60 },
        parent: c,
        providerId: 'p1',
        providerGeneration: 1,
        documentRevision: 1,
        source: 'lsp',
      };
      const a: CanonicalSelectionRange = {
        id: '1',
        documentId: 'doc1',
        resourceId: 'res1',
        workspaceId: 'ws1',
        range: { startLine: 3, startColumn: 3, endLine: 3, endColumn: 13 },
        offsetRange: { from: 46, to: 56 },
        parent: b,
        providerId: 'p1',
        providerGeneration: 1,
        documentRevision: 1,
        source: 'lsp',
      };

      const flattened = LspSelectionRangeMapper.flattenHierarchy(a);
      expect(flattened).toHaveLength(3);
      expect(flattened[0].id).toBe('1');
      expect(flattened[1].id).toBe('2');
      expect(flattened[2].id).toBe('3');
    });
  });

  describe('findNextContainingRange', () => {
    const hierarchy: CanonicalSelectionRange[] = [
      {
        id: 'word',
        documentId: 'doc1',
        resourceId: 'res1',
        workspaceId: 'ws1',
        range: { startLine: 3, startColumn: 10, endLine: 3, endColumn: 12 },
        offsetRange: { from: 53, to: 55 }, // "42"
        providerId: 'p1',
        providerGeneration: 1,
        documentRevision: 1,
        source: 'lsp',
      },
      {
        id: 'statement',
        documentId: 'doc1',
        resourceId: 'res1',
        workspaceId: 'ws1',
        range: { startLine: 3, startColumn: 3, endLine: 3, endColumn: 13 },
        offsetRange: { from: 46, to: 56 }, // "return 42;"
        providerId: 'p1',
        providerGeneration: 1,
        documentRevision: 1,
        source: 'lsp',
      },
      {
        id: 'function',
        documentId: 'doc1',
        resourceId: 'res1',
        workspaceId: 'ws1',
        range: { startLine: 2, startColumn: 1, endLine: 4, endColumn: 2 },
        offsetRange: { from: 26, to: 60 }, // "function test() { ... }"
        providerId: 'p1',
        providerGeneration: 1,
        documentRevision: 1,
        source: 'lsp',
      },
    ];

    it('expands cursor to smallest enclosing structural range', () => {
      // Cursor is at 53 (beginning of "42")
      const next = LspSelectionRangeMapper.findNextContainingRange(hierarchy, 53, 53);
      expect(next).not.toBeNull();
      expect(next?.id).toBe('word');
      expect(next?.offsetRange).toEqual({ from: 53, to: 55 });
    });

    it('expands word selection to next strictly larger range (statement)', () => {
      // Word "42" is selected
      const next = LspSelectionRangeMapper.findNextContainingRange(hierarchy, 53, 55);
      expect(next).not.toBeNull();
      expect(next?.id).toBe('statement');
      expect(next?.offsetRange).toEqual({ from: 46, to: 56 });
    });

    it('expands statement selection to function block', () => {
      // Statement "return 42;" is selected
      const next = LspSelectionRangeMapper.findNextContainingRange(hierarchy, 46, 56);
      expect(next).not.toBeNull();
      expect(next?.id).toBe('function');
      expect(next?.offsetRange).toEqual({ from: 26, to: 60 });
    });

    it('returns null when outermost structural range is already selected', () => {
      // Entire function is selected
      const next = LspSelectionRangeMapper.findNextContainingRange(hierarchy, 26, 60);
      expect(next).toBeNull();
    });
  });
});
