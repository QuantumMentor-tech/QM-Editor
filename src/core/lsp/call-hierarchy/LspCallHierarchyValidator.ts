/**
 * QM Editor — LSP Call Hierarchy Validator
 * Phase 06, Step 70 — LSP Call Hierarchy, Callers, Callees & Safe Cross-File Code Relationship Navigation
 *
 * Implements defensive validation of untrusted language server call hierarchy payloads:
 * - CallHierarchyItem coordinate sanity, non-empty names, and URI scheme safety
 * - Enclosure verification: selectionRange must be contained inside enclosing range
 * - Call-site range verification for incoming and outgoing call relationships
 * - Cycle detection tracking across active ancestral call graph paths
 * - Bounded depth and response size clamping to protect editor performance
 */

import {
  LspCallHierarchyItem,
  LspCallHierarchyIncomingCall,
  LspCallHierarchyOutgoingCall,
  LspPosition,
  LspRange,
  LspSymbolTag,
} from '../LspTypes';
import { Range } from '../../navigation/LocationTypes';

export interface ValidationResult<T> {
  valid: boolean;
  value?: T;
  error?: string;
}

export class LspCallHierarchyValidator {
  public static readonly DEFAULT_MAX_DEPTH = 20;
  public static readonly DEFAULT_MAX_CALLS_PER_NODE = 200;
  public static readonly MAX_STRING_LENGTH = 1024;

