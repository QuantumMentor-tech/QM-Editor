/**
 * QM Editor — LSP Selection Range Validator
 * Phase 06, Step 69 — LSP Selection Ranges, Smart Structural Selection & Context-Aware Cursor Expansion
 *
 * Implements strict, defensive validation of untrusted language server selection ranges:
 * - Position & range coordinate sanity (non-negative integers, start <= end)
 * - Parent containment verification (parent must strictly enclose or equal child)
 * - Cycle & self-reference detection via visited fingerprint Set
 * - Safe iterative traversal bounded by MAX_DEPTH to prevent stack exhaustion
 * - Deduplication of adjacent identical ranges
 */

import { LspPosition, LspRange } from '../LspTypes';

export interface ValidatedRangeNode {
  range: LspRange;
  parent?: ValidatedRangeNode;
}

export interface RangeValidationResult {
  valid: boolean;
  error?: string;
  value?: LspRange;
}

export interface PositionValidationResult {
  valid: boolean;
  error?: string;
  value?: LspPosition;
}

export class LspSelectionRangeValidator {
  public static readonly DEFAULT_MAX_DEPTH = 50;

  /**
   * Validates an LSP 0-based position coordinate.
   */
  public static validatePosition(pos: unknown): PositionValidationResult {
    if (!pos || typeof pos !== 'object') {
      return { valid: false, error: 'Position must be a defined object.' };
    }

    const { line, character } = pos as Record<string, unknown>;
    if (
      typeof line !== 'number' ||
      !Number.isInteger(line) ||
      line < 0 ||
      typeof character !== 'number' ||
      !Number.isInteger(character) ||
      character < 0
    ) {
      return { valid: false, error: 'Position coordinates must be non-negative integers.' };
    }

    return { valid: true, value: { line, character } };
  }

  /**
   * Validates an LSP 0-based range. Verifies start <= end.
   */
  public static validateRange(range: unknown): RangeValidationResult {
    if (!range || typeof range !== 'object') {
      return { valid: false, error: 'Range must be a defined object.' };
    }

    const r = range as Record<string, unknown>;
    const startVal = this.validatePosition(r.start);
    if (!startVal.valid || !startVal.value) {
      return { valid: false, error: `Invalid start position: ${startVal.error}` };
    }

    const endVal = this.validatePosition(r.end);
    if (!endVal.valid || !endVal.value) {
      return { valid: false, error: `Invalid end position: ${endVal.error}` };
    }

    const start = startVal.value;
    const end = endVal.value;

    if (start.line > end.line || (start.line === end.line && start.character > end.character)) {
      return { valid: false, error: 'Range start must precede or equal range end.' };
    }

    return { valid: true, value: { start, end } };
  }

  /**
   * Compares two positions.
   * Returns:
   *   -1 if a < b
   *    0 if a == b
   *    1 if a > b
   */
  public static comparePositions(a: LspPosition, b: LspPosition): number {
    if (a.line < b.line) return -1;
    if (a.line > b.line) return 1;
    if (a.character < b.character) return -1;
    if (a.character > b.character) return 1;
    return 0;
  }

  /**
   * Checks whether two ranges are identical in coordinates.
   */
  public static areRangesEqual(a: LspRange, b: LspRange): boolean {
    return (
      a.start.line === b.start.line &&
      a.start.character === b.start.character &&
      a.end.line === b.end.line &&
      a.end.character === b.end.character
    );
  }

  /**
   * Checks whether parentRange properly encloses childRange.
   * Parent encloses child if parent.start <= child.start AND parent.end >= child.end.
   */
  public static doesParentEncloseChild(parent: LspRange, child: LspRange): boolean {
    const startComp = this.comparePositions(parent.start, child.start);
    const endComp = this.comparePositions(parent.end, child.end);
    return startComp <= 0 && endComp >= 0;
  }

  /**
   * Produces a string fingerprint for cycle and duplicate detection.
   */
  public static getRangeKey(range: LspRange): string {
    return `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
  }

  /**
   * Iteratively validates and normalizes an untrusted LSP SelectionRange hierarchy.
   *
   * Security & Integrity guarantees:
   * 1. Iterative traversal (stack-overflow immune)
   * 2. Strict bounds checking on lines/characters
   * 3. Cycle & self-reference detection via visited Set
   * 4. Safe truncation if depth exceeds maxDepth
   * 5. Parent containment enforcement (drops broken parent branches)
   * 6. Duplicate range elimination (collapses identical adjacent ranges)
   */
  public static validateHierarchy(
    root: unknown,
    maxDepth: number = this.DEFAULT_MAX_DEPTH
  ): ValidatedRangeNode | null {
    if (!root || typeof root !== 'object') {
      return null;
    }

    const visited = new Set<string>();
    let currentRaw: any = root;
    let depth = 0;

    let headNode: ValidatedRangeNode | null = null;
    let currentValidNode: ValidatedRangeNode | null = null;

    while (currentRaw && typeof currentRaw === 'object' && depth < maxDepth) {
      depth++;

      const rangeVal = this.validateRange(currentRaw.range);
      if (!rangeVal.valid || !rangeVal.value) {
        // Invalid range boundary; terminate chain here safely
        break;
      }

      const validRange = rangeVal.value;
      const key = this.getRangeKey(validRange);

      // Check if this parent level is identical to the current child (duplicate level)
      if (currentValidNode && this.areRangesEqual(currentValidNode.range, validRange)) {
        currentRaw = currentRaw.parent;
        continue;
      }

      // Cycle or self-reference detection
      if (visited.has(key)) {
        // Cycle detected; terminate traversal and keep safe prefix
        break;
      }
      visited.add(key);

      // If we already have a previous node in the hierarchy, check parent containment
      if (currentValidNode) {
        // Parent must strictly enclose child
        if (!this.doesParentEncloseChild(validRange, currentValidNode.range)) {
          // Broken parent relationship; stop chain safely
          break;
        }

        const nextNode: ValidatedRangeNode = { range: validRange };
        currentValidNode.parent = nextNode;
        currentValidNode = nextNode;
      } else {
        headNode = { range: validRange };
        currentValidNode = headNode;
      }

      // Check self-referencing object reference: currentRaw.parent === currentRaw
      if (currentRaw.parent === currentRaw) {
        break;
      }

      currentRaw = currentRaw.parent;
    }

    return headNode;
  }

  /**
   * Validates an array of selection ranges corresponding to one or more requested cursor positions.
   * Preserves 1-to-1 array mapping: if an item is invalid, null is placed in that slot.
   */
  public static validateSelectionRangeResponse(
    response: unknown,
    expectedCount: number,
    maxDepth: number = this.DEFAULT_MAX_DEPTH
  ): Array<ValidatedRangeNode | null> {
    if (!Array.isArray(response)) {
      return new Array(expectedCount).fill(null);
    }

    const results: Array<ValidatedRangeNode | null> = [];
    const count = Math.min(response.length, expectedCount);

    for (let i = 0; i < count; i++) {
      results.push(this.validateHierarchy(response[i], maxDepth));
    }

    // Fill any missing positions with null
    while (results.length < expectedCount) {
      results.push(null);
    }

    return results;
  }
}
