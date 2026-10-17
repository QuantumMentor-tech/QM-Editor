/**
 * QM Editor - LSP Inlay Hints Mapper
 * Phase 06, Step 65 — LSP Inlay Hints, Parameter Names, Type Information & Inline Semantic Annotations
 * 
 * Maps validated LSP Inlay Hints into canonical EditorInlayHintDecoration objects
 * with precise CodeMirror document offsets, class names, and sorting.
 */

import { ValidatedInlayHint } from './LspInlayHintValidator';
import { EditorInlayHintDecoration } from './LspInlayHintTypes';

export interface InlayHintMappingOptions {
  includeParameters?: boolean;
  includeTypes?: boolean;
}

export class LspInlayHintMapper {
  /**
   * Converts validated inlay hints to sorted editor decorations.
   * 
   * @param uri The document URI
   * @param hints The validated hints from server
   * @param documentText The full document content string
   * @param options Filtering options (e.g. from user settings)
   */
  public static mapToDecorations(
    uri: string,
    hints: readonly ValidatedInlayHint[],
    documentText: string,
    options: InlayHintMappingOptions = {}
  ): EditorInlayHintDecoration[] {
    const includeParams = options.includeParameters !== false;
    const includeTypes = options.includeTypes !== false;

    // Precompute line starts for fast line-to-offset conversion
    const lineStarts = this.computeLineStarts(documentText);
    const docLength = documentText.length;
    const decorations: EditorInlayHintDecoration[] = [];

    for (let i = 0; i < hints.length; i++) {
      const hint = hints[i];

      // Filter based on kind settings
      if (hint.kind === 'parameter' && !includeParams) {
        continue;
      }
      if (hint.kind === 'type' && !includeTypes) {
        continue;
      }

      const lineStart = lineStarts[hint.line];
      if (lineStart === undefined) {
        continue;
      }

      // Calculate character offset and clamp to document length
      const from = Math.min(docLength, Math.max(0, lineStart + hint.character));

      // Construct CSS classes
      const classNames = ['cm-inlay-hint'];
      if (hint.kind === 'parameter') {
        classNames.push('cm-inlay-hint-parameter');
      } else if (hint.kind === 'type') {
        classNames.push('cm-inlay-hint-type');
      } else {
        classNames.push('cm-inlay-hint-other');
      }

      if (hint.paddingLeft) {
        classNames.push('cm-inlay-hint-pad-left');
      }
      if (hint.paddingRight) {
        classNames.push('cm-inlay-hint-pad-right');
      }

      // Format label text with padding if needed
      let formattedLabel = hint.label;
      if (hint.paddingLeft && !formattedLabel.startsWith(' ')) {
        formattedLabel = ' ' + formattedLabel;
      }
      if (hint.paddingRight && !formattedLabel.endsWith(' ')) {
        formattedLabel = formattedLabel + ' ';
      }

      const id = `${uri}:${hint.line}:${hint.character}:${hint.kind}:${hint.label}:${i}`;

      decorations.push({
        id,
        from,
        label: formattedLabel,
        kind: hint.kind,
        tooltip: hint.tooltip,
        paddingLeft: hint.paddingLeft,
        paddingRight: hint.paddingRight,
        className: classNames.join(' '),
      });
    }

    // CodeMirror Decoration.set requires widgets to be strictly sorted by `from` ascending
    decorations.sort((a, b) => {
      if (a.from !== b.from) {
        return a.from - b.from;
      }
      return a.id.localeCompare(b.id);
    });

    return decorations;
  }

  /**
   * Precomputes the start offset for each line in the document.
   */
  public static computeLineStarts(text: string): number[] {
    const starts: number[] = [0];
    const len = text.length;

    for (let i = 0; i < len; i++) {
      if (text.charCodeAt(i) === 10 /* '\n' */) {
        starts.push(i + 1);
      }
    }

    return starts;
  }
}
