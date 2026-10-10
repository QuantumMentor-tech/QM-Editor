import { describe, it, expect } from 'vitest';
import { createNewDocument, updateDocumentContent, markDocumentSaved, detectLanguageFromExtension, extractFileName } from './document';
import { QMEditorError } from '../utils/errors';

describe('Document Domain Model Logic & Revision Tracking', () => {
  it('creates a valid document model with clean dirty flag and initial revisions', () => {
    const doc = createNewDocument('test.txt', 'Hello World', 'plaintext');
    expect(doc.title).toBe('test.txt');
    expect(doc.content).toBe('Hello World');
    expect(doc.isDirty).toBe(false);
    expect(doc.contentRevision).toBe(0);
    expect(doc.savedRevision).toBe(0);
    expect(doc.id).toMatch(/^doc-/);
  });

  it('detects language from file extension correctly', () => {
    expect(detectLanguageFromExtension('main.ts')).toBe('typescript');
    expect(detectLanguageFromExtension('script.js')).toBe('javascript');
    expect(detectLanguageFromExtension('styles.css')).toBe('css');
    expect(detectLanguageFromExtension('index.html')).toBe('html');
    expect(detectLanguageFromExtension('README.md')).toBe('markdown');
    expect(detectLanguageFromExtension('config.json')).toBe('json');
    expect(detectLanguageFromExtension('unknown.foo')).toBe('plaintext');
  });

  it('extracts filename from path correctly', () => {
    expect(extractFileName('C:\\path\\to\\file.txt')).toBe('file.txt');
    expect(extractFileName('/usr/local/bin/script.sh')).toBe('script.sh');
  });

  it('throws QMEditorError when title is empty', () => {
    expect(() => createNewDocument('  ', 'Content')).toThrow(QMEditorError);
  });

  it('increments contentRevision and sets isDirty when content changes', () => {
    const doc = createNewDocument('notes.md', 'Initial content');
    const updated = updateDocumentContent(doc, 'Updated content');
    expect(updated.contentRevision).toBe(1);
    expect(updated.savedRevision).toBe(0);
    expect(updated.isDirty).toBe(true);
    expect(updated.content).toBe('Updated content');
  });

  it('clears dirty flag when saved with matching revision target', () => {
    const doc = createNewDocument('notes.md', 'Initial content');
    const updated = updateDocumentContent(doc, 'Updated content');
    const saved = markDocumentSaved(updated);
    expect(saved.savedRevision).toBe(1);
    expect(saved.contentRevision).toBe(1);
    expect(saved.isDirty).toBe(false);
  });

  it('preserves isDirty: true if user typed edits during in-flight save (Revision Race Safety)', () => {
    const doc = createNewDocument('notes.md', 'Initial content');
    const v1 = updateDocumentContent(doc, 'Version 1'); // rev 1
    const targetRevision = v1.contentRevision; // 1

    // User types Version 2 while save is in-flight
    const v2 = updateDocumentContent(v1, 'Version 2 (typed during save)'); // rev 2

    // Save of Version 1 completes
    const saved = markDocumentSaved(v2, targetRevision);

    expect(saved.contentRevision).toBe(2);
    expect(saved.savedRevision).toBe(1);
    expect(saved.isDirty).toBe(true); // Must remain dirty because Version 2 was not persisted!
  });
});
