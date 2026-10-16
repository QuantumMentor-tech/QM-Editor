/**
 * QM Editor LSP Workspace Symbol Validator & Sanitizer
 * Phase 06, Step 61 — LSP Workspace Symbols, Cross-File Symbol Search & Symbol Navigation
 */

import { LspServerSession } from '../LspServerSession';
import { LspLocationValidator } from '../navigation/LspLocationValidator';
import {
  LspWorkspaceSymbolRequest,
  SanitizedWorkspaceSymbolItem,
  WorkspaceSymbolValidationResult,
} from './LspWorkspaceSymbolTypes';
import { globalWorkspaceEngine } from '../../workspace';
import { logger } from '../../../utils/logger';

export class LspWorkspaceSymbolValidator {
  public static readonly DEFAULT_MAX_SYMBOLS = 1000;
  public static readonly ABSOLUTE_MAX_SYMBOLS = 5000;
  public static readonly MAX_NAME_LENGTH = 512;
  public static readonly MAX_CONTAINER_LENGTH = 512;
  public static readonly MAX_QUERY_LENGTH = 256;

  /**
   * Validates and normalizes an incoming user symbol query.
   */
  public static validateQuery(query: unknown): WorkspaceSymbolValidationResult<string> {
    if (typeof query !== 'string') {
      return { valid: false, error: 'Query must be a string.' };
    }

    // Strip control characters and excessive whitespace
    const sanitized = query.replace(/[\x00-\x1F\x7F]/g, '').trim();
    if (sanitized.length > this.MAX_QUERY_LENGTH) {
      return { valid: true, value: sanitized.slice(0, this.MAX_QUERY_LENGTH) };
    }

    return { valid: true, value: sanitized };
  }

  /**
   * Convenience query sanitizer returning a safe string.
   */
  public static sanitizeQuery(query: string): string {
    const res = this.validateQuery(query);
    return res.valid && typeof res.value === 'string' ? res.value : '';
  }

  /**
   * Validates the outgoing workspace symbol request context against active session state.
   */
  public static validateRequestContext(
    request: LspWorkspaceSymbolRequest,
    session: LspServerSession | null | undefined,
    isEnabled: boolean
  ): WorkspaceSymbolValidationResult<void> {
    if (!isEnabled) {
      return { valid: false, error: 'LSP workspace symbol search is disabled in settings.' };
    }

    if (!session || (session.getState() !== 'ready' && session.getState() !== 'running')) {
      return { valid: false, error: 'No ready LSP session available for workspace symbol search.' };
    }

    const caps = session.getCapabilities();
    if (!caps || !caps.workspaceSymbolProvider) {
      return { valid: false, error: 'Language server does not support workspaceSymbolProvider.' };
    }

    if (request.serverSessionId && request.serverSessionId !== session.sessionId) {
      return { valid: false, error: 'LSP server session changed during search lifecycle.' };
    }

    if (
      request.serverGeneration !== undefined &&
      request.serverGeneration !== session.getSessionGeneration()
    ) {
      return { valid: false, error: 'LSP session generation mismatch.' };
    }

    const currentWorkspaceId = globalWorkspaceEngine.getWorkspaceId();
    if (request.workspaceId && currentWorkspaceId && request.workspaceId !== currentWorkspaceId) {
      return { valid: false, error: 'Active workspace changed during search lifecycle.' };
    }

    return { valid: true };
  }

  /**
   * Sanitizes display strings (names, containers) to prevent XSS and control character issues.
   */
  public static sanitizeDisplayString(val: string, maxLength: number): string {
    if (!val) return '';
    return val
      .replace(/[\x00-\x1F\x7F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .slice(0, maxLength);
  }

  /**
   * Validates a single raw symbol item from the language server.
   */
  public static validateRawItem(
    item: unknown
  ): WorkspaceSymbolValidationResult<SanitizedWorkspaceSymbolItem> {
    if (!item || typeof item !== 'object') {
      return { valid: false, error: 'Symbol item must be a non-null object.' };
    }

    const candidate = item as Record<string, unknown>;

    // 1. Validate Symbol Name
    if (typeof candidate.name !== 'string' || candidate.name.trim() === '') {
      return { valid: false, error: 'Symbol name must be a non-empty string.' };
    }

    // 2. Validate Symbol Kind (must be integer 1-26 in LSP)
    const kind = candidate.kind;
    if (typeof kind !== 'number' || !Number.isInteger(kind) || kind < 1 || kind > 26) {
      return { valid: false, error: `Invalid symbol kind: ${kind}` };
    }

    // 3. Validate Location
    const rawLoc = candidate.location;
    if (!rawLoc || typeof rawLoc !== 'object') {
      return { valid: false, error: 'Symbol location must be an object.' };
    }

    const locObj = rawLoc as Record<string, unknown>;
    const uriVal = LspLocationValidator.validateUri(locObj.uri);
    if (!uriVal.valid || !uriVal.value) {
      return { valid: false, error: `Invalid symbol location URI: ${uriVal.error}` };
    }

    // If range is provided (standard SymbolInformation), validate it
    let validatedRange = undefined;
    if (locObj.range) {
      const rangeVal = LspLocationValidator.validateRange(locObj.range);
      if (!rangeVal.valid || !rangeVal.value) {
        return { valid: false, error: `Invalid symbol location range: ${rangeVal.error}` };
      }
      validatedRange = rangeVal.value;
    }

    const sanitizedName = this.sanitizeDisplayString(candidate.name, this.MAX_NAME_LENGTH);
    const sanitizedContainer = typeof candidate.containerName === 'string'
      ? this.sanitizeDisplayString(candidate.containerName, this.MAX_CONTAINER_LENGTH)
      : undefined;

    return {
      valid: true,
      value: {
        name: sanitizedName,
        kind: kind as any,
        tags: Array.isArray(candidate.tags) ? (candidate.tags as any) : undefined,
        deprecated: Boolean(candidate.deprecated),
        containerName: sanitizedContainer,
        location: {
          uri: uriVal.value,
          range: validatedRange || {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
          },
        },
      },
    };
  }

  /**
   * Validates and defensive-sanitizes raw symbol array responses from a language server.
   * Clamps total size and discards malformed entries while keeping valid entries.
   */
  public static validateAndSanitizeSymbolList(
    response: unknown,
    maxSymbols: number = LspWorkspaceSymbolValidator.DEFAULT_MAX_SYMBOLS
  ): SanitizedWorkspaceSymbolItem[] {
    if (!response) {
      return [];
    }

    const items = Array.isArray(response) ? response : [response];
    const effectiveLimit = Math.min(maxSymbols, this.ABSOLUTE_MAX_SYMBOLS);
    const validItems: SanitizedWorkspaceSymbolItem[] = [];

    for (const raw of items) {
      if (validItems.length >= effectiveLimit) {
        logger.debug('LspWorkspaceSymbolValidator: clamped symbol results to limit', {
          limit: effectiveLimit,
          totalReceived: items.length,
        });
        break;
      }

      const result = this.validateRawItem(raw);
      if (result.valid && result.value) {
        validItems.push(result.value);
      } else {
        logger.debug('LspWorkspaceSymbolValidator: discarded invalid symbol target', {
          error: result.error,
        });
      }
    }

    return validItems;
  }

  /**
   * Alias for backwards compatibility.
   */
  public static validatePayload(
    response: unknown,
    maxSymbols: number = LspWorkspaceSymbolValidator.DEFAULT_MAX_SYMBOLS
  ): SanitizedWorkspaceSymbolItem[] {
    return this.validateAndSanitizeSymbolList(response, maxSymbols);
  }
}
