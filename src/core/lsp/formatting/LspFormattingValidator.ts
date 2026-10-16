/**
 * QM Editor LSP Formatting Validator & Sanitizer
 * Phase 06, Step 63 — LSP Document Formatting, Range Formatting & Safe Formatting Edit Integration
 */

import { LspTextEdit, LspFormattingResponse } from '../LspTypes';
import { Range } from '../../navigation/LocationTypes';
import { FormattingValidationResult } from './LspFormattingTypes';

export class LspFormattingValidator {
  public static readonly MAX_EDITS_COUNT = 5000;
  public static readonly MAX_TOTAL_TEXT_BYTES = 5 * 1024 * 1024; // 5 MB

  /**
   * Validates a canonical 1-based Range for range formatting requests.
   */
  public static validateCanonicalRange(
    range: Range,
    content: string
  ): FormattingValidationResult<void> {
    if (!range) {
      return { valid: false, error: 'Formatting range cannot be null or undefined.', status: 'invalid_range' };
    }

    if (
      typeof range.startLine !== 'number' ||
      typeof range.startColumn !== 'number' ||
      typeof range.endLine !== 'number' ||
      typeof range.endColumn !== 'number'
    ) {
      return { valid: false, error: 'Formatting range contains non-numeric coordinates.', status: 'invalid_range' };
    }

    if (range.startLine < 1 || range.startColumn < 1 || range.endLine < 1 || range.endColumn < 1) {
      return { valid: false, error: 'Canonical formatting coordinates must be 1-based positive numbers.', status: 'invalid_range' };
    }

    if (
      range.startLine > range.endLine ||
      (range.startLine === range.endLine && range.startColumn > range.endColumn)
    ) {
      return { valid: false, error: 'Formatting range start must precede or equal end position.', status: 'invalid_range' };
    }

    // Optional bounds warning/check against total lines
    const lines = content.split('\n');
    if (range.startLine > lines.length + 1) {
      return { valid: false, error: 'Formatting range start line exceeds document line count.', status: 'invalid_range' };
    }

    return { valid: true, status: 'valid' };
  }

  /**
   * Validates raw language server formatting response.
   * Ensures edits are structurally sound, bounded, non-overlapping, and within memory limits.
   */
  public static validateFormattingResponse(
    response: LspFormattingResponse,
    documentContent: string
  ): FormattingValidationResult<LspTextEdit[]> {
    // 1. Null / undefined handling (Section 20)
    if (response === null || response === undefined) {
      return { valid: true, status: 'no_changes', value: [] };
    }

    // 2. Array structure check
    if (!Array.isArray(response)) {
      return {
        valid: false,
        error: 'Formatting response must be an array of TextEdits or null.',
        status: 'invalid_range',
      };
    }

    // 3. Empty edits check (Section 19)
    if (response.length === 0) {
      return { valid: true, status: 'no_changes', value: [] };
    }

    // 4. Defensive bounds: edit count (Section 64)
    if (response.length > this.MAX_EDITS_COUNT) {
      return {
        valid: false,
        error: `Formatting response contains ${response.length} edits, exceeding the safety limit of ${this.MAX_EDITS_COUNT}.`,
        status: 'payload_too_large',
      };
    }

    // 5. Structure and text size verification
    let totalTextLength = 0;
    for (let i = 0; i < response.length; i++) {
      const edit = response[i];
      if (!edit || typeof edit !== 'object') {
        return {
          valid: false,
          error: `Edit at index ${i} is not a valid TextEdit object.`,
          status: 'invalid_range',
        };
      }

      if (typeof edit.newText !== 'string') {
        return {
          valid: false,
          error: `Edit at index ${i} does not contain valid string newText.`,
          status: 'invalid_range',
        };
      }

      totalTextLength += edit.newText.length;
      if (totalTextLength > this.MAX_TOTAL_TEXT_BYTES) {
        return {
          valid: false,
          error: `Total replacement text length exceeds maximum defensive threshold of ${this.MAX_TOTAL_TEXT_BYTES} bytes.`,
          status: 'payload_too_large',
        };
      }

      const r = edit.range;
      if (!r || !r.start || !r.end) {
        return {
          valid: false,
          error: `Edit at index ${i} lacks valid range boundaries.`,
          status: 'invalid_range',
        };
      }

      if (
        typeof r.start.line !== 'number' ||
        typeof r.start.character !== 'number' ||
        typeof r.end.line !== 'number' ||
        typeof r.end.character !== 'number' ||
        r.start.line < 0 ||
        r.start.character < 0 ||
        r.end.line < 0 ||
        r.end.character < 0
      ) {
        return {
          valid: false,
          error: `Edit at index ${i} contains negative or non-numeric 0-based coordinates.`,
          status: 'invalid_range',
        };
      }

      if (
        r.start.line > r.end.line ||
        (r.start.line === r.end.line && r.start.character > r.end.character)
      ) {
        return {
          valid: false,
          error: `Edit at index ${i} has inverted range (start exceeds end).`,
          status: 'invalid_range',
        };
      }
    }

    // 6. Overlapping edits check (Section 21)
    const convertedOffsets: Array<{ index: number; from: number; to: number }> = [];
    for (let i = 0; i < response.length; i++) {
      const r = response[i].range;
      const from = this.lspPositionToOffset(documentContent, r.start.line, r.start.character);
      const to = this.lspPositionToOffset(documentContent, r.end.line, r.end.character);

      convertedOffsets.push({ index: i, from, to });
    }

    // Sort by ascending start offset; for ties, sort by end offset
    convertedOffsets.sort((a, b) => a.from - b.from || a.to - b.to);

    for (let i = 0; i < convertedOffsets.length - 1; i++) {
      const current = convertedOffsets[i];
      const next = convertedOffsets[i + 1];

      // If current edit's end offset is strictly greater than next edit's start offset,
      // they overlap! (Zero-width insertions at the same position can be allowed, but ranges must not overlap)
      if (current.to > next.from) {
        return {
          valid: false,
          error: `Server returned overlapping edits at indices ${current.index} and ${next.index} (offsets [${current.from}, ${current.to}] and [${next.from}, ${next.to}]).`,
          status: 'overlapping_edits',
        };
      }
    }

    return {
      valid: true,
      status: 'valid',
      value: response,
    };
  }

  /**
   * Helper to convert 0-based LSP line/character position into character offset.
   */
  public static lspPositionToOffset(content: string, line: number, character: number): number {
    let currentLine = 0;
    let offset = 0;

    while (currentLine < line && offset < content.length) {
      const nextNewline = content.indexOf('\n', offset);
      if (nextNewline === -1) {
        // Beyond end of content
        return content.length;
      }
      offset = nextNewline + 1;
      currentLine++;
    }

    return Math.min(offset + character, content.length);
  }
}
