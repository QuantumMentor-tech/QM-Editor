/**
 * QM Editor - LSP Semantic Tokens CodeMirror 6 Extension
 * 
 * Provides the StateField, StateEffects, and decoration set management for
 * rendering semantic highlighting in the editor with zero layout jitter.
 */

import { StateField, StateEffect, Extension } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { EditorSemanticTokenDecoration } from './LspSemanticTokenTypes';
import { semanticTokensTheme } from './LspSemanticTokenTheme';

export const setSemanticTokensEffect = StateEffect.define<EditorSemanticTokenDecoration[]>();
export const clearSemanticTokensEffect = StateEffect.define<void>();

export const semanticTokensField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    // Incrementally map existing decorations across document changes
    decorations = decorations.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(setSemanticTokensEffect)) {
        const items = effect.value || [];
        const decos: Array<ReturnType<typeof Decoration.mark> extends { range: (f: number, t: number) => infer R } ? R : any> = [];

        for (const item of items) {
          if (item.from < item.to && item.from >= 0 && item.to <= tr.newDoc.length) {
            const deco = Decoration.mark({
              class: item.className,
              attributes: {
                'data-semantic-type': item.tokenType,
              },
            });
            decos.push(deco.range(item.from, item.to));
          }
        }

        // CodeMirror requires decorations in Decoration.set() to be sorted by `from` ascending
        decos.sort((a, b) => {
          if (a.from !== b.from) {
            return a.from - b.from;
          }
          return a.to - b.to;
        });

        // Filter out any invalid ranges
        return Decoration.set(decos, true);
      } else if (effect.is(clearSemanticTokensEffect)) {
        return Decoration.none;
      }
    }

    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Returns the combined CodeMirror 6 extension for semantic tokens.
 */
export function semanticTokensExtension(): Extension[] {
  return [semanticTokensField, semanticTokensTheme];
}
