/**
 * QM Editor LSP Diagnostic Validator & Sanitizer
 * Phase 06, Step 57 — LSP Diagnostics Integration, Problems Synchronization & Diagnostic Lifecycle
 *
 * Enforces defensive validation and sanitization on untrusted diagnostic data received
 * from external language server processes. Prevents malformed ranges, malicious URLs,
 * oversized payloads, and protocol errors from crashing the editor or corrupting state.
 */

import {
  PublishDiagnosticsParams,
  LspDiagnostic,
  LspDiagnosticSessionContext,
  LspRange,
} from '../LspTypes';
import { logger } from '../../../utils/logger';

export interface ValidatedDiagnosticPayload {
  readonly valid: boolean;
  readonly sanitizedParams?: PublishDiagnosticsParams;
  readonly error?: string;
  readonly quarantinedCount: number;
}

export class LspDiagnosticValidator {
  private static readonly MAX_MESSAGE_LENGTH = 4000;
  private static readonly MAX_SOURCE_LENGTH = 100;
  private static readonly MAX_DIAGNOSTICS_PER_DOC = 1000;

  /**
   * Validates the high-level PublishDiagnosticsParams structure.
   */
  public static validatePayload(
    params: unknown,
    maxPerDoc: number = LspDiagnosticValidator.MAX_DIAGNOSTICS_PER_DOC
  ): ValidatedDiagnosticPayload {
    if (!params || typeof params !== 'object') {
      return {
        valid: false,
        error: 'Payload is null or not an object',
        quarantinedCount: 0,
      };
    }

    const raw = params as Partial<PublishDiagnosticsParams>;
    if (typeof raw.uri !== 'string' || raw.uri.trim().length === 0) {
      return {
        valid: false,
        error: 'Payload uri is missing or empty',
        quarantinedCount: 0,
      };
    }

    if (!Array.isArray(raw.diagnostics)) {
      return {
        valid: false,
        error: 'Payload diagnostics must be an array',
        quarantinedCount: 0,
      };
    }

    // Filter, validate and sanitize individual diagnostic items
    const validDiagnostics: LspDiagnostic[] = [];
    let quarantinedCount = 0;

    const sourceList = raw.diagnostics.slice(0, Math.max(1, maxPerDoc));
    for (let i = 0; i < sourceList.length; i++) {
      const item = sourceList[i];
      const validated = LspDiagnosticValidator.validateDiagnosticItem(item, i);
      if (validated) {
        validDiagnostics.push(validated);
      } else {
        quarantinedCount++;
      }
    }

    if (raw.diagnostics.length > sourceList.length) {
      quarantinedCount += (raw.diagnostics.length - sourceList.length);
      logger.warn(`LspDiagnosticValidator: Capped diagnostics array to ${maxPerDoc} items for ${raw.uri}`);
    }

    return {
      valid: true,
      sanitizedParams: {
        uri: raw.uri.trim(),
        version: typeof raw.version === 'number' && Number.isFinite(raw.version) ? raw.version : undefined,
        diagnostics: validDiagnostics,
      },
      quarantinedCount,
    };
  }

  /**
   * Validates and sanitizes a single LspDiagnostic item. Returns null if hopelessly malformed.
   */
  public static validateDiagnosticItem(item: unknown, index: number): LspDiagnostic | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const raw = item as Partial<LspDiagnostic>;

    // 1. Validate Range
    const validatedRange = LspDiagnosticValidator.validateRange(raw.range);
    if (!validatedRange) {
      logger.warn(`LspDiagnosticValidator: Rejected diagnostic item #${index} with invalid range`, { item });
      return null;
    }

    // 2. Validate Message
    let message = typeof raw.message === 'string' ? raw.message : '';
    // Strip control characters except newline and tab
    message = message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
    if (message.length === 0) {
      message = 'Diagnostic reported without message';
    } else if (message.length > LspDiagnosticValidator.MAX_MESSAGE_LENGTH) {
      message = message.slice(0, LspDiagnosticValidator.MAX_MESSAGE_LENGTH) + '... (truncated)';
    }

    // 3. Validate Severity (1: Error, 2: Warning, 3: Info, 4: Hint)
    let severity = raw.severity;
    if (typeof severity !== 'number' || severity < 1 || severity > 4 || !Number.isInteger(severity)) {
      severity = 1; // Default to Error
    }

