import { describe, it, expect } from 'vitest';
import { createNewDocument, updateDocumentContent, markDocumentSaved } from './document';
import { QMEditorError } from '../utils/errors';

describe('Document Domain Model Logic', () => {
  it('creates a valid document model with clean dirty flag', () => {
    const doc = createNewDocument('test.txt', 'Hello World', 'plaintext');
    expect(doc.title).toBe('test.txt');
    expect(doc.content).toBe('Hello World');
    expect(doc.isDirty).toBe(false);
    expect(doc.id).toMatch(/^doc-/);
  });

  it('throws QMEditorError when title is empty', () => {
    expect(() => createNewDocument('  ', 'Content')).toThrow(QMEditorError);
  });

  it('marks document as dirty when content changes', () => {
    const doc = createNewDocument('notes.md', 'Initial content');
    const updated = updateDocumentContent(doc, 'Updated content');
    expect(updated.isDirty).toBe(true);
    expect(updated.content).toBe('Updated content');
  });

  it('clears dirty flag when document is saved', () => {
    const doc = createNewDocument('notes.md', 'Initial content');
    const updated = updateDocumentContent(doc, 'Updated content');
    const saved = markDocumentSaved(updated);
    expect(saved.isDirty).toBe(false);
  });
});
