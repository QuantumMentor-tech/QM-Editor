/**
 * QM Editor — LSP Selection Range Coordinator
 * Phase 06, Step 69 — LSP Selection Ranges, Smart Structural Selection & Context-Aware Cursor Expansion
 *
 * Coordinates structural selection expansion and shrinking:
 * - Directs expansion requests through LSP provider with native fallback
 * - Maintains runtime-only undo/shrink selection history per document
 * - Preserves multi-cursor ordering and selection direction (anchor vs head)
 * - Automatically invalidates history on document edits, closing, or workspace changes
 */

import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { SettingsService } from '../../settings/SettingsService';
import { LspSelectionRangeProvider, globalSelectionRangeProvider } from './LspSelectionRangeProvider';
import {
  SelectionExpansionResult,
  SelectionHierarchy,
  SelectionHistoryEntry,
} from './LspSelectionRangeTypes';
import { LspSelectionRangeMapper } from './LspSelectionRangeMapper';
import { LspPosition } from '../LspTypes';

export class LspSelectionRangeCoordinator {
  private static instance: LspSelectionRangeCoordinator | null = null;
  private readonly selectionHistory = new Map<string, SelectionHistoryEntry[]>();
  private readonly unsubscribers: Array<() => void> = [];
  private isDisposed = false;

  constructor(
    private readonly provider: LspSelectionRangeProvider = globalSelectionRangeProvider,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine,
    private readonly settingsService: SettingsService = SettingsService.getInstance()
  ) {
    this.bindDocumentEvents();
  }

  public static getInstance(): LspSelectionRangeCoordinator {
    if (!LspSelectionRangeCoordinator.instance) {
      LspSelectionRangeCoordinator.instance = new LspSelectionRangeCoordinator();
    }
    return LspSelectionRangeCoordinator.instance;
  }

  private bindDocumentEvents(): void {
    const unsubChange = this.documentEngine.on('document.changed', (e) => {
      // Invalidate expansion history and cache when document content changes
      this.clearHistory(e.documentId);
      const doc = this.documentEngine.getDocument(e.documentId);
      if (doc?.resourceUri) {
        this.provider.clearCache(doc.resourceUri);
      }
    });

    const unsubClose = this.documentEngine.on('document.closed', (e: any) => {
      if (e.documentId) {
        this.clearHistory(e.documentId);
      }
      if (e.uri) {
        this.provider.clearCache(e.uri);
      }
    });

    this.unsubscribers.push(unsubChange, unsubClose);
  }

