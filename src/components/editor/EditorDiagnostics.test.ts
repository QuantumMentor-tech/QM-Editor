import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CodeMirrorEditorAdapter } from './EditorAdapter';
import { Diagnostic } from '../../core/diagnostics/DiagnosticTypes';

describe('Editor Diagnostics Integration', () => {
  let adapter: CodeMirrorEditorAdapter;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    adapter = new CodeMirrorEditorAdapter();
    adapter.mount(container, 'function add(a, b) {\n  return a + b;\n}');
  });

  afterEach(() => {
    adapter.dispose();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('sets diagnostic squiggles without crashing', () => {
    const diags: Diagnostic[] = [
      {
        id: 'd1',
        uri: 'test.ts',
        range: { startLine: 1, startColumn: 10, endLine: 1, endColumn: 13 },
        severity: 'error',
        message: 'Unused parameter a',
        source: 'ts',
        createdAt: Date.now(),
      },
      {
        id: 'd2',
        uri: 'test.ts',
        range: { startLine: 2, startColumn: 3, endLine: 2, endColumn: 9 },
        severity: 'warning',
        message: 'Missing type annotation',
        source: 'eslint',
        createdAt: Date.now(),
      },
    ];

    expect(() => adapter.setDiagnostics(diags)).not.toThrow();
  });

  it('clears diagnostic squiggles cleanly', () => {
    adapter.setDiagnostics([
      {
        id: 'd1',
        uri: 'test.ts',
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 },
        severity: 'info',
        message: 'Info message',
        source: 'linter',
        createdAt: Date.now(),
      },
    ]);

    expect(() => adapter.clearDiagnostics()).not.toThrow();
  });
});
