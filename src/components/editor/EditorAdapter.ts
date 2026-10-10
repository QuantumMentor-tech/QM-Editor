import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { oneDark } from '@codemirror/theme-one-dark';
import { ThemeMode } from '../../types';

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
