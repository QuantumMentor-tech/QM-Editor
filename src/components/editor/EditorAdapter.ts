import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, Decoration, DecorationSet } from '@codemirror/view';
import { EditorState, Compartment, StateEffect, StateField, EditorSelection } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { ThemeMode } from '../../types';

export interface MatchRange {
  from: number;
  to: number;
}

export const setSearchMatchesEffect = StateEffect.define<{
  matches: MatchRange[];
  currentIndex: number;
}>();

export const clearSearchMatchesEffect = StateEffect.define<void>();

const searchMatchDecoration = Decoration.mark({ class: 'cm-search-match' });
const currentMatchDecoration = Decoration.mark({ class: 'cm-search-match-current' });

export const searchHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setSearchMatchesEffect)) {
        const { matches, currentIndex } = effect.value;
        const decos: any[] = [];
        matches.forEach((m, idx) => {
          if (m.from < m.to) {
            const isCurrent = idx === currentIndex;
            const deco = isCurrent ? currentMatchDecoration : searchMatchDecoration;
            decos.push(deco.range(m.from, m.to));
          }
        });
        return Decoration.set(decos, true);
      } else if (effect.is(clearSearchMatchesEffect)) {
        return Decoration.none;
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export interface EditorAdapterOptions {
  readOnly?: boolean;
  theme?: ThemeMode;
  onChange?: (newContent: string) => void;
}

export interface EditorAdapterInterface {
  mount(container: HTMLElement, initialContent: string, options?: EditorAdapterOptions): void;
  setContent(content: string): void;
  getContent(): string;
  setReadOnly(readOnly: boolean): void;
  setTheme(theme: ThemeMode): void;
  selectAndRevealRange(from: number, to: number): void;
  highlightMatches(matches: MatchRange[], currentIndex: number): void;
  clearSearchHighlights(): void;
  getSelectedText(): string;
  focus(): void;
  dispose(): void;
}

export class CodeMirrorEditorAdapter implements EditorAdapterInterface {
  private view: EditorView | null = null;
  private readOnlyCompartment = new Compartment();
  private themeCompartment = new Compartment();
  private isUpdatingProgrammatically = false;
  private onChangeCallback: ((newContent: string) => void) | null = null;

  public mount(container: HTMLElement, initialContent: string, options: EditorAdapterOptions = {}): void {
    this.dispose();

    this.onChangeCallback = options.onChange || null;

    const readOnlyExtension = this.readOnlyCompartment.of(
      EditorState.readOnly.of(options.readOnly ?? false)
    );

    const themeExtension = this.themeCompartment.of(
      options.theme === 'light' ? [] : oneDark
    );

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        readOnlyExtension,
        themeExtension,
        searchHighlightField,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !this.isUpdatingProgrammatically) {
            const newContent = update.state.doc.toString();
            if (this.onChangeCallback) {
              this.onChangeCallback(newContent);
            }
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '0.95rem',
            fontFamily: 'var(--font-code)',
          },
          '.cm-scroller': {
            overflow: 'auto',
          },
          '.cm-content': {
            padding: '16px 0',
          },
          '.cm-search-match': {
            backgroundColor: 'rgba(234, 179, 8, 0.35)',
            borderRadius: '2px',
          },
          '.cm-search-match-current': {
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            color: '#ffffff',
            borderRadius: '2px',
          },
        }),
      ],
    });

    this.view = new EditorView({
      state,
      parent: container,
    });
  }

  public setContent(content: string): void {
    if (!this.view) return;

    const currentContent = this.view.state.doc.toString();
    if (currentContent === content) return;

    this.isUpdatingProgrammatically = true;
    this.view.dispatch({
      changes: {
        from: 0,
        to: currentContent.length,
        insert: content,
      },
    });
    this.isUpdatingProgrammatically = false;
  }

  public getContent(): string {
    return this.view ? this.view.state.doc.toString() : '';
  }

  public setReadOnly(readOnly: boolean): void {
    if (!this.view) return;
    this.view.dispatch({
      effects: this.readOnlyCompartment.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }

  public setTheme(theme: ThemeMode): void {
    if (!this.view) return;
    this.view.dispatch({
      effects: this.themeCompartment.reconfigure(theme === 'light' ? [] : oneDark),
    });
  }

  public selectAndRevealRange(from: number, to: number): void {
    if (!this.view) return;
    const maxLen = this.view.state.doc.length;
    const safeFrom = Math.max(0, Math.min(from, maxLen));
    const safeTo = Math.max(safeFrom, Math.min(to, maxLen));

    this.view.dispatch({
      selection: EditorSelection.single(safeFrom, safeTo),
      scrollIntoView: true,
    });
  }

  public highlightMatches(matches: MatchRange[], currentIndex: number): void {
    if (!this.view) return;
    this.view.dispatch({
      effects: setSearchMatchesEffect.of({ matches, currentIndex }),
    });
  }

  public clearSearchHighlights(): void {
    if (!this.view) return;
    this.view.dispatch({
      effects: clearSearchMatchesEffect.of(),
    });
  }

  public getSelectedText(): string {
    if (!this.view) return '';
    const mainSel = this.view.state.selection.main;
    if (mainSel.empty) return '';
    return this.view.state.sliceDoc(mainSel.from, mainSel.to);
  }

  public focus(): void {
    if (this.view) {
      this.view.focus();
    }
  }

  public dispose(): void {
    if (this.view) {
      this.view.destroy();
      this.view = null;
    }
    this.onChangeCallback = null;
  }
}
