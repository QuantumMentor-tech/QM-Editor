/**
 * QM Editor - LSP Document Link Security Validator
 * Phase 06, Step 67 — LSP Document Links, Clickable Resource References & Safe URI Navigation
 * 
 * Centralized URI security boundary, range verification, classification,
 * path traversal defense, and tooltip sanitization for LSP document links.
 */

import { Logger } from '../../../utils/logger';
import { LspRange } from '../LspTypes';
import { UriClassification } from './LspDocumentLinkTypes';
import { normalizeWorkspacePath, isResourceInRoot } from '../../workspace/WorkspaceResourceBoundary';
import { LspUriMapper } from '../LspUriMapper';

export interface UriValidationResult {
  readonly isValid: boolean;
  readonly classification: UriClassification;
  readonly normalizedUri?: string;
  readonly reason?: string;
  readonly fragment?: string;
}

export class LspDocumentLinkSecurityValidator {
  /** Maximum allowable length for target URI string */
  public static readonly MAX_URI_LENGTH = 2048;

  /** Maximum allowable length for tooltip text */
  public static readonly MAX_TOOLTIP_LENGTH = 512;

  /** Strictly prohibited dangerous URI schemes */
  public static readonly PROHIBITED_SCHEMES = [
    /^javascript:/i,
    /^data:/i,
    /^vbscript:/i,
    /^shell:/i,
    /^powershell:/i,
    /^cmd:/i,
    /^exec:/i,
    /^node:/i,
    /^eval:/i,
    /^file\+ssh:/i,
  ];

  /** Path traversal patterns including URL-encoded variants */
  public static readonly TRAVERSAL_PATTERNS = [
    /(?:^|[\\/])\.\.(?:[\\/]|$)/,
    /%2e%2e/i,
    /%252e/i,
    /\0/,
    /%00/i,
  ];

  /** Approved external web schemes */
  public static readonly APPROVED_EXTERNAL_SCHEMES = ['http:', 'https:', 'mailto:'];

  /**
   * Validates an LSP range against document lines.
   */
  public static validateRange(range: unknown, lines: string[]): boolean {
    if (!range || typeof range !== 'object') return false;

    const r = range as Partial<LspRange>;
    if (!r.start || !r.end) return false;

    const { start, end } = r;
    if (
      typeof start.line !== 'number' ||
      typeof start.character !== 'number' ||
      typeof end.line !== 'number' ||
      typeof end.character !== 'number'
    ) {
      return false;
    }

    if (
      !Number.isInteger(start.line) ||
      !Number.isInteger(start.character) ||
      !Number.isInteger(end.line) ||
      !Number.isInteger(end.character)
    ) {
      return false;
    }

    if (start.line < 0 || start.character < 0 || end.line < 0 || end.character < 0) {
      return false;
    }

    if (start.line > end.line || (start.line === end.line && start.character > end.character)) {
      return false;
    }

    // Must have non-zero length
    if (start.line === end.line && start.character === end.character) {
      return false;
    }

    if (start.line >= lines.length || end.line >= lines.length) {
      return false;
    }

    const startLineLen = lines[start.line]?.length ?? 0;
    const endLineLen = lines[end.line]?.length ?? 0;

    if (start.character > startLineLen || end.character > endLineLen) {
      return false;
    }

    return true;
  }

