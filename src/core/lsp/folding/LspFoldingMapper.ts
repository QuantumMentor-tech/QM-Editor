/**
 * QM Editor — LSP Folding Range Mapper
 * Phase 06, Step 68 — LSP Folding Ranges, Smart Code Folding & Safe Document Structure Navigation
 * 
 * Maps validated LSP folding ranges into canonical data models and buffer character offsets
 * suitable for consumption by CodeMirror 6 folding extensions.
 */

import { ValidatedFoldingRange } from './LspFoldingValidator';
import { CanonicalFoldingRange, EditorFoldingRange } from './LspFoldingTypes';

export interface DocumentLineInfo {
  lines: number;
  length: number;
  line: (n: number) => { from: number; to: number; length: number; number: number };
}

export interface FoldingMappingOptions {
  documentUri: string;
  documentRevision: number;
  providerId: string;
  providerGeneration: number;
  importsEnabled?: boolean;
  commentsEnabled?: boolean;
}

export class LspFoldingMapper {
  /**
   * Maps validated LSP folding ranges into canonical folding ranges with buffer offsets.
   */
  public static mapToCanonicalRanges(
    validatedRanges: ValidatedFoldingRange[],
    doc: DocumentLineInfo,
    options: FoldingMappingOptions
  ): CanonicalFoldingRange[] {
    const {
      documentUri,
      documentRevision,
      providerId,
      providerGeneration,
      importsEnabled = true,
      commentsEnabled = true,
    } = options;

    const canonical: CanonicalFoldingRange[] = [];

    for (const r of validatedRanges) {
      // Filter out disabled kinds based on user settings
      if (r.kind === 'imports' && !importsEnabled) {
        continue;
      }
      if (r.kind === 'comment' && !commentsEnabled) {
        continue;
      }

      // Convert 0-based LSP lines to 1-based CodeMirror line numbers
      const startLineNum = r.startLine + 1;
      const endLineNum = r.endLine + 1;

      if (startLineNum < 1 || startLineNum > doc.lines || endLineNum < 1 || endLineNum > doc.lines) {
        continue;
      }

      const startLineObj = doc.line(startLineNum);
      const endLineObj = doc.line(endLineNum);

      let from: number;
      let to: number;

      if (r.startLine === r.endLine) {
        // Single-line fold
        const startChar = r.startCharacter !== undefined ? r.startCharacter : 0;
        const endChar = r.endCharacter !== undefined ? r.endCharacter : startLineObj.length;
        from = Math.min(startLineObj.to, startLineObj.from + startChar);
        to = Math.min(startLineObj.to, startLineObj.from + endChar);
      } else {
        // Multiline fold: fold marker is placed at the end of the start line
        // (or after startCharacter if given), and fold covers up to endCharacter or end of endLine
        if (r.startCharacter !== undefined && r.startCharacter < startLineObj.length) {
          from = startLineObj.from + r.startCharacter;
        } else {
          from = startLineObj.to;
        }

        if (r.endCharacter !== undefined && r.endCharacter <= endLineObj.length) {
          to = endLineObj.from + r.endCharacter;
        } else {
          to = endLineObj.to;
        }
      }

      // Ensure from < to and bounded within document length
      if (from >= to || to > doc.length) {
        continue;
      }

      const id = `fold:${documentUri}:${r.startLine}:${r.endLine}:${r.kind || 'generic'}:${providerGeneration}`;

      canonical.push({
        id,
        documentUri,
        startLine: r.startLine,
        startCharacter: r.startCharacter,
        endLine: r.endLine,
        endCharacter: r.endCharacter,
        from,
        to,
        kind: r.kind,
        collapsedText: r.collapsedText,
        providerId,
        providerGeneration,
        documentRevision,
        source: 'lsp',
      });
    }

    return canonical;
  }

  /**
   * Converts canonical folding ranges into lightweight EditorFoldingRange objects for CodeMirror.
   */
  public static mapToEditorRanges(canonicalRanges: CanonicalFoldingRange[]): EditorFoldingRange[] {
    return canonicalRanges.map((c) => ({
      from: c.from,
      to: c.to,
      startLine: c.startLine + 1,
      endLine: c.endLine + 1,
      kind: c.kind,
      collapsedText: c.collapsedText,
    }));
  }
}
