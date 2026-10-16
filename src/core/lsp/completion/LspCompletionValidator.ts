/**
 * QM Editor LSP Completion Validator & Sanitizer
 * Phase 06, Step 58 — LSP Completion Integration, Suggestion Intelligence & Safe Completion Acceptance
 *
 * Enforces defensive validation and sanitization on untrusted completion data received
 * from external language server processes. Prevents malformed ranges, malicious documentation,
 * oversized payloads, and protocol inconsistencies from crashing the editor or corrupting state.
 */

import {
  LspCompletionItem,
  LspCompletionList,
  LspTextEdit,
  LspInsertReplaceEdit,
  LspRange,
} from '../LspTypes';
import { CompletionRequest } from '../../language-intelligence/LanguageIntelligenceTypes';
import { LspServerSession } from '../LspServerSession';
import { logger } from '../../../utils/logger';

export interface ValidatedCompletionPayload {
  readonly valid: boolean;
  readonly isIncomplete: boolean;
  readonly items: LspCompletionItem[];
  readonly quarantinedCount: number;
  readonly error?: string;
}

export class LspCompletionValidator {
  public static readonly DEFAULT_MAX_ITEMS = 500;
  public static readonly MAX_LABEL_LENGTH = 256;
  public static readonly MAX_DETAIL_LENGTH = 500;
  public static readonly MAX_DOC_LENGTH = 10000;
  public static readonly MAX_ADDITIONAL_EDITS = 20;

  /**
   * Validates the outgoing completion request context against the active session and document state.
   */
  public static validateContext(
    request: CompletionRequest,
    session?: LspServerSession | null,
    enabled: boolean = true
  ): { valid: boolean; error?: string } {
    if (!enabled) {
      return { valid: false, error: 'LSP completion is disabled by user settings.' };
    }

    if (!session) {
      return { valid: false, error: 'No active LSP server session available for language.' };
    }

    const state = session.getState();
    if (state !== 'ready' && state !== 'running') {
      return { valid: false, error: `LSP session is not in ready state (current: ${state}).` };
    }

    const caps = session.getCapabilities();
    if (!caps || !caps.completionProvider) {
      return { valid: false, error: 'LSP server does not declare completion capability.' };
    }

    if (!request.uri || typeof request.uri !== 'string' || request.uri.trim().length === 0) {
      return { valid: false, error: 'Completion request URI is missing or empty.' };
    }

    if (!request.position || request.position.line < 1 || request.position.column < 1) {
      return { valid: false, error: 'Completion request position must be positive 1-based coordinates.' };
    }

    return { valid: true };
  }

  /**
   * Validates and defensive-sanitizes raw completion responses from a language server.
   */
  public static validatePayload(
    response: unknown,
    maxItems: number = LspCompletionValidator.DEFAULT_MAX_ITEMS
  ): ValidatedCompletionPayload {
    if (response === null || response === undefined) {
      return {
        valid: true,
        isIncomplete: false,
        items: [],
        quarantinedCount: 0,
      };
    }

    let rawList: unknown[];
    let isIncomplete = false;

    if (Array.isArray(response)) {
      rawList = response;
      isIncomplete = false;
    } else if (typeof response === 'object' && response !== null) {
      const completionList = response as Partial<LspCompletionList>;
      if (!Array.isArray(completionList.items)) {
        return {
          valid: false,
          isIncomplete: false,
          items: [],
          quarantinedCount: 0,
          error: 'LSP CompletionList missing items array.',
        };
      }
      rawList = completionList.items;
      isIncomplete = Boolean(completionList.isIncomplete);
    } else {
      return {
        valid: false,
        isIncomplete: false,
        items: [],
        quarantinedCount: 0,
        error: 'LSP completion response is neither an array nor a CompletionList.',
      };
    }

    const validItems: LspCompletionItem[] = [];
    let quarantinedCount = 0;
    const cappedMax = Math.max(1, Math.min(maxItems, 5000));
    const sliceCount = Math.min(rawList.length, cappedMax);

    for (let i = 0; i < sliceCount; i++) {
      const sanitized = LspCompletionValidator.validateCompletionItem(rawList[i]);
      if (sanitized) {
        validItems.push(sanitized);
      } else {
        quarantinedCount++;
      }
    }

    if (rawList.length > sliceCount) {
      quarantinedCount += (rawList.length - sliceCount);
      logger.debug('LspCompletionValidator: Response exceeded maxItems, truncated', {
        total: rawList.length,
        retained: validItems.length,
        maxItems: cappedMax,
      });
    }

    return {
      valid: true,
      isIncomplete,
      items: validItems,
      quarantinedCount,
    };
  }

  /**
   * Validates and defensive-sanitizes a single LSP completion item.
   */
  public static validateCompletionItem(raw: unknown): LspCompletionItem | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const item = raw as Partial<LspCompletionItem>;

    // 1. Label is mandatory
    if (typeof item.label !== 'string' || item.label.trim().length === 0) {
      return null;
    }
    const label = item.label.length > LspCompletionValidator.MAX_LABEL_LENGTH
      ? item.label.slice(0, LspCompletionValidator.MAX_LABEL_LENGTH)
      : item.label;

    // 2. Kind
    let kind = item.kind;
    if (typeof kind !== 'number' || kind < 1 || kind > 25) {
      kind = undefined;
    }

    // 3. Detail
    let detail: string | undefined;
    if (typeof item.detail === 'string') {
      detail = item.detail.length > LspCompletionValidator.MAX_DETAIL_LENGTH
        ? item.detail.slice(0, LspCompletionValidator.MAX_DETAIL_LENGTH)
        : item.detail;
    }

    // 4. Documentation
    const documentation = LspCompletionValidator.sanitizeDocumentation(item.documentation);

