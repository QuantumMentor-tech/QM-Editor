/**
 * QM Editor - LSP Semantic Tokens Theme
 * Phase 06, Step 64 — LSP Semantic Tokens, Semantic Highlighting & Incremental Token Synchronization
 * 
 * Provides accessible, high-contrast, theme-aware CSS styling for semantic tokens
 * and modifiers, integrating seamlessly with CodeMirror 6 and QM Editor design tokens.
 */

import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';

export const semanticTokensTheme: Extension = EditorView.baseTheme({
  // Base token class
  '.cm-semantic-token': {
    // Preserves base syntax styling where not explicitly overridden
  },

  // Dark Theme Tokens (Default)
  '.cm-semantic-type-namespace': {
    color: '#4ec9b0',
  },
  '.cm-semantic-type-type, .cm-semantic-type-class, .cm-semantic-type-struct': {
    color: '#4ec9b0',
  },
  '.cm-semantic-type-interface': {
    color: '#b8d7a3',
  },
  '.cm-semantic-type-enum': {
    color: '#4ec9b0',
  },
  '.cm-semantic-type-enummember': {
    color: '#4fc1ff',
  },
  '.cm-semantic-type-typeparameter': {
    color: '#4ec9b0',
  },
  '.cm-semantic-type-function, .cm-semantic-type-method': {
    color: '#dcdcaa',
  },
  '.cm-semantic-type-variable': {
    color: '#9cdcfe',
  },
  '.cm-semantic-type-parameter': {
    color: '#9cdcfe',
  },
  '.cm-semantic-type-property': {
    color: '#9cdcfe',
  },
  '.cm-semantic-type-event': {
    color: '#dcdcaa',
  },
  '.cm-semantic-type-macro': {
    color: '#bd63c5',
  },
  '.cm-semantic-type-keyword': {
    color: '#c586c0',
  },
  '.cm-semantic-type-modifier': {
    color: '#569cd6',
  },
  '.cm-semantic-type-comment': {
    color: '#6a9955',
    fontStyle: 'italic',
  },
  '.cm-semantic-type-string': {
    color: '#ce9178',
  },
  '.cm-semantic-type-number': {
    color: '#b5cea8',
  },
  '.cm-semantic-type-regexp': {
    color: '#d16969',
  },
  '.cm-semantic-type-operator': {
    color: '#d4d4d4',
  },
  '.cm-semantic-type-decorator': {
    color: '#dcdcaa',
  },

  // Light Theme Overrides (when not in dark mode)
  '&:not(.cm-dark) .cm-semantic-type-namespace': { color: '#267f99' },
  '&:not(.cm-dark) .cm-semantic-type-type, &:not(.cm-dark) .cm-semantic-type-class, &:not(.cm-dark) .cm-semantic-type-struct': { color: '#267f99' },
  '&:not(.cm-dark) .cm-semantic-type-interface': { color: '#267f99' },
  '&:not(.cm-dark) .cm-semantic-type-enum': { color: '#267f99' },
  '&:not(.cm-dark) .cm-semantic-type-enummember': { color: '#001080' },
  '&:not(.cm-dark) .cm-semantic-type-typeparameter': { color: '#267f99' },
  '&:not(.cm-dark) .cm-semantic-type-function, &:not(.cm-dark) .cm-semantic-type-method': { color: '#795e26' },
  '&:not(.cm-dark) .cm-semantic-type-variable': { color: '#001080' },
  '&:not(.cm-dark) .cm-semantic-type-parameter': { color: '#001080' },
  '&:not(.cm-dark) .cm-semantic-type-property': { color: '#001080' },
  '&:not(.cm-dark) .cm-semantic-type-event': { color: '#795e26' },
  '&:not(.cm-dark) .cm-semantic-type-macro': { color: '#af00db' },
  '&:not(.cm-dark) .cm-semantic-type-keyword': { color: '#af00db' },
  '&:not(.cm-dark) .cm-semantic-type-modifier': { color: '#0000ff' },
  '&:not(.cm-dark) .cm-semantic-type-comment': { color: '#008000', fontStyle: 'italic' },
  '&:not(.cm-dark) .cm-semantic-type-string': { color: '#a31515' },
  '&:not(.cm-dark) .cm-semantic-type-number': { color: '#098658' },
  '&:not(.cm-dark) .cm-semantic-type-regexp': { color: '#811f3f' },
  '&:not(.cm-dark) .cm-semantic-type-operator': { color: '#000000' },
  '&:not(.cm-dark) .cm-semantic-type-decorator': { color: '#795e26' },

  // Token Modifiers
  '.cm-semantic-mod-deprecated': {
    textDecoration: 'line-through',
    opacity: '0.65',
  },
  '.cm-semantic-mod-abstract': {
    fontStyle: 'italic',
  },
  '.cm-semantic-mod-static': {
    // Subtle static indication
  },
  '.cm-semantic-mod-declaration, .cm-semantic-mod-definition': {
    // Retain crisp weight without layout shift
  },
  '.cm-semantic-mod-readonly': {
    // Readonly semantic modifier
  },

  // High contrast accessibility mode
  '@media (forced-colors: active)': {
    '.cm-semantic-token': {
      forcedColorAdjust: 'auto',
    },
  },
});
