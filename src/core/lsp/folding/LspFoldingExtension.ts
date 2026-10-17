/**
 * QM Editor — LSP CodeMirror 6 Folding Extension
 * Phase 06, Step 68 — LSP Folding Ranges, Smart Code Folding & Safe Document Structure Navigation
 * 
 * Integrates LSP folding ranges with CodeMirror's native foldService, foldState, and foldGutter.
 * Enables smart structural folding with automatic fallback to native syntax/brace folding.
 */

import { StateEffect, StateField, Extension, EditorState } from '@codemirror/state';
import { foldService, codeFolding } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { EditorFoldingRange } from './LspFoldingTypes';

/**
 * State effect to set active LSP folding ranges in the editor state.
 */
export const setFoldingRangesEffect = StateEffect.define<EditorFoldingRange[]>();

/**
 * State effect to clear all active LSP folding ranges from the editor state.
 */
export const clearFoldingRangesEffect = StateEffect.define<void>();

/**
 * StateField tracking current LSP folding ranges.
 */
export const foldingRangesField = StateField.define<EditorFoldingRange[]>({
  create() {
    return [];
  },
  update(ranges, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setFoldingRangesEffect)) {
        return effect.value;
      }
      if (effect.is(clearFoldingRangesEffect)) {
        return [];
      }
    }

    // Map existing ranges through document changes if any
    if (tr.docChanged && ranges.length > 0) {
      const mapped: EditorFoldingRange[] = [];
      for (const r of ranges) {
        const from = tr.changes.mapPos(r.from, 1);
        const to = tr.changes.mapPos(r.to, -1);
        if (from < to && to <= tr.newDoc.length) {
          mapped.push({
            ...r,
            from,
            to,
          });
        }
      }
      return mapped;
    }

    return ranges;
  },
});

/**
 * Facet implementation providing LSP folding ranges to CodeMirror's foldCode and foldGutter.
 * When no LSP range starts on a given line, returns null to trigger automatic fallback to syntax folding.
 */
export const lspFoldService = foldService.of((state: EditorState, lineStart: number, lineEnd: number) => {
  const ranges = state.field(foldingRangesField, false);
  if (!ranges || ranges.length === 0) {
    return null;
  }

  // Find folding ranges starting on the current line (from >= lineStart && from <= lineEnd)
  let bestRange: EditorFoldingRange | null = null;

  for (const r of ranges) {
    if (r.from >= lineStart && r.from <= lineEnd && r.to > lineEnd) {
      // If multiple ranges start on this line, select the outermost one
      if (!bestRange || r.to > bestRange.to) {
        bestRange = r;
      }
    }
  }

  if (bestRange) {
    return {
      from: bestRange.from,
      to: bestRange.to,
    };
  }

  // Returning null allows CodeMirror to fall back to native syntax/brace folding
  return null;
});

/**
 * Custom codeFolding extension supporting sanitized collapsedText in placeholder widgets.
 */
export const lspCodeFoldingExtension = codeFolding({
  placeholderDOM(_view: EditorView, onclick: (event: Event) => void, prepared: any) {
    const span = document.createElement('span');
    span.className = 'cm-foldPlaceholder';
    span.textContent = (prepared && prepared.collapsedText) ? prepared.collapsedText : '…';
    span.setAttribute('role', 'button');
    span.setAttribute('tabindex', '0');
    span.setAttribute('aria-label', 'Unfold code region');
    span.addEventListener('click', onclick);
    span.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onclick(e);
      }
    });
    return span;
  },
  preparePlaceholder(state: EditorState, range: { from: number; to: number }) {
    const ranges = state.field(foldingRangesField, false);
    if (ranges) {
      const match = ranges.find((r) => r.from === range.from && r.to === range.to);
      if (match && match.collapsedText) {
        return { collapsedText: match.collapsedText };
      }
    }
    return null;
  },
});

/**
 * Combined CodeMirror extensions bundle for LSP folding integration.
 */
export const foldingExtensions: Extension[] = [
  foldingRangesField,
  lspFoldService,
  lspCodeFoldingExtension,
];