  public clearHistory(documentId?: string): void {
    if (documentId) {
      this.selectionHistory.delete(documentId);
    } else {
      this.selectionHistory.clear();
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers.length = 0;
    this.selectionHistory.clear();
  }

  /**
   * Expands the current selections using LSP structural ranges or native editor fallback.
   */
  public async expandSelection(
    documentId: string,
    currentSelections: Array<{ anchor: number; head: number }>
  ): Promise<SelectionExpansionResult> {
    if (this.isDisposed || currentSelections.length === 0) {
      return { expanded: false, selections: currentSelections, source: 'unchanged' };
    }

    const doc = this.documentEngine.getDocument(documentId);
    if (!doc) {
      return { expanded: false, selections: currentSelections, source: 'unchanged' };
    }

    const offsets = LspSelectionRangeMapper.computeLineOffsets(doc.content);
    const preserveAnchor = this.settingsService.get('editor.selectionExpansion.preserveAnchor') !== false;

    // 1. Try LSP Selection Ranges if enabled and available
    if (this.provider.isEnabled() && doc.resourceUri) {
      // Convert current selection head/anchors into LSP positions
      const positions: LspPosition[] = currentSelections.map((sel) => {
        // Query position at head (the active cursor end of selection)
        return LspSelectionRangeMapper.offsetToLspPosition(sel.head, offsets);
      });

      // Check cache first
      let hierarchies: SelectionHierarchy[] | null = null;
      const cached = this.provider.getCache(doc.resourceUri);
      if (cached && cached.documentRevision === doc.contentRevision && cached.hierarchies.length === positions.length) {
        hierarchies = cached.hierarchies;
      } else {
        hierarchies = await this.provider.requestSelectionRanges(doc.resourceUri, positions);
      }

      if (hierarchies && hierarchies.length === currentSelections.length) {
        const expandedSelections: Array<{ anchor: number; head: number }> = [];
        let anyExpanded = false;

        for (let i = 0; i < currentSelections.length; i++) {
          const current = currentSelections[i];
          const curFrom = Math.min(current.anchor, current.head);
          const curTo = Math.max(current.anchor, current.head);
          const isReversed = current.anchor > current.head;

          const nextRange = LspSelectionRangeMapper.findNextContainingRange(
            hierarchies[i].ranges,
            curFrom,
            curTo
          );

          if (nextRange) {
            anyExpanded = true;
            const newAnchor = isReversed && preserveAnchor ? nextRange.offsetRange.to : nextRange.offsetRange.from;
            const newHead = isReversed && preserveAnchor ? nextRange.offsetRange.from : nextRange.offsetRange.to;
            expandedSelections.push({ anchor: newAnchor, head: newHead });
          } else {
            // Keep unchanged if no larger LSP range exists for this selection
            expandedSelections.push(current);
          }
        }

        if (anyExpanded) {
          this.pushHistory(documentId, doc.contentRevision, currentSelections);
          return { expanded: true, selections: expandedSelections, source: 'lsp' };
        }
      }
    }

    // 2. Fall back to Native Selection Expansion
    const nativeSelections = this.expandNativeSelections(doc.content, currentSelections, offsets, preserveAnchor);
    const hasChanged = nativeSelections.some((sel, idx) => {
      const orig = currentSelections[idx];
      return orig.anchor !== sel.anchor || orig.head !== sel.head;
    });

    if (hasChanged) {
      this.pushHistory(documentId, doc.contentRevision, currentSelections);
      return { expanded: true, selections: nativeSelections, source: 'native' };
    }

    return { expanded: false, selections: currentSelections, source: 'unchanged' };
  }

  /**
   * Shrinks the current selections by stepping back down the expansion history stack.
   */
  public shrinkSelection(
    documentId: string,
    currentSelections: Array<{ anchor: number; head: number }>
  ): SelectionExpansionResult {
    if (this.isDisposed) {
      return { expanded: false, selections: currentSelections, source: 'unchanged' };
    }

    const doc = this.documentEngine.getDocument(documentId);
    if (!doc) {
      return { expanded: false, selections: currentSelections, source: 'unchanged' };
    }

    const historyStack = this.selectionHistory.get(documentId);
    if (!historyStack || historyStack.length === 0) {
      return { expanded: false, selections: currentSelections, source: 'unchanged' };
    }

    // Pop the previous selection state
    const previous = historyStack.pop();
    if (!previous || previous.documentRevision !== doc.contentRevision) {
      return { expanded: false, selections: currentSelections, source: 'unchanged' };
    }

    return { expanded: true, selections: previous.selections, source: 'native' };
  }

  private pushHistory(
    documentId: string,
    documentRevision: number,
    selections: Array<{ anchor: number; head: number }>
  ): void {
    let stack = this.selectionHistory.get(documentId);
    if (!stack) {
      stack = [];
      this.selectionHistory.set(documentId, stack);
    }

    // Cap history stack to 50 entries
    if (stack.length >= 50) {
      stack.shift();
    }

    stack.push({
      documentId,
      documentRevision,
      selections: selections.map((s) => ({ anchor: s.anchor, head: s.head })),
      timestamp: Date.now(),
    });
  }

  /**
   * Native heuristic expansion:
   * cursor -> word -> line -> entire document.
   */
  private expandNativeSelections(
    content: string,
    selections: Array<{ anchor: number; head: number }>,
    offsets: ReturnType<typeof LspSelectionRangeMapper.computeLineOffsets>,
    preserveAnchor: boolean
  ): Array<{ anchor: number; head: number }> {
    return selections.map((sel) => {
      const curFrom = Math.min(sel.anchor, sel.head);
      const curTo = Math.max(sel.anchor, sel.head);
      const isReversed = sel.anchor > sel.head;
      const len = content.length;

      // Stage 1: Empty cursor -> expand to word
      if (curFrom === curTo) {
        const wordBounds = this.getWordBoundsAt(content, curFrom);
        if (wordBounds && (wordBounds.from < curFrom || wordBounds.to > curTo)) {
          return {
            anchor: isReversed && preserveAnchor ? wordBounds.to : wordBounds.from,
            head: isReversed && preserveAnchor ? wordBounds.from : wordBounds.to,
          };
        }
      }

      // Stage 2: Within line -> expand to line bounds
      const linePos = LspSelectionRangeMapper.offsetToLspPosition(curFrom, offsets);
      const lineStart = offsets.lineStarts[linePos.line] ?? 0;
      const nextLineStart =
        linePos.line + 1 < offsets.lineStarts.length ? offsets.lineStarts[linePos.line + 1] : len;
      // Strip trailing newline character from lineEnd
      let lineEnd = nextLineStart;
      if (lineEnd > lineStart && content.charCodeAt(lineEnd - 1) === 10) {
        lineEnd--;
        if (lineEnd > lineStart && content.charCodeAt(lineEnd - 1) === 13) {
          lineEnd--;
        }
      }

      if (curFrom > lineStart || curTo < lineEnd) {
        return {
          anchor: isReversed && preserveAnchor ? lineEnd : lineStart,
          head: isReversed && preserveAnchor ? lineStart : lineEnd,
        };
      }

      // Stage 3: Entire line selected -> expand to entire document
      if (curFrom > 0 || curTo < len) {
        return {
          anchor: isReversed && preserveAnchor ? len : 0,
          head: isReversed && preserveAnchor ? 0 : len,
        };
      }

      // Stage 4: Already entire document -> unchanged
      return sel;
    });
  }

  /**
   * Identifies identifier/word boundaries around a character offset.
   */
  private getWordBoundsAt(content: string, offset: number): { from: number; to: number } | null {
    const len = content.length;
    if (len === 0) return null;

    const isWordChar = (char: string) => /[a-zA-Z0-9_$]/.test(char);

    let start = Math.max(0, Math.min(offset, len));
    let end = start;

    // Check if character before cursor is a word char (e.g. cursor at end of word)
    if (start > 0 && !isWordChar(content.charAt(start)) && isWordChar(content.charAt(start - 1))) {
      start--;
      end = start;
    }

    if (!isWordChar(content.charAt(start))) {
      return null;
    }

    while (start > 0 && isWordChar(content.charAt(start - 1))) {
      start--;
    }

    while (end < len && isWordChar(content.charAt(end))) {
      end++;
    }

    return { from: start, to: end };
  }
}

export const globalSelectionRangeCoordinator = LspSelectionRangeCoordinator.getInstance();
