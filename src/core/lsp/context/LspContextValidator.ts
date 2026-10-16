/**
 * QM Editor LSP Contextual Intelligence Validator & Content Sanitizer
 * Phase 06, Step 59 — LSP Hover, Signature Help & Contextual Documentation Integration
 */

import {
  LspHover,
  LspSignatureHelp,
  LspMarkedString,
  LspMarkupContent,
  LspSignatureInformation,
  LspParameterInformation,
  LspRange,
} from '../LspTypes';
import {
  HoverResponseInvalidError,
} from './LspContextErrors';

export class LspContextValidator {
  public static readonly MAX_HOVER_TEXT_LENGTH = 20_000;
  public static readonly MAX_SIGNATURES = 50;
  public static readonly MAX_PARAMETERS = 100;
  public static readonly MAX_LABEL_LENGTH = 2_000;
  public static readonly MAX_DOC_LENGTH = 10_000;

  private static readonly DANGEROUS_TAGS_REGEX =
    /<\s*(script|iframe|object|embed|applet|meta|form|input|button|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>|<\s*(script|iframe|object|embed|applet|meta|form|input|button|style)[^>]*\/?>/gi;

  private static readonly JAVASCRIPT_URI_REGEX =
    /(?:javascript|vbscript|data|file|command):[^\s'")>]+/gi;

  /**
   * Sanitizes markdown or plain text documentation from untrusted language servers.
   */
  public static sanitizeDocumentationText(rawText: string | undefined): string | undefined {
    if (!rawText || typeof rawText !== 'string') return undefined;

    // 1. Strip dangerous tags
    let clean = rawText.replace(this.DANGEROUS_TAGS_REGEX, '');

    // 2. Strip dangerous URI schemes
    clean = clean.replace(this.JAVASCRIPT_URI_REGEX, '#blocked-uri');

    // 3. Remove inline event handlers (on*)
    clean = clean.replace(/(\s+on[a-zA-Z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

    // 4. Truncate to maximum length
    if (clean.length > this.MAX_DOC_LENGTH) {
      clean = clean.slice(0, this.MAX_DOC_LENGTH) + '\n\n*(documentation truncated)*';
    }

    return clean;
  }

  /**
   * Sanitizes MarkupContent objects or strings.
   */
  public static sanitizeDocumentation(
    doc: string | LspMarkupContent | undefined
  ): string | LspMarkupContent | undefined {
    if (!doc) return undefined;

    if (typeof doc === 'string') {
      return this.sanitizeDocumentationText(doc);
    }

    if (typeof doc === 'object' && 'value' in doc) {
      const kind = doc.kind === 'plaintext' ? 'plaintext' : 'markdown';
      const cleanVal = this.sanitizeDocumentationText(doc.value) ?? '';
      return { kind, value: cleanVal };
    }

    return undefined;
  }

  /**
   * Validates and sanitizes a raw hover response from an LSP server.
   */
  public static validateHoverResponse(raw: unknown): LspHover | null {
    if (raw === null || raw === undefined) {
      return null;
    }

    if (typeof raw !== 'object') {
      throw new HoverResponseInvalidError('LSP hover response must be an object or null', raw);
    }

    const obj = raw as Record<string, unknown>;
    if (!('contents' in obj) || obj.contents === null || obj.contents === undefined) {
      return null;
    }

    // Validate contents
    let validatedContents: LspMarkedString | LspMarkedString[] | LspMarkupContent;

    if (typeof obj.contents === 'string') {
      const sanitized = this.sanitizeDocumentationText(obj.contents) ?? '';
      if (sanitized.length === 0) return null;
      validatedContents = sanitized;
    } else if (Array.isArray(obj.contents)) {
      const sanitizedArray: LspMarkedString[] = [];
      for (const item of obj.contents) {
        if (typeof item === 'string') {
          const s = this.sanitizeDocumentationText(item);
          if (s) sanitizedArray.push(s);
        } else if (typeof item === 'object' && item !== null && 'value' in item) {
          const rawItem = item as { language?: string; value?: string };
          const s = this.sanitizeDocumentationText(rawItem.value);
          if (s) {
            sanitizedArray.push({
              language: typeof rawItem.language === 'string' ? rawItem.language.slice(0, 50) : '',
              value: s,
            });
          }
        }
      }
      if (sanitizedArray.length === 0) return null;
      validatedContents = sanitizedArray;
    } else if (typeof obj.contents === 'object' && obj.contents !== null) {
      const rawMarkup = obj.contents as Record<string, unknown>;
      if ('kind' in rawMarkup && 'value' in rawMarkup && typeof rawMarkup.value === 'string') {
        const kind = rawMarkup.kind === 'plaintext' ? 'plaintext' : 'markdown';
        const cleanVal = this.sanitizeDocumentationText(rawMarkup.value) ?? '';
        if (cleanVal.length === 0) return null;
        validatedContents = { kind, value: cleanVal };
      } else if ('language' in rawMarkup && 'value' in rawMarkup && typeof rawMarkup.value === 'string') {
        const cleanVal = this.sanitizeDocumentationText(rawMarkup.value) ?? '';
        if (cleanVal.length === 0) return null;
        validatedContents = {
          language: typeof rawMarkup.language === 'string' ? rawMarkup.language.slice(0, 50) : '',
          value: cleanVal,
        };
      } else {
        return null;
      }
    } else {
      return null;
    }

    // Validate optional range
    let validatedRange: LspRange | undefined = undefined;
    if (obj.range && typeof obj.range === 'object') {
      const r = obj.range as Record<string, unknown>;
      if (
        r.start &&
        typeof r.start === 'object' &&
        r.end &&
        typeof r.end === 'object'
      ) {
        const s = r.start as Record<string, unknown>;
        const e = r.end as Record<string, unknown>;
        const startLine = typeof s.line === 'number' && s.line >= 0 ? Math.floor(s.line) : 0;
        const startChar = typeof s.character === 'number' && s.character >= 0 ? Math.floor(s.character) : 0;
        const endLine = typeof e.line === 'number' && e.line >= 0 ? Math.floor(e.line) : 0;
        const endChar = typeof e.character === 'number' && e.character >= 0 ? Math.floor(e.character) : 0;

        // Inverted range check & normalization
        if (startLine > endLine || (startLine === endLine && startChar > endChar)) {
          validatedRange = {
            start: { line: endLine, character: endChar },
            end: { line: startLine, character: startChar },
          };
        } else {
          validatedRange = {
            start: { line: startLine, character: startChar },
            end: { line: endLine, character: endChar },
          };
        }
      }
    }

    return {
      contents: validatedContents,
      range: validatedRange,
    };
  }

  /**
   * Validates and sanitizes a raw signature help response from an LSP server.
   */
  public static validateSignatureHelpResponse(raw: unknown): LspSignatureHelp | null {
    if (raw === null || raw === undefined) {
      return null;
    }

    if (typeof raw !== 'object') {
      return null;
    }

    const obj = raw as Record<string, unknown>;
    if (!('signatures' in obj) || !Array.isArray(obj.signatures) || obj.signatures.length === 0) {
      return null;
    }

    const rawSigs = obj.signatures.slice(0, this.MAX_SIGNATURES);
    const validSignatures: LspSignatureInformation[] = [];

    for (const rawSig of rawSigs) {
      if (!rawSig || typeof rawSig !== 'object') continue;
      const s = rawSig as Record<string, unknown>;

      if (typeof s.label !== 'string' || s.label.trim().length === 0) {
        continue;
      }

      const label = s.label.slice(0, this.MAX_LABEL_LENGTH);
      const documentation = this.sanitizeDocumentation(s.documentation as string | LspMarkupContent | undefined);

      // Validate parameters
      let parameters: LspParameterInformation[] | undefined = undefined;
      if (Array.isArray(s.parameters)) {
        parameters = [];
        for (const rawParam of s.parameters.slice(0, this.MAX_PARAMETERS)) {
          if (!rawParam || typeof rawParam !== 'object') continue;
          const p = rawParam as Record<string, unknown>;

          let paramLabel: string | [number, number];
          if (Array.isArray(p.label) && p.label.length === 2) {
            const start = typeof p.label[0] === 'number' ? Math.max(0, Math.floor(p.label[0])) : 0;
            const end = typeof p.label[1] === 'number' ? Math.max(start, Math.min(label.length, Math.floor(p.label[1]))) : start;
            paramLabel = [start, end];
          } else if (typeof p.label === 'string') {
            paramLabel = p.label.slice(0, 500);
          } else {
            continue;
          }

          const paramDoc = this.sanitizeDocumentation(p.documentation as string | LspMarkupContent | undefined);
          parameters.push({
            label: paramLabel,
            documentation: paramDoc,
          });
        }
      }

      validSignatures.push({
        label,
        documentation,
        parameters,
        activeParameter: typeof s.activeParameter === 'number' ? Math.floor(s.activeParameter) : undefined,
      });
    }

    if (validSignatures.length === 0) {
      return null;
    }

    // Validate activeSignature
    let activeSignature = 0;
    if (typeof obj.activeSignature === 'number' && Number.isFinite(obj.activeSignature)) {
      const idx = Math.floor(obj.activeSignature);
      if (idx >= 0 && idx < validSignatures.length) {
        activeSignature = idx;
      }
    }

    // Validate activeParameter
    let activeParameter = 0;
    const currentSig = validSignatures[activeSignature];
    const maxParamCount = currentSig?.parameters?.length ?? 0;

    const rawActiveParam = typeof obj.activeParameter === 'number'
      ? Math.floor(obj.activeParameter)
      : currentSig?.activeParameter;

    if (typeof rawActiveParam === 'number' && Number.isFinite(rawActiveParam)) {
      if (maxParamCount > 0) {
        activeParameter = Math.max(0, Math.min(rawActiveParam, maxParamCount - 1));
      } else {
        activeParameter = Math.max(0, rawActiveParam);
      }
    }

    return {
      signatures: validSignatures,
      activeSignature,
      activeParameter,
    };
  }
}
