/**
 * QM Editor LSP Diagnostic Mapper
 * Phase 06, Step 57 — LSP Diagnostics Integration, Problems Synchronization & Diagnostic Lifecycle
 *
 * Converts validated 0-based LSP diagnostic protocol items into canonical 1-based QM Editor
 * Diagnostic model instances. Preserves provider identity, tags, related information, and code links.
 */

import {
  LspDiagnostic,
  LspDiagnosticSeverity,
  LspDiagnosticSessionContext,
} from '../LspTypes';
import {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  DiagnosticRange,
  DiagnosticRelatedInformation,
} from '../../diagnostics/DiagnosticTypes';
import { LspUriMapper } from '../LspUriMapper';

export class LspDiagnosticMapper {
  /**
   * Converts a validated LspDiagnostic to a canonical Diagnostic model.
   */
  public static toCanonicalDiagnostic(
    lspDiag: LspDiagnostic,
    resourceUri: string,
    index: number,
    sessionContext?: LspDiagnosticSessionContext,
    version?: number
  ): Diagnostic {
    const providerId = sessionContext
      ? `lsp:${sessionContext.serverDefinitionId}`
      : 'lsp';

    const source = lspDiag.source || sessionContext?.displayName || 'lsp';

    // 0-based to 1-based coordinates
    const startLine = lspDiag.range.start.line + 1;
    const startColumn = lspDiag.range.start.character + 1;
    const endLine = lspDiag.range.end.line + 1;
    const endColumn = lspDiag.range.end.character + 1;

    const range: DiagnosticRange = {
      startLine,
      startColumn,
      endLine,
      endColumn,
    };

    // ID is deterministic and stable across publications of the same problem
    const id = `${providerId}:${resourceUri}:${startLine}:${startColumn}-${index}`;

    // Map severity
    const severity = LspDiagnosticMapper.mapSeverity(lspDiag.severity);

    // Map tags
    const tags = LspDiagnosticMapper.mapTags(lspDiag.tags);

    // Map related information
    const relatedInformation = LspDiagnosticMapper.mapRelatedInformation(lspDiag.relatedInformation);

    // Merge codeDescription into data payload if present
    let data = lspDiag.data;
    if (lspDiag.codeDescription?.href) {
      if (typeof data === 'object' && data !== null) {
        data = { ...data, codeDescriptionHref: lspDiag.codeDescription.href };
      } else {
        data = { codeDescriptionHref: lspDiag.codeDescription.href, rawData: data };
      }
    }

    return {
      id,
      uri: resourceUri,
      range,
      severity,
      message: lspDiag.message,
      source,
      providerId,
      workspaceId: sessionContext?.workspaceId,
      generation: sessionContext?.generation,
      code: lspDiag.code,
      tags,
      relatedInformation,
      documentRevision: version,
      data,
      createdAt: Date.now(),
    };
  }

  /**
   * Translates LSP numeric severity into canonical DiagnosticSeverity string.
   */
  public static mapSeverity(lspSeverity?: LspDiagnosticSeverity): DiagnosticSeverity {
    switch (lspSeverity) {
      case 1:
        return 'error';
      case 2:
        return 'warning';
      case 3:
        return 'info';
      case 4:
        return 'hint';
      default:
        return 'error';
    }
  }

  /**
   * Translates LSP numeric tags into canonical DiagnosticTag strings.
   * 1 = Unnecessary, 2 = Deprecated
   */
  public static mapTags(lspTags?: number[]): DiagnosticTag[] | undefined {
    if (!Array.isArray(lspTags) || lspTags.length === 0) {
      return undefined;
    }

    const tags: DiagnosticTag[] = [];
    for (const t of lspTags) {
      if (t === 1) tags.push('unnecessary');
      else if (t === 2) tags.push('deprecated');
    }

    return tags.length > 0 ? tags : undefined;
  }

  /**
   * Translates related information to canonical format with 1-based coordinates.
   */
  public static mapRelatedInformation(
    related?: LspDiagnostic['relatedInformation']
  ): DiagnosticRelatedInformation[] | undefined {
    if (!Array.isArray(related) || related.length === 0) {
      return undefined;
    }

    const result: DiagnosticRelatedInformation[] = [];
    for (const rel of related) {
      const canonicalPath = LspUriMapper.uriToPath(rel.location.uri);
      result.push({
        location: {
          uri: canonicalPath,
          range: {
            startLine: rel.location.range.start.line + 1,
            startColumn: rel.location.range.start.character + 1,
            endLine: rel.location.range.end.line + 1,
            endColumn: rel.location.range.end.character + 1,
          },
        },
        message: rel.message,
      });
    }

    return result.length > 0 ? result : undefined;
  }
}
