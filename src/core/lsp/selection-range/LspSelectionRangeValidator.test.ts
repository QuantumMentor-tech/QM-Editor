/**
 * QM Editor — LSP Selection Range Validator Tests
 * Phase 06, Step 69 — LSP Selection Ranges, Smart Structural Selection & Context-Aware Cursor Expansion
 */

import { describe, it, expect } from 'vitest';
import { LspSelectionRangeValidator } from './LspSelectionRangeValidator';
import { LspRange } from '../LspTypes';

describe('LspSelectionRangeValidator', () => {
  describe('validatePosition', () => {
    it('validates correct non-negative integer positions', () => {
      const res1 = LspSelectionRangeValidator.validatePosition({ line: 0, character: 0 });
      expect(res1.valid).toBe(true);
      expect(res1.value).toEqual({ line: 0, character: 0 });

      const res2 = LspSelectionRangeValidator.validatePosition({ line: 42, character: 15 });
      expect(res2.valid).toBe(true);
      expect(res2.value).toEqual({ line: 42, character: 15 });
    });

    it('rejects negative, floating-point, or non-object positions', () => {
      expect(LspSelectionRangeValidator.validatePosition(null).valid).toBe(false);
      expect(LspSelectionRangeValidator.validatePosition(undefined).valid).toBe(false);
      expect(LspSelectionRangeValidator.validatePosition('0:0').valid).toBe(false);
      expect(LspSelectionRangeValidator.validatePosition({ line: -1, character: 0 }).valid).toBe(false);
      expect(LspSelectionRangeValidator.validatePosition({ line: 0, character: -5 }).valid).toBe(false);
      expect(LspSelectionRangeValidator.validatePosition({ line: 1.5, character: 0 }).valid).toBe(false);
      expect(LspSelectionRangeValidator.validatePosition({ line: 0, character: 3.14 }).valid).toBe(false);
    });
  });

  describe('validateRange', () => {
    it('validates a standard range where start <= end', () => {
      const validRange: LspRange = {
        start: { line: 1, character: 2 },
        end: { line: 1, character: 10 },
      };
      const res = LspSelectionRangeValidator.validateRange(validRange);
      expect(res.valid).toBe(true);
      expect(res.value).toEqual(validRange);
    });

    it('validates a zero-width range where start == end', () => {
      const zeroRange: LspRange = {
        start: { line: 5, character: 4 },
        end: { line: 5, character: 4 },
      };
      const res = LspSelectionRangeValidator.validateRange(zeroRange);
      expect(res.valid).toBe(true);
    });

    it('rejects inverted range where start > end', () => {
      const invertedLine: LspRange = {
        start: { line: 5, character: 0 },
        end: { line: 2, character: 0 },
      };
      expect(LspSelectionRangeValidator.validateRange(invertedLine).valid).toBe(false);

      const invertedChar: LspRange = {
        start: { line: 3, character: 10 },
        end: { line: 3, character: 2 },
      };
      expect(LspSelectionRangeValidator.validateRange(invertedChar).valid).toBe(false);
    });
  });

  describe('doesParentEncloseChild', () => {
    it('returns true when parent strictly encloses child', () => {
      const parent: LspRange = { start: { line: 0, character: 0 }, end: { line: 10, character: 20 } };
      const child: LspRange = { start: { line: 2, character: 4 }, end: { line: 2, character: 10 } };
      expect(LspSelectionRangeValidator.doesParentEncloseChild(parent, child)).toBe(true);
    });

    it('returns true when parent equals child coordinates', () => {
      const range: LspRange = { start: { line: 1, character: 2 }, end: { line: 1, character: 8 } };
      expect(LspSelectionRangeValidator.doesParentEncloseChild(range, range)).toBe(true);
    });

    it('returns false when child extends beyond parent', () => {
      const parent: LspRange = { start: { line: 2, character: 0 }, end: { line: 5, character: 0 } };
      const childBefore: LspRange = { start: { line: 1, character: 0 }, end: { line: 4, character: 0 } };
      const childAfter: LspRange = { start: { line: 3, character: 0 }, end: { line: 6, character: 0 } };

      expect(LspSelectionRangeValidator.doesParentEncloseChild(parent, childBefore)).toBe(false);
      expect(LspSelectionRangeValidator.doesParentEncloseChild(parent, childAfter)).toBe(false);
    });
  });

  describe('validateHierarchy', () => {
    it('validates a simple nested hierarchy (word -> statement -> function)', () => {
      const raw = {
        range: { start: { line: 2, character: 4 }, end: { line: 2, character: 10 } },
        parent: {
          range: { start: { line: 2, character: 0 }, end: { line: 2, character: 20 } },
          parent: {
            range: { start: { line: 1, character: 0 }, end: { line: 5, character: 1 } },
          },
        },
      };

      const validated = LspSelectionRangeValidator.validateHierarchy(raw);
      expect(validated).not.toBeNull();
      expect(validated?.range).toEqual({ start: { line: 2, character: 4 }, end: { line: 2, character: 10 } });
      expect(validated?.parent?.range).toEqual({ start: { line: 2, character: 0 }, end: { line: 2, character: 20 } });
      expect(validated?.parent?.parent?.range).toEqual({ start: { line: 1, character: 0 }, end: { line: 5, character: 1 } });
      expect(validated?.parent?.parent?.parent).toBeUndefined();
    });

    it('safely handles self-referential ranges (range.parent = range)', () => {
      const raw: any = {
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
      };
      raw.parent = raw; // Direct self-reference

      const validated = LspSelectionRangeValidator.validateHierarchy(raw);
      expect(validated).not.toBeNull();
      expect(validated?.range).toEqual({ start: { line: 1, character: 0 }, end: { line: 1, character: 10 } });
      expect(validated?.parent).toBeUndefined();
    });

    it('detects cycles (A -> B -> C -> A) and truncates safely', () => {
      const nodeA: any = { range: { start: { line: 2, character: 2 }, end: { line: 2, character: 5 } } };
      const nodeB: any = { range: { start: { line: 2, character: 0 }, end: { line: 2, character: 10 } } };
      const nodeC: any = { range: { start: { line: 1, character: 0 }, end: { line: 3, character: 0 } } };

      nodeA.parent = nodeB;
      nodeB.parent = nodeC;
      nodeC.parent = nodeA; // Cycle back to A

      const validated = LspSelectionRangeValidator.validateHierarchy(nodeA);
      expect(validated).not.toBeNull();
      expect(validated?.range).toEqual(nodeA.range);
      expect(validated?.parent?.range).toEqual(nodeB.range);
      expect(validated?.parent?.parent?.range).toEqual(nodeC.range);
      expect(validated?.parent?.parent?.parent).toBeUndefined(); // Cycle safely truncated!
    });

    it('collapses duplicate adjacent ranges', () => {
      const raw = {
        range: { start: { line: 2, character: 4 }, end: { line: 2, character: 10 } },
        parent: {
          range: { start: { line: 2, character: 4 }, end: { line: 2, character: 10 } }, // Duplicate!
          parent: {
            range: { start: { line: 1, character: 0 }, end: { line: 3, character: 0 } },
          },
        },
      };

      const validated = LspSelectionRangeValidator.validateHierarchy(raw);
      expect(validated).not.toBeNull();
      expect(validated?.range).toEqual({ start: { line: 2, character: 4 }, end: { line: 2, character: 10 } });
      // The duplicate was collapsed directly to the outer enclosing range
      expect(validated?.parent?.range).toEqual({ start: { line: 1, character: 0 }, end: { line: 3, character: 0 } });
      expect(validated?.parent?.parent).toBeUndefined();
    });

    it('clamps at maxDepth to protect against stack exhaustion', () => {
      let current: any = { range: { start: { line: 100, character: 0 }, end: { line: 100, character: 1 } } };
      const root = current;

      for (let i = 1; i <= 30; i++) {
        const next: any = {
          range: { start: { line: 100 - i, character: 0 }, end: { line: 100 + i, character: 0 } },
        };
        current.parent = next;
        current = next;
      }

      const validated = LspSelectionRangeValidator.validateHierarchy(root, 10);
      let depth = 0;
      let node: any = validated;
      while (node) {
        depth++;
        node = node.parent;
      }

      expect(depth).toBe(10);
    });

    it('discards broken parent relationships that do not enclose child', () => {
      const raw = {
        range: { start: { line: 5, character: 0 }, end: { line: 5, character: 10 } },
        parent: {
          range: { start: { line: 10, character: 0 }, end: { line: 15, character: 0 } }, // Broken disjoint parent!
        },
      };

      const validated = LspSelectionRangeValidator.validateHierarchy(raw);
      expect(validated).not.toBeNull();
      expect(validated?.range).toEqual({ start: { line: 5, character: 0 }, end: { line: 5, character: 10 } });
      expect(validated?.parent).toBeUndefined();
    });
  });

  describe('validateSelectionRangeResponse', () => {
    it('maps multiple positions 1-to-1 preserving order and handling partial failures', () => {
      const rawResponse = [
        {
          range: { start: { line: 1, character: 2 }, end: { line: 1, character: 8 } },
        },
        null, // Malformed position
        {
          range: { start: { line: 10, character: 0 }, end: { line: 10, character: 5 } },
        },
      ];

      const validated = LspSelectionRangeValidator.validateSelectionRangeResponse(rawResponse, 3);
      expect(validated).toHaveLength(3);
      expect(validated[0]?.range).toEqual({ start: { line: 1, character: 2 }, end: { line: 1, character: 8 } });
      expect(validated[1]).toBeNull();
      expect(validated[2]?.range).toEqual({ start: { line: 10, character: 0 }, end: { line: 10, character: 5 } });
    });
  });
});
