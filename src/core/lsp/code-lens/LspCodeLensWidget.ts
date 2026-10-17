/**
 * QM Editor - LSP Code Lens Widget
 * Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration
 * 
 * CodeMirror 6 line block widget rendering contextual inline Code Lens actions
 * above the relevant source code line.
 */

import { WidgetType } from '@codemirror/view';
import { EditorCodeLensLine, CanonicalCodeLens } from './LspCodeLensTypes';

export type CodeLensActionClickHandler = (lensId: string) => void;

export class CodeLensWidget extends WidgetType {
  private static clickHandler: CodeLensActionClickHandler | null = null;

  constructor(public readonly lineData: EditorCodeLensLine) {
    super();
  }

  public static setActionClickHandler(handler: CodeLensActionClickHandler | null): void {
    CodeLensWidget.clickHandler = handler;
  }

  public override get estimatedHeight(): number {
    return 18;
  }

  public override toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-code-lens-line';
    container.setAttribute('role', 'toolbar');
    container.setAttribute('aria-label', `Code Lens Actions for line ${this.lineData.line + 1}`);

    const lenses = this.lineData.lenses;
    const len = lenses.length;

    for (let i = 0; i < len; i++) {
      const lens = lenses[i];

      if (i > 0) {
        const sep = document.createElement('span');
        sep.className = 'cm-code-lens-separator';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '•';
        container.appendChild(sep);
      }

      const itemEl = this.createLensElement(lens);
      container.appendChild(itemEl);
    }

    return container;
  }

  private createLensElement(lens: CanonicalCodeLens): HTMLElement {
    if (lens.command && lens.command.title) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cm-code-lens-action';
      button.textContent = lens.command.title;
      button.setAttribute('data-lens-id', lens.id);
      button.setAttribute('aria-label', `${lens.command.title} (Code Lens Action)`);

      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (CodeLensWidget.clickHandler) {
          CodeLensWidget.clickHandler(lens.id);
        }
      });

      button.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (CodeLensWidget.clickHandler) {
            CodeLensWidget.clickHandler(lens.id);
          }
        }
      });

      return button;
    }

    // Unresolved placeholder or informational lens without command
    const span = document.createElement('span');
    span.className = 'cm-code-lens-info';
    span.textContent = lens.isResolved ? '' : 'Loading...';
    span.setAttribute('data-lens-id', lens.id);
    return span;
  }

  public override eq(other: WidgetType): boolean {
    if (!(other instanceof CodeLensWidget)) {
      return false;
    }

    if (this.lineData.line !== other.lineData.line) {
      return false;
    }

    const thisLenses = this.lineData.lenses;
    const otherLenses = other.lineData.lenses;

    if (thisLenses.length !== otherLenses.length) {
      return false;
    }

    for (let i = 0; i < thisLenses.length; i++) {
      const a = thisLenses[i];
      const b = otherLenses[i];
      if (
        a.id !== b.id ||
        a.isResolved !== b.isResolved ||
        a.command?.title !== b.command?.title ||
        a.command?.command !== b.command?.command
      ) {
        return false;
      }
    }

    return true;
  }

  public override ignoreEvent(event: Event): boolean {
    // Allow click and key events on buttons inside the widget to reach handlers
    const target = event.target as HTMLElement | null;
    if (target && target.tagName === 'BUTTON') {
      return false;
    }
    return true;
  }
}
