/**
 * QM Editor - LSP Document Link Theme
 * Phase 06, Step 67 — LSP Document Links, Clickable Resource References & Safe URI Navigation
 * 
 * CodeMirror 6 base theme providing accessible, non-disruptive link styles
 * across Light, Dark, and High-Contrast themes.
 */

import { EditorView } from '@codemirror/view';

export const documentLinkTheme = EditorView.baseTheme({
  '.cm-document-link': {
    textDecoration: 'underline dotted var(--qm-link-decoration-color, rgba(59, 130, 246, 0.55))',
    textUnderlineOffset: '3px',
    textDecorationSkipInk: 'auto',
    cursor: 'pointer',
    transition: 'color 120ms ease, text-decoration-color 120ms ease',
  },
  '.cm-document-link:hover': {
    textDecoration: 'underline solid var(--qm-link-hover-color, #3b82f6)',
    color: 'var(--qm-link-hover-color, #3b82f6)',
  },
  '.cm-document-link:active': {
    textDecoration: 'underline solid var(--qm-link-active-color, #1d4ed8)',
    color: 'var(--qm-link-active-color, #1d4ed8)',
  },
  '.cm-document-link-external': {
    textDecoration: 'underline dashed var(--qm-link-external-color, rgba(16, 185, 129, 0.6))',
  },
  '.cm-document-link-external:hover': {
    textDecoration: 'underline solid var(--qm-link-external-hover, #10b981)',
    color: 'var(--qm-link-external-hover, #10b981)',
  },
  '.cm-document-link-internal': {
    textDecoration: 'underline dotted var(--qm-link-internal-color, rgba(168, 85, 247, 0.6))',
  },
  '.cm-document-link-outside': {
    textDecoration: 'underline dotted var(--qm-link-outside-color, rgba(245, 158, 11, 0.6))',
  },
  '.cm-document-link-unsupported': {
    textDecoration: 'underline wavy var(--qm-link-unsupported-color, rgba(239, 68, 68, 0.5))',
    cursor: 'not-allowed',
  },

  // High contrast mode overrides
  '@media (forced-colors: active)': {
    '.cm-document-link': {
      textDecoration: 'underline',
      color: 'LinkText',
    },
    '.cm-document-link:hover': {
      color: 'Highlight',
    },
  },
});