    // 5. TextEdit & InsertReplaceEdit validation
    let textEdit: LspTextEdit | LspInsertReplaceEdit | undefined;
    if (item.textEdit && typeof item.textEdit === 'object') {
      if ('range' in item.textEdit && item.textEdit.range) {
        const standardEdit = item.textEdit as LspTextEdit;
        if (LspCompletionValidator.isValidRange(standardEdit.range) && typeof standardEdit.newText === 'string') {
          textEdit = {
            range: standardEdit.range,
            newText: item.insertTextFormat === 2
              ? LspCompletionValidator.downgradeSnippet(standardEdit.newText)
              : standardEdit.newText,
          };
        }
      } else if ('insert' in item.textEdit && 'replace' in item.textEdit) {
        const irEdit = item.textEdit as LspInsertReplaceEdit;
        if (
          LspCompletionValidator.isValidRange(irEdit.insert) &&
          LspCompletionValidator.isValidRange(irEdit.replace) &&
          typeof irEdit.newText === 'string'
        ) {
          textEdit = {
            insert: irEdit.insert,
            replace: irEdit.replace,
            newText: item.insertTextFormat === 2
              ? LspCompletionValidator.downgradeSnippet(irEdit.newText)
              : irEdit.newText,
          };
        }
      }
    }

    // 6. InsertText
    let insertText: string | undefined;
    if (typeof item.insertText === 'string') {
      insertText = item.insertTextFormat === 2
        ? LspCompletionValidator.downgradeSnippet(item.insertText)
        : item.insertText;
    }

    // 7. AdditionalTextEdits
    let additionalTextEdits: LspTextEdit[] | undefined;
    if (Array.isArray(item.additionalTextEdits)) {
      const validEdits: LspTextEdit[] = [];
      for (const edit of item.additionalTextEdits.slice(0, LspCompletionValidator.MAX_ADDITIONAL_EDITS)) {
        if (
          edit &&
          typeof edit === 'object' &&
          LspCompletionValidator.isValidRange(edit.range) &&
          typeof edit.newText === 'string'
        ) {
          validEdits.push({
            range: edit.range,
            newText: edit.newText,
          });
        }
      }
      if (validEdits.length > 0) {
        additionalTextEdits = validEdits;
      }
    }

    // 8. Commit Characters
    let commitCharacters: string[] | undefined;
    if (Array.isArray(item.commitCharacters)) {
      commitCharacters = item.commitCharacters.filter(
        (c) => typeof c === 'string' && c.length >= 1
      );
    }

    return {
      label,
      kind,
      detail,
      documentation,
      insertText,
      insertTextFormat: item.insertTextFormat,
      textEdit,
      additionalTextEdits,
      sortText: typeof item.sortText === 'string' ? item.sortText.slice(0, 256) : undefined,
      filterText: typeof item.filterText === 'string' ? item.filterText.slice(0, 256) : undefined,
      commitCharacters,
      deprecated: Boolean(item.deprecated),
      data: item.data,
    };
  }

  /**
   * Validates a 0-based LSP range for positive line/column coordinates and correct start/end ordering.
   */
  public static isValidRange(range: unknown): range is LspRange {
    if (!range || typeof range !== 'object') return false;
    const r = range as LspRange;
    if (!r.start || !r.end) return false;
    if (
      typeof r.start.line !== 'number' ||
      typeof r.start.character !== 'number' ||
      typeof r.end.line !== 'number' ||
      typeof r.end.character !== 'number'
    ) {
      return false;
    }
    if (r.start.line < 0 || r.start.character < 0 || r.end.line < 0 || r.end.character < 0) {
      return false;
    }
    if (r.end.line < r.start.line) return false;
    if (r.end.line === r.start.line && r.end.character < r.start.character) return false;
    return true;
  }

  /**
   * Sanitizes documentation string or MarkupContent, removing dangerous HTML and truncating length.
   */
  public static sanitizeDocumentation(rawDoc: unknown): string | undefined {
    if (!rawDoc) return undefined;

    let text: string;
    if (typeof rawDoc === 'string') {
      text = rawDoc;
    } else if (typeof rawDoc === 'object' && rawDoc !== null && 'value' in rawDoc) {
      text = String((rawDoc as { value: unknown }).value);
    } else {
      return undefined;
    }

    if (text.length === 0) return undefined;

    // Strip dangerous tags: <script>, <iframe>, <object>, <embed>, <applet>
    let sanitized = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/<(iframe|object|embed|applet|meta|link)[^>]*>/gi, '');
    sanitized = sanitized.replace(/javascript:[^"'\s)]+/gi, '#');

    // Cap documentation length to protect UI performance
    if (sanitized.length > LspCompletionValidator.MAX_DOC_LENGTH) {
      sanitized = sanitized.slice(0, LspCompletionValidator.MAX_DOC_LENGTH) + '… (truncated)';
    }

    return sanitized;
  }

  /**
   * Safely downgrades LSP snippet text by stripping placeholders (${1:foo} -> foo, $0 -> empty)
   * so that inserted text is never corrupted with raw syntax when inserted as plain text.
   */
  public static downgradeSnippet(snippet: string): string {
    if (!snippet || typeof snippet !== 'string') return '';

    // 1. Replace ${1:placeholder} or ${1|a,b,c|} with placeholder
    let result = snippet.replace(/\$\{(\d+):([^}]*)\}/g, '$2');
    result = result.replace(/\$\{(\d+)\|([^|]*)\|}/g, '$2');

    // 2. Replace ${1} with empty
    result = result.replace(/\$\{\d+\}/g, '');

    // 3. Replace $0, $1, $2 with empty
    result = result.replace(/\$\d+/g, '');

    // 4. Unescape escaped dollar signs
    result = result.replace(/\\\$/g, '$');

    return result;
  }
}
