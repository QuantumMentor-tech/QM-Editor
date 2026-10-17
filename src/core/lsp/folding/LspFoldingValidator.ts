/**
 * QM Editor — LSP Folding Range Validator & Security Quarantine
 * Phase 06, Step 68 — LSP Folding Ranges, Smart Code Folding & Safe Document Structure Navigation
 * 
 * Validates untrusted language server folding range boundaries, numeric properties,
 * sanitizes collapsed text, and enforces safety bounds against DoS.
 */

import { LspFoldingRange } from '../LspTypes';
import { Logger } from '../../../utils/logger';

export interface ValidatedFoldingRange {
  startLine: number;
  startCharacter?: number;
  endLine: number;
  endCharacter?: number;
  kind?: string;
  collapsedText?: string;
}

export class LspFoldingValidator {
  /** Maximum number of folding ranges accepted per document to protect editor responsiveness */
  public static readonly MAX_FOLDING_RANGES = 5000;

  /** Maximum character length permitted for server-provided collapsedText */
  public static readonly MAX_COLLAPSED_TEXT_LENGTH = 64;

  /** Maximum permitted nesting depth to avoid stack overflows or pathological trees */
  public static readonly MAX_NESTING_DEPTH = 50;

  /**
   * Validates an array of untrusted LSP folding ranges against document line bounds.
   * Discards invalid individual ranges non-fatally while preserving valid ones.
   */
  public static validateRanges(
    rawRanges: unknown,
    totalLines: number
  ): ValidatedFoldingRange[] {
    if (!Array.isArray(rawRanges)) {
      Logger.warn('LspFoldingValidator: Expected array of folding ranges, received non-array', {
        type: typeof rawRanges,
      });
      return [];
    }

    if (rawRanges.length === 0) {
      return [];
    }

    const validated: ValidatedFoldingRange[] = [];
    const count = Math.min(rawRanges.length, this.MAX_FOLDING_RANGES);

    if (rawRanges.length > this.MAX_FOLDING_RANGES) {
      Logger.warn('LspFoldingValidator: Clamped folding ranges exceeding safety limit', {
        count: rawRanges.length,
        limit: this.MAX_FOLDING_RANGES,
      });
    }

    for (let i = 0; i < count; i++) {
      const item = rawRanges[i];
      const valid = this.validateSingleRange(item, totalLines);
      if (valid) {
        validated.push(valid);
      }
    }

    return validated;
  }

  /**
   * Validates a single untrusted folding range.
   */
  public static validateSingleRange(
    item: unknown,
    totalLines: number
  ): ValidatedFoldingRange | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const range = item as Partial<LspFoldingRange>;

    // startLine and endLine must be valid non-negative integers
    if (
      typeof range.startLine !== 'number' ||
      typeof range.endLine !== 'number' ||
      !Number.isInteger(range.startLine) ||
      !Number.isInteger(range.endLine) ||
      isNaN(range.startLine) ||
      isNaN(range.endLine)
    ) {
      return null;
    }

    // Must be non-negative
    if (range.startLine < 0 || range.endLine < 0) {
      return null;
    }

    // startLine must not exceed endLine
    if (range.startLine > range.endLine) {
      return null;
    }

    // Must be within document line bounds (0-based line index < totalLines)
    if (range.startLine >= totalLines || range.endLine >= totalLines) {
      return null;
    }

    // Validate optional character offsets if present
    let startChar: number | undefined;
    if (range.startCharacter !== undefined) {
      if (
        typeof range.startCharacter === 'number' &&
        Number.isInteger(range.startCharacter) &&
        range.startCharacter >= 0
      ) {
        startChar = range.startCharacter;
      }
    }

    let endChar: number | undefined;
    if (range.endCharacter !== undefined) {
      if (
        typeof range.endCharacter === 'number' &&
        Number.isInteger(range.endCharacter) &&
        range.endCharacter >= 0
      ) {
        endChar = range.endCharacter;
      }
    }

    // Single-line fold validation:
    // If startLine === endLine, it must have character offsets with startChar < endChar
    // otherwise a line folding on itself with no character bounds is a no-op / invalid fold
    if (range.startLine === range.endLine) {
      if (startChar === undefined || endChar === undefined || startChar >= endChar) {
        return null;
      }
    }

    // Sanitize kind string
    let kind: string | undefined;
    if (typeof range.kind === 'string' && range.kind.length > 0) {
      kind = range.kind.slice(0, 32).toLowerCase();
    }

    // Sanitize collapsedText if provided
    let collapsedText: string | undefined;
    if (typeof range.collapsedText === 'string') {
      collapsedText = this.sanitizeCollapsedText(range.collapsedText);
    }

    return {
      startLine: range.startLine,
      startCharacter: startChar,
      endLine: range.endLine,
      endCharacter: endChar,
      kind,
      collapsedText,
    };
  }

  /**
   * Sanitizes server-provided collapsedText against control characters, HTML tags, and excessive length.
   */
  public static sanitizeCollapsedText(text: string): string {
    if (!text || typeof text !== 'string') return '';

    // Strip HTML tags and script elements
    let sanitized = text.replace(/<[^>]*>/g, ' ');

    // Strip control characters (except common spaces)
    sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Clamp length
    if (sanitized.length > this.MAX_COLLAPSED_TEXT_LENGTH) {
      sanitized = sanitized.slice(0, this.MAX_COLLAPSED_TEXT_LENGTH - 1) + '…';
    }

    return sanitized;
  }
}
