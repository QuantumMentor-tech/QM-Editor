import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
  highlightWhitespace,
  highlightTrailingWhitespace,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  Decoration,
  DecorationSet,
} from '@codemirror/view';
import {
  EditorState,
  Compartment,
  StateEffect,
  StateField,
  EditorSelection,
  Extension,
} from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, undoDepth, redoDepth, selectAll } from '@codemirror/commands';
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  foldAll,
  unfoldAll,
  indentUnit,
  indentOnInput,
} from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { ThemeMode, EditorSettings } from '../../types';
import { DEFAULT_EDITOR_SETTINGS } from '../../services/PreferencesService';
import { Diagnostic } from '../../core/diagnostics/DiagnosticTypes';
import { rangeToCharacterOffsets } from '../../core/diagnostics/DiagnosticValidation';
import { Range } from '../../core/navigation/LocationTypes';

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

export const setDiagnosticsEffect = StateEffect.define<Diagnostic[]>();
export const clearDiagnosticsEffect = StateEffect.define<void>();

function createDiagnosticDecoration(diag: Diagnostic) {
  const codePart = diag.code !== undefined ? ` [${diag.code}]` : '';
  const title = `${diag.source ? `[${diag.source}] ` : ''}${diag.message}${codePart}`;
  const className = `cm-diagnostic-${diag.severity || 'error'}`;

  return Decoration.mark({
    class: className,
    attributes: {
      title,
      'aria-label': `${diag.severity}: ${diag.message}`,
    },
  });
}

export const diagnosticHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setDiagnosticsEffect)) {
        const diags = effect.value || [];
        const docText = tr.newDoc.toString();
        const decos: any[] = [];

        for (const diag of diags) {
          const { from, to } = rangeToCharacterOffsets(diag.range, docText);
          if (from < to) {
            const deco = createDiagnosticDecoration(diag);
            decos.push(deco.range(from, to));
          }
        }

        // Sort decorations by range start
        decos.sort((a, b) => a.from - b.from);
        return Decoration.set(decos, true);
      } else if (effect.is(clearDiagnosticsEffect)) {
        return Decoration.none;
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Custom auto-closing brackets & quotes extension for CodeMirror
 */
const autoClosingBracketsExtension = EditorView.inputHandler.of((view, from, to, text) => {
  if (view.state.readOnly) return false;

  const pairs: Record<string, string> = {
    '(': ')',
    '[': ']',
    '{': '}',
    '"': '"',
    "'": "'",
    '`': '`',
  };

  const closeChars = new Set([')', ']', '}', '"', "'", '`']);

  if (closeChars.has(text) && from === to) {
    const nextChar = view.state.sliceDoc(from, from + 1);
    if (nextChar === text) {
      view.dispatch({
        selection: EditorSelection.single(from + 1, from + 1),
      });
      return true;
    }
  }

  const closing = pairs[text];
  if (!closing) return false;

  if (from < to) {
    const selected = view.state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: text + selected + closing },
      selection: EditorSelection.single(from + 1, to + 1),
    });
    return true;
  }

  view.dispatch({
    changes: { from, to, insert: text + closing },
    selection: EditorSelection.single(from + 1, from + 1),
  });
  return true;
});

export interface EditorAdapterOptions {
  readOnly?: boolean;
  theme?: ThemeMode;
  language?: string;
  settings?: EditorSettings;
  onChange?: (newContent: string, meta?: EditorChangeMetadata) => void;
  onCursorActivity?: (pos: { line: number; column: number }) => void;
}

export interface EditorChangeMetadata {
  isComposition?: boolean;
}

export interface EditorAdapterInterface {
  mount(container: HTMLElement, initialContent: string, options?: EditorAdapterOptions): void;
  setContent(content: string): void;
  getContent(): string;
  setReadOnly(readOnly: boolean): void;
  setTheme(theme: ThemeMode): void;
  setLanguage(languageId: string): void;
  setSettings(settings: EditorSettings): void;
  foldAll(): void;
  unfoldAll(): void;
  getCursorPosition(): { line: number; column: number };
  goToLine(line: number, column?: number): void;
  selectAndRevealRange(from: number, to: number): void;
  highlightMatches(matches: MatchRange[], currentIndex: number): void;
  clearSearchHighlights(): void;
  setDiagnostics(diagnostics: Diagnostic[]): void;
  clearDiagnostics(): void;
  getSelectedText(): string;
  applyEdits?(changes: Array<{ from: number; to: number; insert: string }>): void;
  getViewState?(): {
    cursorPosition: { line: number; column: number };
    selections: Array<{ anchor: number; head: number }>;
    scrollPosition?: { top: number; left: number };
  };
  restoreViewState?(state: {
    cursorPosition?: { line: number; column: number };
    selections?: Array<{ anchor: number; head: number }>;
    scrollPosition?: { top: number; left: number };
  }): void;
  undo?(): boolean;
  redo?(): boolean;
  canUndo?(): boolean;
  canRedo?(): boolean;
  clearHistory?(): void;
  getHistoryDepth?(): { undoDepth: number; redoDepth: number };
  selectAll?(): boolean;
  isComposing?(): boolean;
  posAtCoords?(coords: { x: number; y: number }): { line: number; column: number } | null;
  coordsAtPos?(pos?: number): { left: number; top: number; bottom: number } | null;
  focus(): void;
  dispose(): void;
}

