import { describe, it, expect, beforeEach } from 'vitest';
import { CodeMirrorEditorAdapter } from './EditorAdapter';

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

  it('disposes resources cleanly', () => {
    const adapter = new CodeMirrorEditorAdapter();
    adapter.mount(container, 'Content', { theme: 'dark' });

    adapter.dispose();
    expect(adapter.getContent()).toBe('');
  });
});
