/**
 * QM Editor — LSP Call Hierarchy Validator Tests
 * Phase 06, Step 70 — LSP Call Hierarchy, Callers, Callees & Safe Cross-File Code Relationship Navigation
 */

import { describe, it, expect } from 'vitest';
import { LspCallHierarchyValidator } from './LspCallHierarchyValidator';
import { LspCallHierarchyItem, LspRange, LspSymbolKind, LspSymbolTag } from '../LspTypes';

describe('LspCallHierarchyValidator', () => {
  describe('validatePosition', () => {
    it('validates 0-based valid positions', () => {
      const res = LspCallHierarchyValidator.validatePosition({ line: 10, character: 5 });
      expect(res.valid).toBe(true);
      expect(res.value).toEqual({ line: 10, character: 5 });
    });

    it('rejects negative, non-integer, or non-object positions', () => {
      expect(LspCallHierarchyValidator.validatePosition(null).valid).toBe(false);
      expect(LspCallHierarchyValidator.validatePosition({ line: -1, character: 0 }).valid).toBe(false);
      expect(LspCallHierarchyValidator.validatePosition({ line: 0, character: -3 }).valid).toBe(false);
      expect(LspCallHierarchyValidator.validatePosition({ line: 1.5, character: 0 }).valid).toBe(false);
    });
  });

  describe('validateRange', () => {
    it('validates normal and zero-width ranges', () => {
      const normal: LspRange = {
        start: { line: 1, character: 0 },
        end: { line: 5, character: 10 },
      };
      expect(LspCallHierarchyValidator.validateRange(normal).valid).toBe(true);

      const zeroWidth: LspRange = {
        start: { line: 2, character: 4 },
        end: { line: 2, character: 4 },
      };
      expect(LspCallHierarchyValidator.validateRange(zeroWidth).valid).toBe(true);
    });

    it('rejects inverted ranges', () => {
      const invertedLine: LspRange = {
        start: { line: 5, character: 0 },
        end: { line: 2, character: 0 },
      };
      expect(LspCallHierarchyValidator.validateRange(invertedLine).valid).toBe(false);

      const invertedChar: LspRange = {
        start: { line: 2, character: 10 },
        end: { line: 2, character: 5 },
      };
      expect(LspCallHierarchyValidator.validateRange(invertedChar).valid).toBe(false);
    });
  });

  describe('validateUri', () => {
    it('accepts file, untitled, and memory URIs', () => {
      expect(LspCallHierarchyValidator.validateUri('file:///workspace/src/app.ts').valid).toBe(true);
      expect(LspCallHierarchyValidator.validateUri('untitled:123').valid).toBe(true);
      expect(LspCallHierarchyValidator.validateUri('qm-memory:/doc.ts').valid).toBe(true);
    });

    it('blocks dangerous or malformed URI schemes', () => {
      expect(LspCallHierarchyValidator.validateUri('javascript:alert(1)').valid).toBe(false);
      expect(LspCallHierarchyValidator.validateUri('command:workbench.action').valid).toBe(false);
      expect(LspCallHierarchyValidator.validateUri('data:text/html,<script>').valid).toBe(false);
      expect(LspCallHierarchyValidator.validateUri('').valid).toBe(false);
      expect(LspCallHierarchyValidator.validateUri(null).valid).toBe(false);
    });
  });

  describe('validateCallHierarchyItem', () => {
    const validRange: LspRange = {
      start: { line: 10, character: 0 },
      end: { line: 25, character: 1 },
    };
    const validSelectionRange: LspRange = {
      start: { line: 10, character: 9 },
      end: { line: 10, character: 17 },
    };

    it('validates a well-formed CallHierarchyItem', () => {
      const raw: LspCallHierarchyItem = {
        name: 'calculateTotal',
        kind: LspSymbolKind.Function,
        detail: '(items: Item[]) => number',
        uri: 'file:///workspace/src/checkout.ts',
        range: validRange,
        selectionRange: validSelectionRange,
        tags: [LspSymbolTag.Deprecated],
      };

      const res = LspCallHierarchyValidator.validateCallHierarchyItem(raw);
      expect(res.valid).toBe(true);
      expect(res.value?.name).toBe('calculateTotal');
      expect(res.value?.tags).toEqual([LspSymbolTag.Deprecated]);
    });

    it('normalizes selectionRange when it does not lie within range', () => {
      const outsideSelectionRange: LspRange = {
        start: { line: 30, character: 0 },
        end: { line: 35, character: 0 },
      };

      const raw: LspCallHierarchyItem = {
        name: 'calculateTotal',
        kind: LspSymbolKind.Function,
        uri: 'file:///workspace/src/checkout.ts',
        range: validRange,
        selectionRange: outsideSelectionRange,
      };

      const res = LspCallHierarchyValidator.validateCallHierarchyItem(raw);
      expect(res.valid).toBe(true);
      // Normalized to enclosing range
      expect(res.value?.selectionRange).toEqual(validRange);
    });

    it('rejects items with empty names or malformed ranges', () => {
      const emptyName = {
        name: '   ',
        kind: LspSymbolKind.Function,
        uri: 'file:///test.ts',
        range: validRange,
        selectionRange: validSelectionRange,
      };
      expect(LspCallHierarchyValidator.validateCallHierarchyItem(emptyName).valid).toBe(false);

      const invalidRange = {
        name: 'test',
        kind: LspSymbolKind.Function,
        uri: 'file:///test.ts',
        range: { start: { line: 10, character: 0 }, end: { line: 5, character: 0 } },
        selectionRange: validSelectionRange,
      };
      expect(LspCallHierarchyValidator.validateCallHierarchyItem(invalidRange).valid).toBe(false);
    });
  });

  describe('Cycle Detection & Fingerprinting', () => {
    it('computes stable fingerprints for items', () => {
      const item = {
        uri: 'file:///workspace/src/foo.ts',
        name: 'foo',
        range: { start: { line: 5, character: 0 }, end: { line: 12, character: 1 } },
      };
      const fp1 = LspCallHierarchyValidator.getItemFingerprint(item);
      const fp2 = LspCallHierarchyValidator.getItemFingerprint(item);
      expect(fp1).toBe(fp2);
      expect(fp1).toContain('foo');
      expect(fp1).toContain('5:0-12:1');
    });

    it('detects cycles when an item is already present in active ancestors', () => {
      const ancestorSet = new Set(['file:///workspace/src/foo.ts#foo#5:0-12:1']);
      expect(LspCallHierarchyValidator.isCycle('file:///workspace/src/foo.ts#foo#5:0-12:1', ancestorSet)).toBe(true);
      expect(LspCallHierarchyValidator.isCycle('file:///workspace/src/bar.ts#bar#20:0-25:1', ancestorSet)).toBe(false);
    });
  });
});