    // 4. Validate Code
    let code: number | string | undefined = undefined;
    if (typeof raw.code === 'number' && Number.isFinite(raw.code)) {
      code = raw.code;
    } else if (typeof raw.code === 'string') {
      code = raw.code.trim().slice(0, 100);
    }

    // 5. Validate CodeDescription URL
    let codeDescription: { href: string } | undefined = undefined;
    if (raw.codeDescription && typeof raw.codeDescription.href === 'string') {
      const sanitizedHref = LspDiagnosticValidator.sanitizeUrl(raw.codeDescription.href);
      if (sanitizedHref) {
        codeDescription = { href: sanitizedHref };
      }
    }

    // 6. Validate Source
    let source = typeof raw.source === 'string' ? raw.source.trim().slice(0, LspDiagnosticValidator.MAX_SOURCE_LENGTH) : undefined;
    if (source) {
      source = source.replace(/[\x00-\x1F\x7F]/g, '');
    }

    // 7. Validate Tags (1: Unnecessary, 2: Deprecated)
    let tags: number[] | undefined = undefined;
    if (Array.isArray(raw.tags)) {
      tags = raw.tags.filter((t) => typeof t === 'number' && (t === 1 || t === 2));
    }

    // 8. Validate Related Information
    let relatedInformation: LspDiagnostic['relatedInformation'] = undefined;
    if (Array.isArray(raw.relatedInformation)) {
      relatedInformation = [];
      for (const rel of raw.relatedInformation) {
        if (rel && typeof rel === 'object' && typeof rel.message === 'string' && rel.location?.range) {
          const relRange = LspDiagnosticValidator.validateRange(rel.location.range);
          if (relRange && typeof rel.location.uri === 'string' && rel.location.uri.trim().length > 0) {
            relatedInformation.push({
              location: {
                uri: rel.location.uri.trim(),
                range: relRange,
              },
              message: rel.message.slice(0, 1000).trim(),
            });
          }
        }
      }
    }

    return {
      range: validatedRange,
      severity,
      message,
      code,
      codeDescription,
      source,
      tags,
      relatedInformation,
      data: raw.data,
    };
  }

  /**
   * Validates and normalizes an LspRange (0-based coordinates).
   */
  public static validateRange(range: unknown): LspRange | null {
    if (!range || typeof range !== 'object') {
      return null;
    }

    const r = range as Partial<LspRange>;
    if (!r.start || !r.end || typeof r.start !== 'object' || typeof r.end !== 'object') {
      return null;
    }

    let startLine = r.start.line;
    let startChar = r.start.character;
    let endLine = r.end.line;
    let endChar = r.end.character;

    if (
      typeof startLine !== 'number' || !Number.isFinite(startLine) || startLine < 0 ||
      typeof startChar !== 'number' || !Number.isFinite(startChar) || startChar < 0 ||
      typeof endLine !== 'number' || !Number.isFinite(endLine) || endLine < 0 ||
      typeof endChar !== 'number' || !Number.isFinite(endChar) || endChar < 0
    ) {
      return null;
    }

    startLine = Math.floor(startLine);
    startChar = Math.floor(startChar);
    endLine = Math.floor(endLine);
    endChar = Math.floor(endChar);

    // Ensure start <= end. If inverted, normalize by swapping
    if (startLine > endLine || (startLine === endLine && startChar > endChar)) {
      const tempLine = startLine;
      const tempChar = startChar;
      startLine = endLine;
      startChar = endChar;
      endLine = tempLine;
      endChar = tempChar;
    }

    return {
      start: { line: startLine, character: startChar },
      end: { line: endLine, character: endChar },
    };
  }

  /**
   * Sanitizes a URL for safe navigation. Only allows http: and https: protocols.
   */
  public static sanitizeUrl(href: string): string | null {
    try {
      const parsed = new URL(href);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Verifies session context freshness.
   */
  public static isSessionValid(context?: LspDiagnosticSessionContext): boolean {
    if (!context) return true; // Legacy/unscoped caller
    if (context.sessionState === 'stopping' || context.sessionState === 'stopped' || context.sessionState === 'crashed' || context.sessionState === 'disposed') {
      return false;
    }
    return true;
  }
}
