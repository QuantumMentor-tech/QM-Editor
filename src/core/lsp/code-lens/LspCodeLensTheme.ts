/**
 * QM Editor - LSP Code Lens Theme
 * Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration
 * 
 * CodeMirror 6 base theme styling for Code Lens action lines, buttons, and accessibility.
 */

import { EditorView } from '@codemirror/view';

export const codeLensTheme = EditorView.baseTheme({
  '.cm-code-lens-line': {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.82em',
    lineHeight: '1.3',
    userSelect: 'none',
    padding: '2px 0 2px 2px',
    fontFamily: 'inherit',
    pointerEvents: 'auto',
  },
  '.cm-code-lens-action': {
    background: 'none',
    border: 'none',
    margin: '0',
    padding: '1px 4px',
    borderRadius: '3px',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'color 0.12s ease, background-color 0.12s ease',
  },
  '.cm-code-lens-info': {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 4px',
    fontSize: 'inherit',
    fontFamily: 'inherit',
  },
  '.cm-code-lens-separator': {
    fontSize: '0.7em',
    opacity: '0.5',
    userSelect: 'none',
  },
  // Dark mode
  '&.cm-dark .cm-code-lens-action': {
    color: '#8a9199',
  },
  '&.cm-dark .cm-code-lens-action:hover': {
    color: '#c8d1de',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  '&.cm-dark .cm-code-lens-action:focus-visible': {
    outline: '1px solid #528bff',
    color: '#ffffff',
  },
  '&.cm-dark .cm-code-lens-info': {
    color: '#656d76',
  },
  // Light mode
  '&:not(.cm-dark) .cm-code-lens-action': {
    color: '#6e7681',
  },
  '&:not(.cm-dark) .cm-code-lens-action:hover': {
    color: '#0969da',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  '&:not(.cm-dark) .cm-code-lens-action:focus-visible': {
    outline: '1px solid #0969da',
    color: '#1f2328',
  },
  '&:not(.cm-dark) .cm-code-lens-info': {
    color: '#8c959f',
  },
  // High contrast mode
  '@media (forced-colors: active)': {
    '.cm-code-lens-action': {
      color: 'LinkText',
    },
    '.cm-code-lens-action:focus-visible': {
      outline: '2px solid Highlight',
    },
    '.cm-code-lens-info': {
      color: 'CanvasText',
    },
    '.cm-code-lens-separator': {
      color: 'CanvasText',
    },
  },
});
