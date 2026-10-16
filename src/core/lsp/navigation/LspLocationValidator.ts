/**
 * QM Editor LSP Location Validator
 * Phase 06, Step 60 — LSP Code Navigation, Definitions, Declarations, Type Definitions & References
 */

import { LspLocation, LspLocationLink, LspRange, LspPosition } from '../LspTypes';
import { LspNavigationRequest, NavigationValidationResult } from './LspNavigationTypes';
import { LspServerSession } from '../LspServerSession';
import { globalWorkspaceEngine } from '../../workspace';
import { logger } from '../../../utils/logger';

export class LspLocationValidator {
  /** Disallowed URI schemes that pose security or execution risks */
  private static readonly BLOCKED_SCHEMES = new Set([
    'javascript',
    'command',
    'vbscript',
    'data',
    'shell',
    'cmd',
    'powershell',
    'eval',
  ]);

  /**
   * Validates whether a navigation request context is still fresh and valid to execute.
   */
  public static validateRequestContext(
    request: LspNavigationRequest,
    session: LspServerSession | null | undefined,
    isEnabled: boolean
  ): NavigationValidationResult<void> {
    if (!isEnabled) {
      return { valid: false, error: 'LSP navigation is disabled via settings.' };
    }

    if (!session || (session.getState() !== 'ready' && session.getState() !== 'running')) {
      return { valid: false, error: 'No ready LSP session available for document language.' };
    }

    if (request.serverSessionId && request.serverSessionId !== session.sessionId) {
      return { valid: false, error: 'LSP session changed or restarted during request lifecycle.' };
    }

    if (
      request.serverGeneration !== undefined &&
      request.serverGeneration !== session.getSessionGeneration()
    ) {
      return { valid: false, error: 'LSP session generation mismatch.' };
    }

    const currentWorkspaceId = globalWorkspaceEngine.getWorkspaceId();
    if (request.workspaceId && currentWorkspaceId && request.workspaceId !== currentWorkspaceId) {
      return { valid: false, error: 'Active workspace changed during request lifecycle.' };
    }

    return { valid: true };
  }

  /**
   * Validates a URI string for security, formatting, and supported schemes.
   */
  public static validateUri(uri: unknown): NavigationValidationResult<string> {
    if (typeof uri !== 'string' || uri.trim() === '') {
      return { valid: false, error: 'URI must be a non-empty string.' };
    }

    const trimmed = uri.trim();

    // Check for blocked schemes
    const schemeMatch = trimmed.match(/^([a-zA-Z0-9+.-]+):/);
    if (schemeMatch) {
      const scheme = schemeMatch[1].toLowerCase();
      if (this.BLOCKED_SCHEMES.has(scheme)) {
        return { valid: false, error: `Blocked insecure URI scheme: '${scheme}'` };
      }
    }

    return { valid: true, value: trimmed };
  }

  /**
   * Validates an LSP 0-based position coordinate.
   */
  public static validatePosition(pos: unknown): NavigationValidationResult<LspPosition> {
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
   * Validates an LSP 0-based range. Normalizes inverted ranges if start > end.
   */
  public static validateRange(range: unknown): NavigationValidationResult<LspRange> {
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

    let start = startVal.value;
    let end = endVal.value;

    // Normalize inverted range if start occurs after end
    if (start.line > end.line || (start.line === end.line && start.character > end.character)) {
      const temp = start;
      start = end;
      end = temp;
    }

    return { valid: true, value: { start, end } };
  }

  /**
   * Determines if a raw location object is an LSP LocationLink.
   */
  public static isLocationLink(item: unknown): item is LspLocationLink {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.targetUri === 'string' &&
      typeof candidate.targetRange === 'object' &&
      typeof candidate.targetSelectionRange === 'object'
    );
  }

  /**
   * Determines if a raw location object is an LSP Location.
   */
  public static isLocation(item: unknown): item is LspLocation {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Record<string, unknown>;
    return typeof candidate.uri === 'string' && typeof candidate.range === 'object';
  }

  /**
   * Validates and sanitizes a single raw location item (Location or LocationLink).
   */
  public static validateRawItem(
    item: unknown
  ): NavigationValidationResult<LspLocation | LspLocationLink> {
    if (!item || typeof item !== 'object') {
      return { valid: false, error: 'Location item must be a non-null object.' };
    }

    if (this.isLocationLink(item)) {
      const uriVal = this.validateUri(item.targetUri);
      if (!uriVal.valid || !uriVal.value) {
        return { valid: false, error: uriVal.error };
      }

      const targetRangeVal = this.validateRange(item.targetRange);
      if (!targetRangeVal.valid || !targetRangeVal.value) {
        return { valid: false, error: `targetRange: ${targetRangeVal.error}` };
      }

      const targetSelVal = this.validateRange(item.targetSelectionRange);
      if (!targetSelVal.valid || !targetSelVal.value) {
        return { valid: false, error: `targetSelectionRange: ${targetSelVal.error}` };
      }

      return {
        valid: true,
        value: {
          originSelectionRange: item.originSelectionRange
            ? this.validateRange(item.originSelectionRange).value
            : undefined,
          targetUri: uriVal.value,
          targetRange: targetRangeVal.value,
          targetSelectionRange: targetSelVal.value,
        },
      };
    }

    if (this.isLocation(item)) {
      const uriVal = this.validateUri(item.uri);
      if (!uriVal.valid || !uriVal.value) {
        return { valid: false, error: uriVal.error };
      }

      const rangeVal = this.validateRange(item.range);
      if (!rangeVal.valid || !rangeVal.value) {
        return { valid: false, error: `range: ${rangeVal.error}` };
      }

      return {
        valid: true,
        value: {
          uri: uriVal.value,
          range: rangeVal.value,
        },
      };
    }

    return { valid: false, error: 'Item conforms to neither Location nor LocationLink structure.' };
  }

  /**
   * Validates an entire raw response (which could be single item, array, or null).
   * Malformed items in an array are discarded while valid items are preserved.
   */
  public static validateNavigationResponse(
    response: unknown
  ): (LspLocation | LspLocationLink)[] {
    if (!response) {
      return [];
    }

    const items = Array.isArray(response) ? response : [response];
    const validItems: (LspLocation | LspLocationLink)[] = [];

    for (const raw of items) {
      const result = this.validateRawItem(raw);
      if (result.valid && result.value) {
        validItems.push(result.value);
      } else {
        logger.debug('LspLocationValidator: discarded invalid location target', {
          error: result.error,
        });
      }
    }

    return validItems;
  }
}
