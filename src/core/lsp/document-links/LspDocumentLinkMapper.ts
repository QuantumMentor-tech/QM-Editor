/**
 * QM Editor - LSP Document Link Mapper
 * Phase 06, Step 67 — LSP Document Links, Clickable Resource References & Safe URI Navigation
 * 
 * Maps raw language server DocumentLink responses into canonical models, verifies document bounds,
 * computes buffer offsets, and produces sorted decorations for CodeMirror 6 inline marks.
 */

import { Logger } from '../../../utils/logger';
import { LspDocumentLink } from '../LspTypes';
import {
  CanonicalDocumentLink,
  EditorDocumentLinkDecoration,
  UriClassification,
} from './LspDocumentLinkTypes';
import { LspDocumentLinkSecurityValidator } from './LspDocumentLinkSecurityValidator';

export class LspDocumentLinkMapper {
  /** Maximum number of document links accepted per document to prevent memory DoS */
  public static readonly MAX_LINKS_PER_DOCUMENT = 1000;

  /**
   * Maps a raw LSP DocumentLink array into canonical document links and editor decorations.
   */
  public static mapToDecorations(
    uri: string,
    documentRevision: number,
    providerId: string,
    sessionId: string,
    rawLinks: unknown,
    documentText: string,
    workspaceRoots: string[] = []
  ): { links: CanonicalDocumentLink[]; decorations: EditorDocumentLinkDecoration[] } {
    if (!Array.isArray(rawLinks)) {
      if (rawLinks !== null && rawLinks !== undefined) {
        Logger.warn('LspDocumentLinkMapper: Expected array of document links, received non-array', {
          type: typeof rawLinks,
        });
      }
      return { links: [], decorations: [] };
    }

    const lines = documentText.split('\n');
    const lineStarts = this.computeLineStarts(documentText);
    const count = Math.min(rawLinks.length, this.MAX_LINKS_PER_DOCUMENT);

    if (rawLinks.length > this.MAX_LINKS_PER_DOCUMENT) {
      Logger.warn(
        `LspDocumentLinkMapper: Response contained ${rawLinks.length} links, capped at ${this.MAX_LINKS_PER_DOCUMENT}`
      );
    }

    const canonicalLinks: CanonicalDocumentLink[] = [];
    const decorations: EditorDocumentLinkDecoration[] = [];

    for (let i = 0; i < count; i++) {
      const raw = rawLinks[i] as Partial<LspDocumentLink>;
      if (!raw || typeof raw !== 'object') continue;

      if (!LspDocumentLinkSecurityValidator.validateRange(raw.range, lines)) {
        continue;
      }

      const range = raw.range!;
      const startLineOffset = lineStarts[range.start.line] ?? 0;
      const endLineOffset = lineStarts[range.end.line] ?? 0;

      const from = Math.min(startLineOffset + range.start.character, documentText.length);
      const to = Math.min(endLineOffset + range.end.character, documentText.length);

      if (from >= to) {
        continue;
      }

      // Check target URI classification
      let classification: UriClassification = 'workspace-local';
      let normalizedTarget: string | undefined = undefined;
      const isResolved = Boolean(raw.target);

      if (raw.target) {
        const valRes = LspDocumentLinkSecurityValidator.classifyAndValidateUri(
          raw.target,
          uri,
          workspaceRoots
        );
        classification = valRes.classification;
        normalizedTarget = valRes.normalizedUri ?? raw.target;
      }

      const tooltip = LspDocumentLinkSecurityValidator.sanitizeTooltip(raw.tooltip);
      const id = `${uri}:${from}:${to}:${providerId}:${i}`;

      const canonical: CanonicalDocumentLink = {
        id,
        uri,
        documentRevision,
        range,
        from,
        to,
        target: normalizedTarget,
        tooltip,
        data: raw.data,
        isResolved,
        classification,
        providerId,
        sessionId,
      };

      canonicalLinks.push(canonical);

      const className = this.computeClassName(classification);

      decorations.push({
        id,
        from,
        to,
        target: normalizedTarget,
        tooltip,
        classification,
        className,
      });
    }

    // Sort decorations by `from` ascending, then `to` ascending for CodeMirror Decoration.set()
    decorations.sort((a, b) => {
      if (a.from !== b.from) {
        return a.from - b.from;
      }
      return a.to - b.to;
    });

    return { links: canonicalLinks, decorations };
  }

  /**
   * Pre-computes 0-based start character offsets for each line in the document.
   */
  public static computeLineStarts(text: string): number[] {
    const starts: number[] = [0];
    let offset = 0;
    while ((offset = text.indexOf('\n', offset)) !== -1) {
      offset += 1;
      starts.push(offset);
    }
    return starts;
  }

  private static computeClassName(classification: UriClassification): string {
    switch (classification) {
      case 'external-web':
        return 'cm-document-link cm-document-link-external';
      case 'same-document':
        return 'cm-document-link cm-document-link-internal';
      case 'outside-workspace':
        return 'cm-document-link cm-document-link-outside';
      case 'unsupported':
      case 'malformed':
        return 'cm-document-link cm-document-link-unsupported';
      case 'workspace-local':
      default:
        return 'cm-document-link cm-document-link-local';
    }
  }
}
