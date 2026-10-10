import { describe, it, expect } from 'vitest';
import { createNewDocument } from './document';
import {
  createInitialRegistry,
  registerOpenDocument,
  activateDocument,
  closeDocument,
  updateDocumentText,
  saveDocumentState,
} from './documentRegistry';

describe('DocumentRegistry Core Engine & Storage Integration', () => {
  it('initializes registry correctly with documents', () => {
    const doc1 = createNewDocument('doc1.txt', 'Content 1');
    const registry = createInitialRegistry([doc1]);

    expect(registry.openDocIds).toHaveLength(1);
    expect(registry.activeDocId).toBe(doc1.id);
    expect(registry.documents[doc1.id]).toEqual(doc1);
  });

  it('prevents duplicate tabs when opening an existing document by ID or path', () => {
    const doc1 = createNewDocument('doc1.txt', 'Content 1', 'plaintext', 'file:///C:/path/doc1.txt');
    const doc2 = createNewDocument('doc2.txt', 'Content 2', 'plaintext', 'file:///C:/path/doc2.txt');

    let registry = createInitialRegistry([doc1, doc2]);
    expect(registry.openDocIds).toEqual([doc1.id, doc2.id]);

    // Attempt to register doc1 again by ID
    registry = registerOpenDocument(registry, doc1);
    expect(registry.openDocIds).toEqual([doc1.id, doc2.id]);
    expect(registry.activeDocId).toBe(doc1.id);

    // Attempt to register another DocumentModel instance pointing to same file path
    const doc1DuplicatePath = createNewDocument('doc1.txt', 'Content 1', 'plaintext', 'file:///C:/path/doc1.txt');
    registry = registerOpenDocument(registry, doc1DuplicatePath);
    expect(registry.openDocIds).toEqual([doc1.id, doc2.id]); // Must not create new tab!
    expect(registry.activeDocId).toBe(doc1.id);
  });

  it('deterministically selects next adjacent tab upon document close', () => {
    const doc1 = createNewDocument('doc1.txt', 'Content 1');
    const doc2 = createNewDocument('doc2.txt', 'Content 2');
    const doc3 = createNewDocument('doc3.txt', 'Content 3');

    let registry = createInitialRegistry([doc1, doc2, doc3]);
    registry = activateDocument(registry, doc2.id);

    // Close middle tab (doc2) -> should activate doc3 (adjacent right)
    registry = closeDocument(registry, doc2.id);
    expect(registry.openDocIds).toEqual([doc1.id, doc3.id]);
    expect(registry.activeDocId).toBe(doc3.id);

    // Close rightmost tab (doc3) -> should activate doc1 (left tab)
    registry = closeDocument(registry, doc3.id);
    expect(registry.openDocIds).toEqual([doc1.id]);
    expect(registry.activeDocId).toBe(doc1.id);

    // Close remaining tab (doc1) -> should transition activeDocId to null
    registry = closeDocument(registry, doc1.id);
    expect(registry.openDocIds).toEqual([]);
    expect(registry.activeDocId).toBeNull();
  });

  it('updates text and sets dirty flag correctly', () => {
    const doc1 = createNewDocument('doc1.txt', 'Initial Content');
    let registry = createInitialRegistry([doc1]);

    registry = updateDocumentText(registry, doc1.id, 'Edited Content');
    expect(registry.documents[doc1.id].isDirty).toBe(true);

    registry = saveDocumentState(registry, doc1.id);
    expect(registry.documents[doc1.id].isDirty).toBe(false);
  });
});
