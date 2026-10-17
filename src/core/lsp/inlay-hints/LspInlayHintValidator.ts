/**
 * QM Editor - LSP Inlay Hints Validator
 * Phase 06, Step 65 — LSP Inlay Hints, Parameter Names, Type Information & Inline Semantic Annotations
 * 
 * Validates protocol payloads from language servers, verifies document bounds,
 * sanitizes untrusted label and tooltip text, and protects against XSS/DoS.
 */

import { Logger } from '../../../utils/logger';
import {
  LspInlayHint,
  LspInlayHintKind,
  LspInlayHintLabelPart,
  CanonicalInlayHintKind,
} from './LspInlayHintTypes';

export interface ValidatedInlayHint {
  readonly line: number;
  readonly character: number;
  readonly label: string;
  readonly kind: CanonicalInlayHintKind;
  readonly tooltip?: string;
  readonly paddingLeft: boolean;
  readonly paddingRight: boolean;
  readonly data?: unknown;
}

export class LspInlayHintValidator {
  /** Maximum number of hints accepted per document to prevent memory DoS */
  public static readonly MAX_HINTS_PER_DOCUMENT = 2000;

  /** Maximum character length allowed for an individual hint label */
  public static readonly MAX_LABEL_LENGTH = 500;

  /** Maximum character length allowed for an individual tooltip */
  public static readonly MAX_TOOLTIP_LENGTH = 5000;

  /**
   * Validates and sanitizes a raw server response into a safe list of validated hints.
   * Invalid or out-of-bounds individual hints are quarantined and dropped non-fatally.
   */
  public static validateResponse(
    rawHints: unknown,
    docLines?: readonly string[]
  ): ValidatedInlayHint[] {
    if (!Array.isArray(rawHints)) {
      if (rawHints === null || rawHints === undefined) {
        return [];
      }
      Logger.warn('LspInlayHintValidator: Expected array of inlay hints, received non-array', {
        type: typeof rawHints,
      });
      return [];
    }

    const validated: ValidatedInlayHint[] = [];
    const count = Math.min(rawHints.length, this.MAX_HINTS_PER_DOCUMENT);

    if (rawHints.length > this.MAX_HINTS_PER_DOCUMENT) {
      Logger.warn(
        `LspInlayHintValidator: Response contained ${rawHints.length} hints, capped at ${this.MAX_HINTS_PER_DOCUMENT}`
      );
    }

    for (let i = 0; i < count; i++) {
      const raw = rawHints[i];
      const valid = this.validateSingleHint(raw, docLines);
      if (valid) {
        validated.push(valid);
      }
    }

    return validated;
  }

  /**
   * Validates a single hint object. Returns null if the hint is malformed or out-of-bounds.
   */
  public static validateSingleHint(
    raw: unknown,
    docLines?: readonly string[]
  ): ValidatedInlayHint | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const hint = raw as Partial<LspInlayHint>;

    // 1. Position validation
    if (!hint.position || typeof hint.position !== 'object') {
      return null;
    }

    const line = hint.position.line;
    const character = hint.position.character;

    if (
      typeof line !== 'number' ||
      typeof character !== 'number' ||
      !Number.isInteger(line) ||
      !Number.isInteger(character) ||
      line < 0 ||
      character < 0
    ) {
      Logger.warn('LspInlayHintValidator: Invalid hint position coordinates', { line, character });
      return null;
    }

    // Bounds check against document lines if available
    if (docLines) {
      if (line >= docLines.length) {
        Logger.warn('LspInlayHintValidator: Hint line exceeds document line count', {
          line,
          docLinesCount: docLines.length,
        });
        return null;
      }

      const lineContent = docLines[line] ?? '';
      if (character > lineContent.length) {
        Logger.warn('LspInlayHintValidator: Hint character exceeds line length', {
          line,
          character,
          lineLength: lineContent.length,
        });
        return null;
      }
    }

    // 2. Label extraction and sanitization
    const rawLabel = this.extractLabel(hint.label);
    if (!rawLabel || rawLabel.trim().length === 0) {
      return null;
    }

    const label = this.sanitizeText(rawLabel, this.MAX_LABEL_LENGTH);
    if (!label || label.trim().length === 0) {
      return null;
    }

    // 3. Kind mapping
    const kind = this.mapKind(hint.kind);

    // 4. Tooltip extraction and sanitization
    const tooltip = this.extractTooltip(hint.tooltip);

    return {
      line,
      character,
      label,
      kind,
      tooltip,
      paddingLeft: Boolean(hint.paddingLeft),
      paddingRight: Boolean(hint.paddingRight),
      data: hint.data,
    };
  }

  /**
   * Extracts text from label string or array of label parts.
   */
  private static extractLabel(label: unknown): string {
    if (typeof label === 'string') {
      return label;
    }

    if (Array.isArray(label)) {
      return (label as LspInlayHintLabelPart[])
        .map((part) => (typeof part?.value === 'string' ? part.value : ''))
        .join('');
    }

    return '';
  }

  /**
   * Extracts and sanitizes tooltip string or MarkupContent.
   */
  private static extractTooltip(tooltip: unknown): string | undefined {
    if (!tooltip) return undefined;

    let text: string | undefined;
    if (typeof tooltip === 'string') {
      text = tooltip;
    } else if (typeof tooltip === 'object' && tooltip !== null && 'value' in tooltip) {
      const val = (tooltip as { value?: unknown }).value;
      if (typeof val === 'string') {
        text = val;
      }
    }

    if (!text) return undefined;
    return this.sanitizeText(text, this.MAX_TOOLTIP_LENGTH);
  }

  /**
   * Maps LSP numerical hint kind to canonical kind string.
   */
  public static mapKind(kind: unknown): CanonicalInlayHintKind {
    if (kind === LspInlayHintKind.Type || kind === 1) {
      return 'type';
    }
    if (kind === LspInlayHintKind.Parameter || kind === 2) {
      return 'parameter';
    }
    return 'other';
  }

  /**
   * Strips dangerous executable script tags and controls character bounds.
   */
  public static sanitizeText(text: string, maxLength: number): string {
    if (!text) return '';

    // Remove null bytes and dangerous control characters except newlines/tabs
    let clean = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

    // Strip <script> and dangerous tags if present in plain text / markdown
    clean = clean.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
    clean = clean.replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '');
    clean = clean.replace(/<\s*object[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, '');

    if (clean.length > maxLength) {
      clean = clean.slice(0, maxLength);
    }

    return clean;
  }
}
