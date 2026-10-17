/**
 * QM Editor - LSP Inlay Hint Widget
 * Phase 06, Step 65 — LSP Inlay Hints, Parameter Names, Type Information & Inline Semantic Annotations
 * 
 * CodeMirror 6 inline widget rendering an inlay hint annotation with safe DOM construction,
 * zero innerHTML injection, fast equality checks, and accessible attributes.
 */

import { WidgetType } from '@codemirror/view';
import { EditorInlayHintDecoration } from './LspInlayHintTypes';

export class InlayHintWidget extends WidgetType {
  constructor(public readonly hint: EditorInlayHintDecoration) {
    super();
  }

  public override toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = this.hint.className;
    span.textContent = this.hint.label;

    if (this.hint.tooltip) {
      span.title = this.hint.tooltip;
    }

    span.setAttribute('data-inlay-hint-id', this.hint.id);
    span.setAttribute('data-inlay-hint-kind', this.hint.kind);
    span.setAttribute('role', 'note');
    span.setAttribute('aria-hidden', 'true');

    return span;
  }

  public override eq(other: WidgetType): boolean {
    if (!(other instanceof InlayHintWidget)) {
      return false;
    }

    return (
      this.hint.id === other.hint.id &&
      this.hint.label === other.hint.label &&
      this.hint.kind === other.hint.kind &&
      this.hint.tooltip === other.hint.tooltip &&
      this.hint.className === other.hint.className
    );
  }

  public override ignoreEvent(): boolean {
    return true;
  }
}
