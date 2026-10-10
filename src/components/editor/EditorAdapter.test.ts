import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CodeMirrorEditorAdapter } from './EditorAdapter';
import { DEFAULT_EDITOR_SETTINGS } from '../../services/PreferencesService';

describe('CodeMirrorEditorAdapter', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('mounts editor instance and retrieves initial content correctly', () => {
    const adapter = new CodeMirrorEditorAdapter();
    adapter.mount(container, 'Hello CodeMirror 6', { theme: 'dark' });

    expect(adapter.getContent()).toBe('Hello CodeMirror 6');
    adapter.dispose();
  });

  it('updates content programmatically without throwing', () => {
    const adapter = new CodeMirrorEditorAdapter();
    adapter.mount(container, 'Initial', { theme: 'dark' });

    adapter.setContent('Updated Programmatically');
    expect(adapter.getContent()).toBe('Updated Programmatically');
    adapter.dispose();
  });

  it('reconfigures editor settings live without triggering onChange callback or changing document content', () => {
    const onChange = vi.fn();
    const adapter = new CodeMirrorEditorAdapter();
    adapter.mount(container, 'const x = 1;', { theme: 'dark', onChange });

    adapter.setSettings({
      ...DEFAULT_EDITOR_SETTINGS,
      fontSize: 20,
      wordWrap: 'off',
      lineNumbers: false,
    });

    expect(adapter.getContent()).toBe('const x = 1;');
    expect(onChange).not.toHaveBeenCalled();
    adapter.dispose();
  });

  it('executes foldAll and unfoldAll without error', () => {
    const adapter = new CodeMirrorEditorAdapter();
    adapter.mount(container, 'function test() {\n  return 42;\n}', { theme: 'dark' });

    expect(() => {
      adapter.foldAll();
      adapter.unfoldAll();
    }).not.toThrow();

    adapter.dispose();
  });

  it('executes goToLine and calculates cursor position accurately', () => {
    const adapter = new CodeMirrorEditorAdapter();
    adapter.mount(container, 'Line 1\nLine 2\nLine 3\nLine 4', { theme: 'dark' });

    adapter.goToLine(3, 4);
    const pos = adapter.getCursorPosition();
    expect(pos.line).toBe(3);
    expect(pos.column).toBe(4);
    adapter.dispose();
  });

  it('disposes resources cleanly', () => {
    const adapter = new CodeMirrorEditorAdapter();
    adapter.mount(container, 'Content', { theme: 'dark' });

    adapter.dispose();
    expect(adapter.getContent()).toBe('');
  });
});