  /**
   * Classifies and validates a target URI from an LSP server.
   */
  public static classifyAndValidateUri(
    rawTarget: unknown,
    documentUri: string,
    workspaceRoots: string[] = []
  ): UriValidationResult {
    if (typeof rawTarget !== 'string') {
      return {
        isValid: false,
        classification: 'malformed',
        reason: 'Target URI must be a non-empty string',
      };
    }

    const trimmed = rawTarget.trim();
    if (trimmed.length === 0) {
      return {
        isValid: false,
        classification: 'malformed',
        reason: 'Target URI cannot be empty',
      };
    }

    if (trimmed.length > this.MAX_URI_LENGTH) {
      Logger.warn('LspDocumentLinkSecurityValidator: URI exceeded maximum length', {
        length: trimmed.length,
        max: this.MAX_URI_LENGTH,
      });
      return {
        isValid: false,
        classification: 'malformed',
        reason: `Target URI exceeded maximum length (${this.MAX_URI_LENGTH} characters)`,
      };
    }

    // Check prohibited schemes
    for (const schemePattern of this.PROHIBITED_SCHEMES) {
      if (schemePattern.test(trimmed)) {
        Logger.warn('LspDocumentLinkSecurityValidator: Prohibited URI scheme detected', {
          uri: trimmed,
        });
        return {
          isValid: false,
          classification: 'unsupported',
          reason: `Target URI matches prohibited scheme: ${schemePattern}`,
        };
      }
    }

    // Check path traversal
    for (const traversalPattern of this.TRAVERSAL_PATTERNS) {
      if (traversalPattern.test(trimmed)) {
        Logger.warn('LspDocumentLinkSecurityValidator: Path traversal sequence detected', {
          uri: trimmed,
        });
        return {
          isValid: false,
          classification: 'unsupported',
          reason: 'Target URI contains forbidden path traversal sequences',
        };
      }
    }

    // Check same-document fragment
    if (trimmed.startsWith('#')) {
      return {
        isValid: true,
        classification: 'same-document',
        normalizedUri: documentUri + trimmed,
        fragment: trimmed.slice(1),
      };
    }

    // Check if target is document URI with fragment
    if (trimmed.includes('#')) {
      const [baseUri, frag] = trimmed.split('#');
      if (this.normalizeUriString(baseUri) === this.normalizeUriString(documentUri)) {
        return {
          isValid: true,
          classification: 'same-document',
          normalizedUri: documentUri + '#' + frag,
          fragment: frag,
        };
      }
    }

    // Check external web schemes
    try {
      const parsed = new URL(trimmed);
      if (this.APPROVED_EXTERNAL_SCHEMES.includes(parsed.protocol)) {
        return {
          isValid: true,
          classification: 'external-web',
          normalizedUri: parsed.href,
        };
      }

      if (parsed.protocol === 'file:') {
        return this.validateFileUri(parsed.href, workspaceRoots);
      }

      // Any other protocol
      return {
        isValid: false,
        classification: 'unsupported',
        reason: `Unsupported URI protocol: ${parsed.protocol}`,
      };
    } catch {
      // Not a standard absolute URL; evaluate as a relative or local file path
      return this.validateRelativeOrLocalPath(trimmed, documentUri, workspaceRoots);
    }
  }

  /**
   * Validates a file: URI against workspace roots.
   */
  private static validateFileUri(
    fileUri: string,
    workspaceRoots: string[]
  ): UriValidationResult {
    let canonicalUri: string;
    try {
      const filePath = LspUriMapper.uriToPath(fileUri);
      const normalizedPath = normalizeWorkspacePath(filePath);
      canonicalUri = LspUriMapper.pathToUri(normalizedPath);
    } catch {
      canonicalUri = normalizeWorkspacePath(fileUri);
    }

    if (workspaceRoots.length === 0) {
      return {
        isValid: true,
        classification: 'workspace-local',
        normalizedUri: canonicalUri,
      };
    }

    const isInWorkspace = workspaceRoots.some((root) =>
      isResourceInRoot(root, canonicalUri)
    );

    return {
      isValid: true,
      classification: isInWorkspace ? 'workspace-local' : 'outside-workspace',
      normalizedUri: canonicalUri,
    };
  }

  /**
   * Evaluates relative paths or local paths.
   */
  private static validateRelativeOrLocalPath(
    pathStr: string,
    documentUri: string,
    workspaceRoots: string[]
  ): UriValidationResult {
    // Resolve relative to document directory
    let resolvedPath = pathStr;

    if (!pathStr.startsWith('/') && !/^[a-zA-Z]:/.test(pathStr) && !pathStr.startsWith('file://')) {
      const docPath = documentUri.startsWith('file://') ? LspUriMapper.uriToPath(documentUri) : documentUri;
      const lastSlash = Math.max(docPath.lastIndexOf('/'), docPath.lastIndexOf('\\'));
      if (lastSlash > 0) {
        const docDir = docPath.slice(0, lastSlash);
        resolvedPath = `${docDir}/${pathStr}`;
      }
    }

    let canonicalUri: string;
    try {
      const filePath = resolvedPath.startsWith('file://')
        ? LspUriMapper.uriToPath(resolvedPath)
        : resolvedPath;
      const normalizedPath = normalizeWorkspacePath(filePath);
      canonicalUri = LspUriMapper.pathToUri(normalizedPath);
    } catch {
      canonicalUri = normalizeWorkspacePath(resolvedPath);
    }

    if (workspaceRoots.length === 0) {
      return {
        isValid: true,
        classification: 'workspace-local',
        normalizedUri: canonicalUri,
      };
    }

    const isInWorkspace = workspaceRoots.some((root) =>
      isResourceInRoot(root, canonicalUri)
    );

    return {
      isValid: true,
      classification: isInWorkspace ? 'workspace-local' : 'outside-workspace',
      normalizedUri: canonicalUri,
    };
  }

  /**
   * Sanitizes user-visible tooltip content.
   */
  public static sanitizeTooltip(rawTooltip: unknown): string | undefined {
    if (typeof rawTooltip !== 'string') return undefined;

    let text = rawTooltip
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .trim();

    if (text.length > this.MAX_TOOLTIP_LENGTH) {
      text = text.slice(0, this.MAX_TOOLTIP_LENGTH - 3) + '...';
    }

    return text.length > 0 ? text : undefined;
  }

  private static normalizeUriString(uri: string): string {
    return normalizeWorkspacePath(uri).toLowerCase();
  }
}
