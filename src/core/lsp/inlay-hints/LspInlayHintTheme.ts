/**
 * QM Editor - LSP Inlay Hints Theme
 * Phase 06, Step 65 — LSP Inlay Hints, Parameter Names, Type Information & Inline Semantic Annotations
 * 
 * CodeMirror 6 base theme styling for inline parameter name, type, and semantic annotations.
 * Ensures accessibility, clear subordination to source code, dark/light theme tokens,
 * and high-contrast support.
 */

import { EditorView } from '@codemirror/view';

export const inlayHintsTheme = EditorView.baseTheme({
  '.cm-inlay-hint': {
    display: 'inline-block',
    fontSize: '0.85em',
    lineHeight: '1',
    verticalAlign: 'baseline',
    userSelect: 'none',
    pointerEvents: 'auto',
    cursor: 'default',
    borderRadius: '3px',
    margin: '0 1px',
    padding: '1px 3px',
    whiteSpace: 'pre',
    fontFamily: 'inherit',
    opacity: '0.85',
    transition: 'opacity 0.15s ease-in-out',
  },
  '.cm-inlay-hint:hover': {
    opacity: '1',
  },
  // Dark mode
  '&.cm-dark .cm-inlay-hint': {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    color: '#9da5b4',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  '&.cm-dark .cm-inlay-hint-parameter': {
    color: '#8a9199',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  '&.cm-dark .cm-inlay-hint-type': {
    color: '#4ec9b0',
    backgroundColor: 'rgba(78, 201, 176, 0.12)',
  },
  // Light mode
  '&:not(.cm-dark) .cm-inlay-hint': {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    color: '#5c6370',
    border: '1px solid rgba(0, 0, 0, 0.08)',
  },
  '&:not(.cm-dark) .cm-inlay-hint-parameter': {
    color: '#6a737d',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  '&:not(.cm-dark) .cm-inlay-hint-type': {
    color: '#005cc5',
    backgroundColor: 'rgba(0, 92, 197, 0.08)',
  },
  // High contrast mode
  '@media (forced-colors: active)': {
    '.cm-inlay-hint': {
      backgroundColor: 'Canvas',
      color: 'CanvasText',
      border: '1px dotted CanvasText',
    },
  },
});
