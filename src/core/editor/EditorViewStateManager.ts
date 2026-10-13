/**
 * QM Editor View State Manager
 * Phase 04, Step 37 — Core Application Engine
 */

import { EditorViewState, Position, EditorSelectionRange } from './EditorTypes';

export class EditorViewStateManager {
  private viewStates = new Map<string, EditorViewState>();

  public saveViewState(
    documentId: string,
    state: {
      cursorPosition?: Position;
      selections?: EditorSelectionRange[];
      scrollPosition?: { top: number; left: number };
    }
  ): EditorViewState {
    const existing = this.viewStates.get(documentId);

    const merged: EditorViewState = {
      documentId,
      cursorPosition: state.cursorPosition || existing?.cursorPosition || { line: 1, column: 1 },
      selections: state.selections || existing?.selections || [],
      scrollPosition: state.scrollPosition || existing?.scrollPosition,
      lastUpdated: Date.now(),
    };

    this.viewStates.set(documentId, merged);
    return merged;
  }

  public getViewState(documentId: string): EditorViewState | undefined {
    return this.viewStates.get(documentId);
  }

  /**
   * Safely clamps view state positions against the provided text length and line structures.
   */
  public getClampedViewState(
    documentId: string,
    content: string
  ): EditorViewState | undefined {
    const raw = this.viewStates.get(documentId);
    if (!raw) return undefined;

    const lines = content.split('\n');
    const totalLines = Math.max(1, lines.length);

    const safeLine = Math.max(1, Math.min(raw.cursorPosition.line, totalLines));
    const lineText = lines[safeLine - 1] || '';
    const safeCol = Math.max(1, Math.min(raw.cursorPosition.column, lineText.length + 1));

    const maxLen = content.length;
    const safeSelections: EditorSelectionRange[] = raw.selections.map((sel) => ({
      anchor: Math.max(0, Math.min(sel.anchor, maxLen)),
      head: Math.max(0, Math.min(sel.head, maxLen)),
    }));

    return {
      documentId,
      cursorPosition: { line: safeLine, column: safeCol },
      selections: safeSelections,
      scrollPosition: raw.scrollPosition,
      lastUpdated: raw.lastUpdated,
    };
  }

  public clearViewState(documentId: string): void {
    this.viewStates.delete(documentId);
  }

  public clearAll(): void {
    this.viewStates.clear();
  }
}
