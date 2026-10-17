/**
 * QM Editor - LSP Document Link CodeMirror 6 Extension
 * Phase 06, Step 67 — LSP Document Links, Clickable Resource References & Safe URI Navigation
 * 
 * Provides StateField, StateEffects, decoration set management, and click/keyboard
 * interaction handlers for clickable document links.
 */

import { StateField, StateEffect, Extension } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';
import { EditorDocumentLinkDecoration } from './LspDocumentLinkTypes';
import { documentLinkTheme } from './LspDocumentLinkTheme';

export const setDocumentLinksEffect = StateEffect.define<EditorDocumentLinkDecoration[]>();
export const clearDocumentLinksEffect = StateEffect.define<void>();

export type DocumentLinkClickHandler = (linkId: string) => void;

let globalClickHandler: DocumentLinkClickHandler | null = null;

export class LspDocumentLinkExtension {
  public static setLinkClickHandler(handler: DocumentLinkClickHandler | null): void {
    globalClickHandler = handler;
  }
}

export const documentLinksField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    // Incrementally map decorations through document edits
    decorations = decorations.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(setDocumentLinksEffect)) {
        const items = effect.value || [];
        const decos: Array<ReturnType<typeof Decoration.mark> extends { range: (f: number, t: number) => infer R } ? R : any> = [];

        for (const item of items) {
          if (item.from < item.to && item.from >= 0 && item.to <= tr.newDoc.length) {
            const attrs: Record<string, string> = {
              'data-link-id': item.id,
              role: 'link',
              tabindex: '0',
            };
            if (item.tooltip) {
              attrs.title = item.tooltip;
            } else if (item.target) {
              attrs.title = item.target;
            }

            const deco = Decoration.mark({
              class: item.className,
              attributes: attrs,
            });

            decos.push(deco.range(item.from, item.to));
          }
        }

        // CodeMirror requires decorations in Decoration.set() to be sorted ascending
        decos.sort((a, b) => {
          if (a.from !== b.from) {
            return a.from - b.from;
          }
          return a.to - b.to;
        });

        return Decoration.set(decos, true);
      } else if (effect.is(clearDocumentLinksEffect)) {
        return Decoration.none;
      }
    }

    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Event handlers capturing link clicks and keyboard activation.
 */
const documentLinkEventHandler = EditorView.domEventHandlers({
  click(event: MouseEvent, _view: EditorView) {
    const target = event.target as HTMLElement | null;
    const linkEl = target?.closest?.('.cm-document-link');
    if (!linkEl) return false;

    const linkId = linkEl.getAttribute('data-link-id');
    if (linkId && globalClickHandler) {
      event.preventDefault();
      event.stopPropagation();
      globalClickHandler(linkId);
      return true;
    }
    return false;
  },
  keydown(event: KeyboardEvent, view: EditorView) {
    if (event.key === 'Enter' || event.key === ' ') {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl?.classList?.contains('cm-document-link')) {
        const linkId = activeEl.getAttribute('data-link-id');
        if (linkId && globalClickHandler) {
          event.preventDefault();
          event.stopPropagation();
          globalClickHandler(linkId);
          return true;
        }
      }

      // Check cursor position inside link decoration
      const pos = view.state.selection.main.head;
      const decos = view.state.field(documentLinksField, false);
      if (decos) {
        let matchedId: string | null = null;
        decos.between(pos, pos, (_from, _to, value) => {
          if (value.spec.attributes?.['data-link-id']) {
            matchedId = value.spec.attributes['data-link-id'];
            return false;
          }
          return undefined;
        });

        if (matchedId && globalClickHandler) {
          event.preventDefault();
          event.stopPropagation();
          globalClickHandler(matchedId);
          return true;
        }
      }
    }
    return false;
  },
});

export const documentLinkExtensions: Extension = [
  documentLinksField,
  documentLinkTheme,
  documentLinkEventHandler,
];
