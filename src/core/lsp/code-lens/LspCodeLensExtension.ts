/**
 * QM Editor - LSP Code Lens CodeMirror 6 Extension
 * Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration
 * 
 * Provides the StateField, StateEffects, and decoration set management for
 * rendering non-mutating line block widgets for Code Lens actions.
 */

import { StateField, StateEffect, Extension, Range } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { EditorCodeLensLine } from './LspCodeLensTypes';
import { CodeLensWidget } from './LspCodeLensWidget';
import { codeLensTheme } from './LspCodeLensTheme';

export const setCodeLensesEffect = StateEffect.define<EditorCodeLensLine[]>();
export const clearCodeLensesEffect = StateEffect.define<void>();

export const codeLensField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    // Map existing block widget positions through document transactions
    decorations = decorations.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(setCodeLensesEffect)) {
        const lines = effect.value || [];
        const widgets: Range<Decoration>[] = [];

        for (const line of lines) {
          if (line.from >= 0 && line.from <= tr.newDoc.length && line.lenses.length > 0) {
            const widgetDeco = Decoration.widget({
              widget: new CodeLensWidget(line),
              block: true,
              side: -1,
            });
            widgets.push(widgetDeco.range(line.from));
          }
        }

        // CodeMirror requires decorations in Decoration.set() to be sorted by `from` ascending
        widgets.sort((a, b) => a.from - b.from);

        return Decoration.set(widgets, true);
      } else if (effect.is(clearCodeLensesEffect)) {
        return Decoration.none;
      }
    }

    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Returns the combined CodeMirror 6 extension for Code Lens.
 */
export function codeLensExtension(): Extension[] {
  return [codeLensField, codeLensTheme];
}