export class CodeMirrorEditorAdapter implements EditorAdapterInterface {
  private view: EditorView | null = null;
  private readOnlyCompartment = new Compartment();
  private themeCompartment = new Compartment();
  private languageCompartment = new Compartment();
  private historyCompartment = new Compartment();

  // Settings Compartments
  private fontSizeCompartment = new Compartment();
  private fontFamilyCompartment = new Compartment();
  private lineNumbersCompartment = new Compartment();
  private highlightActiveLineCompartment = new Compartment();
  private wordWrapCompartment = new Compartment();
  private tabSizeCompartment = new Compartment();
  private bracketMatchingCompartment = new Compartment();
  private autoClosingCompartment = new Compartment();
  private whitespaceCompartment = new Compartment();
  private foldingCompartment = new Compartment();

  private isUpdatingProgrammatically = false;
  private onChangeCallback: ((newContent: string, meta?: EditorChangeMetadata) => void) | null = null;
  private onCursorActivityCallback: ((pos: { line: number; column: number }) => void) | null = null;

  public mount(container: HTMLElement, initialContent: string, options: EditorAdapterOptions = {}): void {
    this.dispose();

    this.onChangeCallback = options.onChange || null;
    this.onCursorActivityCallback = options.onCursorActivity || null;
    const settings = options.settings || DEFAULT_EDITOR_SETTINGS;

    const readOnlyExt = this.readOnlyCompartment.of(
      EditorState.readOnly.of(options.readOnly ?? false)
    );
    const themeExt = this.themeCompartment.of(options.theme === 'light' ? [] : oneDark);
    const languageExt = this.languageCompartment.of([]);

    const fontSizeExt = this.fontSizeCompartment.of(
      EditorView.theme({
        '&': {
          fontSize: `${settings.fontSize}px`,
        },
      })
    );

    const fontFamilyExt = this.fontFamilyCompartment.of(
      EditorView.theme({
        '&': {
          fontFamily: settings.fontFamily,
        },
      })
    );

    const lineNumbersExt = this.lineNumbersCompartment.of(
      settings.lineNumbers ? [lineNumbers()] : []
    );

    const highlightActiveLineExt = this.highlightActiveLineCompartment.of(
      settings.highlightActiveLine ? [highlightActiveLine(), highlightActiveLineGutter()] : []
    );

    const wordWrapExt = this.wordWrapCompartment.of(
      settings.wordWrap === 'on' ? [EditorView.lineWrapping] : []
    );

    const tabSizeExt = this.tabSizeCompartment.of([
      EditorState.tabSize.of(settings.tabSize),
      indentUnit.of(settings.insertSpaces ? ' '.repeat(settings.tabSize) : '\t'),
    ]);

    const bracketMatchingExt = this.bracketMatchingCompartment.of(
      settings.bracketMatching ? [bracketMatching()] : []
    );

    const autoClosingExt = this.autoClosingCompartment.of(
      settings.autoClosingBrackets ? [autoClosingBracketsExtension] : []
    );

    const whitespaceExt = this.whitespaceCompartment.of(
      settings.whitespace === 'all'
        ? [highlightWhitespace()]
        : settings.whitespace === 'trailing'
        ? [highlightTrailingWhitespace()]
        : []
    );

    const foldingExt = this.foldingCompartment.of(
      settings.folding ? [foldGutter(), keymap.of(foldKeymap)] : []
    );

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        this.historyCompartment.of([history()]),
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        crosshairCursor(),
        indentOnInput(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        readOnlyExt,
        themeExt,
        languageExt,
        fontSizeExt,
        fontFamilyExt,
        lineNumbersExt,
        highlightActiveLineExt,
        wordWrapExt,
        tabSizeExt,
        bracketMatchingExt,
        autoClosingExt,
        whitespaceExt,
        foldingExt,
        searchHighlightField,
        diagnosticHighlightField,
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !this.isUpdatingProgrammatically) {
            const newContent = update.state.doc.toString();
            if (this.onChangeCallback) {
              this.onChangeCallback(newContent, {
                isComposition: Boolean(update.view.composing),
              });
            }
          }
          if ((update.selectionSet || update.docChanged) && this.onCursorActivityCallback) {
            const pos = this.getCursorPosition();
            this.onCursorActivityCallback(pos);
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
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
          '.cm-diagnostic-error': {
            textDecoration: 'underline wavy #f85149',
            textDecorationSkipInk: 'none',
            backgroundColor: 'rgba(248, 81, 73, 0.12)',
            borderRadius: '1px',
          },
          '.cm-diagnostic-warning': {
            textDecoration: 'underline wavy #d29922',
            textDecorationSkipInk: 'none',
            backgroundColor: 'rgba(210, 153, 34, 0.12)',
            borderRadius: '1px',
          },
          '.cm-diagnostic-info': {
            textDecoration: 'underline wavy #58a6ff',
            textDecorationSkipInk: 'none',
            backgroundColor: 'rgba(88, 166, 255, 0.12)',
            borderRadius: '1px',
          },
          '.cm-diagnostic-hint': {
            textDecoration: 'underline dotted #8b949e',
            textDecorationSkipInk: 'none',
            backgroundColor: 'transparent',
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

  public setLanguage(_languageId: string): void {
    if (!this.view) return;
    const emptyLangExtension: Extension = [];
    this.view.dispatch({
      effects: this.languageCompartment.reconfigure(emptyLangExtension),
    });
  }

  public setSettings(settings: EditorSettings): void {
    if (!this.view) return;

    this.view.dispatch({
      effects: [
        this.fontSizeCompartment.reconfigure(
          EditorView.theme({
            '&': { fontSize: `${settings.fontSize}px` },
          })
        ),
        this.fontFamilyCompartment.reconfigure(
          EditorView.theme({
            '&': { fontFamily: settings.fontFamily },
          })
        ),
        this.lineNumbersCompartment.reconfigure(settings.lineNumbers ? [lineNumbers()] : []),
        this.highlightActiveLineCompartment.reconfigure(
          settings.highlightActiveLine ? [highlightActiveLine(), highlightActiveLineGutter()] : []
        ),
        this.wordWrapCompartment.reconfigure(
          settings.wordWrap === 'on' ? [EditorView.lineWrapping] : []
        ),
        this.tabSizeCompartment.reconfigure([
          EditorState.tabSize.of(settings.tabSize),
          indentUnit.of(settings.insertSpaces ? ' '.repeat(settings.tabSize) : '\t'),
        ]),
        this.bracketMatchingCompartment.reconfigure(
          settings.bracketMatching ? [bracketMatching()] : []
        ),
        this.autoClosingCompartment.reconfigure(
          settings.autoClosingBrackets ? [autoClosingBracketsExtension] : []
        ),
        this.whitespaceCompartment.reconfigure(
          settings.whitespace === 'all'
            ? [highlightWhitespace()]
            : settings.whitespace === 'trailing'
            ? [highlightTrailingWhitespace()]
            : []
        ),
        this.foldingCompartment.reconfigure(
          settings.folding ? [foldGutter(), keymap.of(foldKeymap)] : []
        ),
      ],
    });
  }

  public foldAll(): void {
    if (this.view) {
      foldAll(this.view);
    }
  }

  public unfoldAll(): void {
    if (this.view) {
      unfoldAll(this.view);
    }
  }

  public getCursorPosition(): { line: number; column: number } {
    if (!this.view) return { line: 1, column: 1 };
    const pos = this.view.state.selection.main.head;
    const lineObj = this.view.state.doc.lineAt(pos);
    const column = pos - lineObj.from + 1;
    return { line: lineObj.number, column };
  }

  public posAtCoords(coords: { x: number; y: number }): { line: number; column: number } | null {
    if (!this.view) return null;
    const offset = this.view.posAtCoords(coords);
    if (offset === null) return null;
    const lineObj = this.view.state.doc.lineAt(offset);
    return { line: lineObj.number, column: offset - lineObj.from + 1 };
  }

  public coordsAtPos(pos?: number): { left: number; top: number; bottom: number } | null {
    if (!this.view) return null;
    const targetPos = pos !== undefined ? pos : this.view.state.selection.main.head;
    const rect = this.view.coordsAtPos(targetPos);
    return rect ? { left: rect.left, top: rect.top, bottom: rect.bottom } : null;
  }

  public goToLine(line: number, column: number = 1): void {
    if (!this.view) return;
    const doc = this.view.state.doc;
    const safeLineNumber = Math.max(1, Math.min(line, doc.lines));
    const lineObj = doc.line(safeLineNumber);
    const safeColumn = Math.max(1, Math.min(column, lineObj.length + 1));
    const pos = lineObj.from + (safeColumn - 1);

    this.view.dispatch({
      selection: EditorSelection.single(pos),
      scrollIntoView: true,
    });
    this.focus();
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

  public setDiagnostics(diagnostics: Diagnostic[]): void {
    if (!this.view) return;
    this.view.dispatch({
      effects: setDiagnosticsEffect.of(diagnostics),
    });
  }

  public clearDiagnostics(): void {
    if (!this.view) return;
    this.view.dispatch({
      effects: clearDiagnosticsEffect.of(),
    });
  }

  public getSelectedText(): string {
    if (!this.view) return '';
    const mainSel = this.view.state.selection.main;
    if (mainSel.empty) return '';
    return this.view.state.sliceDoc(mainSel.from, mainSel.to);
  }

  public getSelectionRange(): Range | null {
    if (!this.view) return null;
    const main = this.view.state.selection.main;
    if (main.empty) return null;
    const fromLine = this.view.state.doc.lineAt(main.from);
    const toLine = this.view.state.doc.lineAt(main.to);
    return {
      startLine: fromLine.number,
      startColumn: main.from - fromLine.from + 1,
      endLine: toLine.number,
      endColumn: main.to - toLine.from + 1,
    };
  }

  public applyEdits(changes: Array<{ from: number; to: number; insert: string }>): void {
    if (!this.view || changes.length === 0) return;
    this.isUpdatingProgrammatically = true;
    try {
      this.view.dispatch({
        changes: changes.map((c) => ({ from: c.from, to: c.to, insert: c.insert })),
      });
    } finally {
      this.isUpdatingProgrammatically = false;
    }
  }

  public getViewState(): {
    cursorPosition: { line: number; column: number };
    selections: Array<{ anchor: number; head: number }>;
    scrollPosition?: { top: number; left: number };
  } {
    if (!this.view) {
      return { cursorPosition: { line: 1, column: 1 }, selections: [] };
    }
    const cursorPosition = this.getCursorPosition();
    const selections = this.view.state.selection.ranges.map((r) => ({
      anchor: r.anchor,
      head: r.head,
    }));
    const scrollDOM = this.view.scrollDOM;
    const scrollPosition = scrollDOM
      ? { top: scrollDOM.scrollTop, left: scrollDOM.scrollLeft }
      : undefined;

    return { cursorPosition, selections, scrollPosition };
  }

  public restoreViewState(state: {
    cursorPosition?: { line: number; column: number };
    selections?: Array<{ anchor: number; head: number }>;
    scrollPosition?: { top: number; left: number };
  }): void {
    if (!this.view) return;

    if (state.selections && state.selections.length > 0) {
      const maxLen = this.view.state.doc.length;
      const validRanges = state.selections.map((s) =>
        EditorSelection.range(
          Math.max(0, Math.min(s.anchor, maxLen)),
          Math.max(0, Math.min(s.head, maxLen))
        )
      );
      this.view.dispatch({
        selection: EditorSelection.create(validRanges, 0),
      });
    } else if (state.cursorPosition) {
      this.goToLine(state.cursorPosition.line, state.cursorPosition.column);
    }

    if (state.scrollPosition && this.view.scrollDOM) {
      this.view.scrollDOM.scrollTop = state.scrollPosition.top;
      this.view.scrollDOM.scrollLeft = state.scrollPosition.left;
    }
  }

  public undo(): boolean {
    if (!this.view || this.view.state.readOnly) return false;
    return undo(this.view);
  }

  public redo(): boolean {
    if (!this.view || this.view.state.readOnly) return false;
    return redo(this.view);
  }

  public canUndo(): boolean {
    if (!this.view || this.view.state.readOnly) return false;
    return undoDepth(this.view.state) > 0;
  }

  public canRedo(): boolean {
    if (!this.view || this.view.state.readOnly) return false;
    return redoDepth(this.view.state) > 0;
  }

  public getHistoryDepth(): { undoDepth: number; redoDepth: number } {
    if (!this.view) {
      return { undoDepth: 0, redoDepth: 0 };
    }
    return {
      undoDepth: undoDepth(this.view.state),
      redoDepth: redoDepth(this.view.state),
    };
  }

  public clearHistory(): void {
    if (!this.view) return;
    try {
      this.view.dispatch({
        effects: this.historyCompartment.reconfigure([]),
      });
      this.view.dispatch({
        effects: this.historyCompartment.reconfigure([history()]),
      });
    } catch {
      // Safe fallback
    }
  }

  public selectAll(): boolean {
    return this.view ? selectAll(this.view) : false;
  }

  public isComposing(): boolean {
    return Boolean(this.view && this.view.composing);
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
    this.onCursorActivityCallback = null;
  }
}
