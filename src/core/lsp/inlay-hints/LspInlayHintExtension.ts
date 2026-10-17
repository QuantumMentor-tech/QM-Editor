/**
 * QM Editor - LSP Inlay Hints CodeMirror 6 Extension
 * Phase 06, Step 65 — LSP Inlay Hints, Parameter Names, Type Information & Inline Semantic Annotations
 * 
 * Provides the StateField, StateEffects, and decoration set management for
 * rendering inline non-mutating inlay hint widgets.
 */

import { StateField, StateEffect, Extension, Range } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { EditorInlayHintDecoration } from './LspInlayHintTypes';
import { InlayHintWidget } from './LspInlayHintWidget';
import { inlayHintsTheme } from './LspInlayHintTheme';

export const setInlayHintsEffect = StateEffect.define<EditorInlayHintDecoration[]>();
export const clearInlayHintsEffect = StateEffect.define<void>();

export const inlayHintsField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    // Map existing hint widget positions through document transactions
    decorations = decorations.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(setInlayHintsEffect)) {
        const items = effect.value || [];
        const widgets: Range<Decoration>[] = [];

        for (const hint of items) {
          if (hint.from >= 0 && hint.from <= tr.newDoc.length) {
            const widgetDeco = Decoration.widget({
              widget: new InlayHintWidget(hint),
              side: 1,
            });
            widgets.push(widgetDeco.range(hint.from));
          }
        }

        // CodeMirror requires decorations in Decoration.set() to be sorted by `from` ascending
        widgets.sort((a, b) => a.from - b.from);

        return Decoration.set(widgets, true);
      } else if (effect.is(clearInlayHintsEffect)) {
        return Decoration.none;
      }
    }

    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Returns the combined CodeMirror 6 extension for inlay hints.
 */
export function inlayHintsExtension(): Extension[] {
  return [inlayHintsField, inlayHintsTheme];
}