  private static readonly BLOCKED_URI_SCHEMES = new Set([
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
   * Validates an LSP 0-based position coordinate.
   */
  public static validatePosition(pos: unknown): ValidationResult<LspPosition> {
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
  public static validateRange(range: unknown): ValidationResult<LspRange> {
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
   * Checks whether parentRange encloses childRange.
   */
  public static doesEnclose(outer: LspRange, inner: LspRange): boolean {
    const startOk =
      outer.start.line < inner.start.line ||
      (outer.start.line === inner.start.line && outer.start.character <= inner.start.character);
    const endOk =
      outer.end.line > inner.end.line ||
      (outer.end.line === inner.end.line && outer.end.character >= inner.end.character);
    return startOk && endOk;
  }

  /**
   * Validates a URI string for security and scheme safety.
   */
  public static validateUri(uri: unknown): ValidationResult<string> {
    if (typeof uri !== 'string' || uri.trim() === '') {
      return { valid: false, error: 'URI must be a non-empty string.' };
    }

    const trimmed = uri.trim();
    if (trimmed.length > this.MAX_STRING_LENGTH * 2) {
      return { valid: false, error: 'URI exceeds maximum permitted length.' };
    }

    const schemeMatch = trimmed.match(/^([a-zA-Z0-9+.-]+):/);
    if (schemeMatch) {
      const scheme = schemeMatch[1].toLowerCase();
      if (this.BLOCKED_URI_SCHEMES.has(scheme)) {
        return { valid: false, error: `Insecure URI scheme blocked: '${scheme}'` };
      }
    }

    return { valid: true, value: trimmed };
  }

  /**
   * Validates an untrusted CallHierarchyItem from the language server.
   */
  public static validateCallHierarchyItem(raw: unknown): ValidationResult<LspCallHierarchyItem> {
    if (!raw || typeof raw !== 'object') {
      return { valid: false, error: 'CallHierarchyItem must be a defined object.' };
    }

    const item = raw as Record<string, unknown>;

    // 1. Validate name
    if (typeof item.name !== 'string' || item.name.trim() === '') {
      return { valid: false, error: 'CallHierarchyItem name must be a non-empty string.' };
    }
    const name = item.name.trim().slice(0, this.MAX_STRING_LENGTH);

    // 2. Validate kind (1..26)
    if (typeof item.kind !== 'number' || !Number.isInteger(item.kind) || item.kind < 1 || item.kind > 26) {
      return { valid: false, error: `Invalid symbol kind: ${item.kind}` };
    }
    const kind = item.kind as any;

    // 3. Validate URI
    const uriVal = this.validateUri(item.uri);
    if (!uriVal.valid || !uriVal.value) {
      return { valid: false, error: `Invalid URI: ${uriVal.error}` };
    }
    const uri = uriVal.value;

    // 4. Validate range
    const rangeVal = this.validateRange(item.range);
    if (!rangeVal.valid || !rangeVal.value) {
      return { valid: false, error: `Invalid item range: ${rangeVal.error}` };
    }
    const range = rangeVal.value;

    // 5. Validate selectionRange
    const selRangeVal = this.validateRange(item.selectionRange);
    if (!selRangeVal.valid || !selRangeVal.value) {
      return { valid: false, error: `Invalid selection range: ${selRangeVal.error}` };
    }
    let selectionRange = selRangeVal.value;

    // Verify selectionRange is enclosed by range; normalize if server misbehaves
    if (!this.doesEnclose(range, selectionRange)) {
      selectionRange = range;
    }

    // Optional fields
    const detail = typeof item.detail === 'string' ? item.detail.trim().slice(0, this.MAX_STRING_LENGTH) : undefined;
    const tags = Array.isArray(item.tags)
      ? item.tags.filter((t): t is LspSymbolTag => t === LspSymbolTag.Deprecated)
      : undefined;

    return {
      valid: true,
      value: {
        name,
        kind,
        tags,
        detail,
        uri,
        range,
        selectionRange,
        data: item.data,
      },
    };
  }

  /**
   * Validates an incoming call relationship.
   */
  public static validateIncomingCall(raw: unknown): ValidationResult<LspCallHierarchyIncomingCall> {
    if (!raw || typeof raw !== 'object') {
      return { valid: false, error: 'IncomingCall must be a defined object.' };
    }

    const c = raw as Record<string, unknown>;
    const fromVal = this.validateCallHierarchyItem(c.from);
    if (!fromVal.valid || !fromVal.value) {
      return { valid: false, error: `Invalid caller item in incoming call: ${fromVal.error}` };
    }

    const fromRanges: LspRange[] = [];
    if (Array.isArray(c.fromRanges)) {
      for (const r of c.fromRanges) {
        const rangeVal = this.validateRange(r);
        if (rangeVal.valid && rangeVal.value) {
          fromRanges.push(rangeVal.value);
        }
      }
    }

    // If no valid call-site ranges were supplied, fallback to the caller's selectionRange
    if (fromRanges.length === 0) {
      fromRanges.push(fromVal.value.selectionRange);
    }

    return {
      valid: true,
      value: {
        from: fromVal.value,
        fromRanges,
      },
    };
  }

  /**
   * Validates an outgoing call relationship.
   */
  public static validateOutgoingCall(raw: unknown): ValidationResult<LspCallHierarchyOutgoingCall> {
    if (!raw || typeof raw !== 'object') {
      return { valid: false, error: 'OutgoingCall must be a defined object.' };
    }

    const c = raw as Record<string, unknown>;
    const toVal = this.validateCallHierarchyItem(c.to);
    if (!toVal.valid || !toVal.value) {
      return { valid: false, error: `Invalid callee item in outgoing call: ${toVal.error}` };
    }

    const fromRanges: LspRange[] = [];
    if (Array.isArray(c.fromRanges)) {
      for (const r of c.fromRanges) {
        const rangeVal = this.validateRange(r);
        if (rangeVal.valid && rangeVal.value) {
          fromRanges.push(rangeVal.value);
        }
      }
    }

    if (fromRanges.length === 0) {
      fromRanges.push(toVal.value.selectionRange);
    }

    return {
      valid: true,
      value: {
        to: toVal.value,
        fromRanges,
      },
    };
  }

  /**
   * Computes a stable structural fingerprint for cycle and deduplication detection.
   */
  public static getItemFingerprint(item: { uri: string; name: string; range: LspRange | Range }): string {
    if ('startLine' in item.range) {
      return `${item.uri}#${item.name}#${item.range.startLine}:${item.range.startColumn}-${item.range.endLine}:${item.range.endColumn}`;
    }
    return `${item.uri}#${item.name}#${item.range.start.line}:${item.range.start.character}-${item.range.end.line}:${item.range.end.character}`;
  }

  /**
   * Checks whether expanding this item would cause a cycle along the active ancestral branch.
   */
  public static isCycle(fingerprint: string, ancestorFingerprints: Set<string>): boolean {
    return ancestorFingerprints.has(fingerprint);
  }
}
