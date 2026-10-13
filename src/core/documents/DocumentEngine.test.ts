import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentEngine } from './DocumentEngine';
import { fileService } from '../../services/FileService';
import {
  DocumentUnsavedChangesError,
  DocumentReadOnlyError,
  DocumentSaveConflictError,
} from './DocumentErrors';

describe('DocumentEngine Core Subsystem', () => {
  let engine: DocumentEngine;

  beforeEach(() => {
    engine = new DocumentEngine();
    vi.restoreAllMocks();
  });

  describe('Document Identity & Duplicate Open Prevention', () => {
    it('creates stable document IDs distinct from resource URIs', async () => {
      const { document: doc1 } = await engine.openResource('C:\\projects\\app\\main.ts', {
        initialContent: 'console.log("hello");',
      });

      expect(doc1.id).toMatch(/^doc-/);
      expect(doc1.resourceUri).toBe('file:///C:/projects/app/main.ts');
      expect(doc1.title).toBe('main.ts');
      expect(doc1.contentRevision).toBe(0);
      expect(doc1.savedRevision).toBe(0);
      expect(doc1.isDirty).toBe(false);
    });

    it('prevents duplicate open instances and activates existing document', async () => {
      const { document: firstDoc, alreadyOpen: firstAlready } = await engine.openResource(
        'C:\\projects\\app\\main.ts',
        { initialContent: 'content 1' }
      );
      expect(firstAlready).toBe(false);

      // Attempt to open the exact same file path again through another entry point
      const { document: secondDoc, alreadyOpen: secondAlready } = await engine.openResource(
        'file:///C:/projects/app/main.ts'
      );
      expect(secondAlready).toBe(true);
      expect(secondDoc.id).toBe(firstDoc.id);
      expect(engine.getDocumentCount()).toBe(1);
    });

    it('tracks active document deterministically', async () => {
      const { document: doc1 } = await engine.openResource('C:\\app\\doc1.ts', { initialContent: '' });
      const { document: doc2 } = await engine.openResource('C:\\app\\doc2.ts', { initialContent: '' });

      expect(engine.getActiveDocumentId()).toBe(doc2.id);

      engine.activateDocument(doc1.id);
      expect(engine.getActiveDocumentId()).toBe(doc1.id);
    });
  });

  describe('Untitled Documents', () => {
    it('creates untitled documents with auto-incrementing monotonic sequence', async () => {
      const doc1 = await engine.createUntitled();
      const doc2 = await engine.createUntitled();

      expect(doc1.resourceUri).toBe('untitled:1');
      expect(doc1.title).toBe('Untitled-1');
      expect(doc1.isDirty).toBe(false);

      expect(doc2.resourceUri).toBe('untitled:2');
      expect(doc2.title).toBe('Untitled-2');
    });

    it('initializes dirty flag to true if untitled document has initial content', async () => {
      const doc = await engine.createUntitled({ content: 'pasted notes' });
      expect(doc.isDirty).toBe(true);
      expect(doc.contentRevision).toBe(1);
      expect(doc.savedRevision).toBe(0);
    });
  });

  describe('Content Mutation & Revision Tracking', () => {
    it('advances monotonic revision and sets dirty flag on text update', async () => {
      const { document: doc } = await engine.openResource('C:\\app\\index.ts', { initialContent: 'initial' });

      const updated = await engine.updateText(doc.id, 'updated content');
      expect(updated.contentRevision).toBe(1);
      expect(updated.savedRevision).toBe(0);
      expect(updated.isDirty).toBe(true);
      expect(updated.contentState).toBe('dirty');
      expect(updated.content).toBe('updated content');
    });

    it('suppresses no-op edits when content is identical', async () => {
      const { document: doc } = await engine.openResource('C:\\app\\index.ts', { initialContent: 'initial' });

      const same = await engine.updateText(doc.id, 'initial');
      expect(same.contentRevision).toBe(0);
      expect(same.isDirty).toBe(false);
    });

    it('rejects text updates on read-only documents', async () => {
      const { document: doc } = await engine.openResource('C:\\app\\readonly.ts', {
        initialContent: 'immutable',
        readOnly: true,
      });

      await expect(engine.updateText(doc.id, 'changed')).rejects.toThrow(DocumentReadOnlyError);
    });
  });

  describe('Save Coordination & Revision Race Safety', () => {
    it('clears dirty state when saved revision matches current revision', async () => {
      const fakeHandle = { kind: 'file', name: 'app.ts' } as unknown as FileSystemFileHandle;
      const { document: doc } = await engine.openFileResource(
        {
          uri: 'browser-fs://app.ts',
          name: 'app.ts',
          extension: 'ts',
          readOnly: false,
          exists: true,
          handle: fakeHandle,
        },
        'initial'
      );

      vi.spyOn(fileService, 'writeFile').mockResolvedValue({
        uri: 'browser-fs://app.ts',
        name: 'app.ts',
        extension: 'ts',
        readOnly: false,
        exists: true,
        size: 7,
        modifiedTime: Date.now(),
        handle: fakeHandle,
      });

      await engine.updateText(doc.id, 'version 1');
      expect(doc.contentRevision).toBe(1);
      expect(doc.isDirty).toBe(true);

      const saved = await engine.save(doc.id);
      expect(saved.savedRevision).toBe(1);
      expect(saved.contentRevision).toBe(1);
      expect(saved.isDirty).toBe(false);
      expect(saved.contentState).toBe('clean');
    });

    it('PRESERVES isDirty = true if edits occur while save is in-flight (Revision Race Invariant)', async () => {
      const fakeHandle = { kind: 'file', name: 'app.ts' } as unknown as FileSystemFileHandle;
      const { document: doc } = await engine.openFileResource(
        {
          uri: 'browser-fs://app.ts',
          name: 'app.ts',
          extension: 'ts',
          readOnly: false,
          exists: true,
          handle: fakeHandle,
        },
        'initial'
      );

      await engine.updateText(doc.id, 'version 1'); // rev 1

      // Mock writeFile with delay, during which user types "version 2"
      vi.spyOn(fileService, 'writeFile').mockImplementation(async () => {
        // User edits during physical write!
        await engine.updateText(doc.id, 'version 2 (typed during write)'); // rev 2
        return {
          uri: 'browser-fs://app.ts',
          name: 'app.ts',
          extension: 'ts',
          readOnly: false,
          exists: true,
          size: 9,
          modifiedTime: Date.now(),
          handle: fakeHandle,
        };
      });

      const saved = await engine.save(doc.id, { targetRevision: 1 });

      expect(saved.savedRevision).toBe(1);
      expect(saved.contentRevision).toBe(2);
      expect(saved.isDirty).toBe(true); // Must remain dirty because version 2 was not written!
      expect(saved.contentState).toBe('dirty');
    });

    it('retains buffer content and leaves document dirty if save fails', async () => {
      const fakeHandle = { kind: 'file', name: 'app.ts' } as unknown as FileSystemFileHandle;
      const { document: doc } = await engine.openFileResource(
        {
          uri: 'browser-fs://app.ts',
          name: 'app.ts',
          extension: 'ts',
          readOnly: false,
          exists: true,
          handle: fakeHandle,
        },
        'initial'
      );

      await engine.updateText(doc.id, 'unwritten changes');

      vi.spyOn(fileService, 'writeFile').mockRejectedValue(new Error('Disk full'));

      await expect(engine.save(doc.id)).rejects.toThrow();
      expect(doc.content).toBe('unwritten changes');
      expect(doc.isDirty).toBe(true);
      expect(doc.lifecycleState).toBe('saveFailed');
    });

    it('blocks saving when document has unresolved external conflict', async () => {
      const fakeHandle = { kind: 'file', name: 'app.ts' } as unknown as FileSystemFileHandle;
      const { document: doc } = await engine.openFileResource(
        {
          uri: 'browser-fs://app.ts',
          name: 'app.ts',
          extension: 'ts',
          readOnly: false,
          exists: true,
          handle: fakeHandle,
        },
        'initial'
      );

      await engine.updateText(doc.id, 'local unsaved edit');
      // Trigger external modify -> conflict
      await engine.reconcileExternalChange(doc.id, 'modify', { newContent: 'disk edit' });

      expect(doc.metadata.hasConflict).toBe(true);
      await expect(engine.save(doc.id)).rejects.toThrow(DocumentSaveConflictError);
    });
  });

  describe('Save As & Resource Reassignment', () => {
    it('transitions document to new resource while preserving document ID and revision', async () => {
      const doc = await engine.createUntitled({ content: 'my code' });
      const oldDocId = doc.id;
      const oldUri = doc.resourceUri;

      const newHandle = { kind: 'file', name: 'script.ts' } as unknown as FileSystemFileHandle;
      vi.spyOn(fileService, 'showSavePicker').mockResolvedValue(newHandle);
      vi.spyOn(fileService, 'writeFile').mockResolvedValue({
        uri: 'file:///C:/projects/script.ts',
        name: 'script.ts',
        extension: 'ts',
        readOnly: false,
        exists: true,
        handle: newHandle,
      });

      const saved = await engine.saveAs(doc.id);

      expect(saved.id).toBe(oldDocId);
      expect(saved.resourceUri).toBe('file:///C:/projects/script.ts');
      expect(saved.title).toBe('script.ts');
      expect(saved.languageId).toBe('typescript');
      expect(saved.isDirty).toBe(false);

      // Verify registry mapping reassignment
      expect(engine.getByResource('file:///C:/projects/script.ts')?.id).toBe(oldDocId);
      expect(engine.getByResource(oldUri)).toBeUndefined();
    });
  });

  describe('External Filesystem Reconciliation & Conflict Handling', () => {
    it('safely auto-reloads clean document on external modify', async () => {
      const { document: doc } = await engine.openResource('C:\\app\\clean.ts', {
        initialContent: 'initial text',
      });

      await engine.reconcileExternalChange(doc.id, 'modify', { newContent: 'external change' });

      expect(doc.content).toBe('external change');
      expect(doc.isDirty).toBe(false);
      expect(doc.contentRevision).toBe(1);
      expect(doc.savedRevision).toBe(1);
    });

    it('NEVER silently overwrites dirty document on external modify, raising conflict instead', async () => {
      const { document: doc } = await engine.openResource('C:\\app\\dirty.ts', {
        initialContent: 'original text',
      });

      await engine.updateText(doc.id, 'user modified locally'); // Dirty!

      await engine.reconcileExternalChange(doc.id, 'modify', { newContent: 'git pull change' });

      // Local content must remain intact!
      expect(doc.content).toBe('user modified locally');
      expect(doc.isDirty).toBe(true);
      expect(doc.metadata.hasConflict).toBe(true);
      expect(doc.metadata.externallyModified).toBe(true);
    });

    it('marks resource missing but keeps buffer intact on external delete', async () => {
      const { document: doc } = await engine.openResource('C:\\app\\deleted.ts', {
        initialContent: 'preserve my buffer',
      });

      await engine.reconcileExternalChange(doc.id, 'delete');

      expect(doc.metadata.missingResource).toBe(true);
      expect(doc.resource.exists).toBe(false);
      expect(doc.content).toBe('preserve my buffer');
    });

    it('resolves conflict via keep_local preserving user edits', async () => {
      const { document: doc } = await engine.openResource('C:\\app\\conflict.ts', {
        initialContent: 'base',
      });
      await engine.updateText(doc.id, 'local edit');
      await engine.reconcileExternalChange(doc.id, 'modify', { newContent: 'disk edit' });

      await engine.resolveConflict(doc.id, 'keep_local');

      expect(doc.content).toBe('local edit');
      expect(doc.metadata.hasConflict).toBe(false);
      expect(doc.isDirty).toBe(true);
    });

    it('resolves conflict via revert_disk updating content to disk version', async () => {
      const { document: doc } = await engine.openResource('C:\\app\\conflict.ts', {
        initialContent: 'base',
      });
      await engine.updateText(doc.id, 'local edit');
      await engine.reconcileExternalChange(doc.id, 'modify', { newContent: 'disk edit' });

      await engine.resolveConflict(doc.id, 'revert_disk', 'disk edit');

      expect(doc.content).toBe('disk edit');
      expect(doc.metadata.hasConflict).toBe(false);
      expect(doc.isDirty).toBe(false);
    });
  });

  describe('Close Coordination & Unsaved Changes Protection', () => {
    it('closes clean documents without error', async () => {
      const { document: doc } = await engine.openResource('C:\\app\\file.ts', { initialContent: 'clean' });
      const closed = await engine.close(doc.id);
      expect(closed).toBe(true);
      expect(engine.hasDocument(doc.id)).toBe(false);
    });

    it('prevents closing dirty documents without force flag', async () => {
      const { document: doc } = await engine.openResource('C:\\app\\file.ts', { initialContent: 'clean' });
      await engine.updateText(doc.id, 'dirty text');

      await expect(engine.close(doc.id)).rejects.toThrow(DocumentUnsavedChangesError);
      expect(engine.hasDocument(doc.id)).toBe(true); // Must remain open!

      // With force = true, closing succeeds
      const forceClosed = await engine.close(doc.id, true);
      expect(forceClosed).toBe(true);
      expect(engine.hasDocument(doc.id)).toBe(false);
    });

    it('reports unsaved changes correctly across all open documents', async () => {
      const { document: doc1 } = await engine.openResource('C:\\app\\doc1.ts', { initialContent: '' });
      const { document: doc2 } = await engine.openResource('C:\\app\\doc2.ts', { initialContent: '' });

      expect(doc1.id).toBeDefined();
      expect(engine.hasUnsavedChanges()).toBe(false);
      expect(engine.getDirtyDocuments()).toHaveLength(0);

      await engine.updateText(doc2.id, 'dirty');
      expect(engine.hasUnsavedChanges()).toBe(true);
      expect(engine.getDirtyDocuments()).toEqual([doc2]);
    });
  });

  describe('Document Events & Subscriber Isolation', () => {
    it('emits lifecycle events in deterministic sequence', async () => {
      const events: string[] = [];

      engine.on('document.opening', () => { events.push('opening'); });
      engine.on('document.opened', () => { events.push('opened'); });
      engine.on('document.changed', () => { events.push('changed'); });
      engine.on('document.dirtyChanged', () => { events.push('dirtyChanged'); });
      engine.on('document.closing', () => { events.push('closing'); });
      engine.on('document.closed', () => { events.push('closed'); });

      const { document: doc } = await engine.openResource('C:\\app\\lifecycle.ts', { initialContent: '' });
      await engine.updateText(doc.id, 'change');
      await engine.close(doc.id, true);

      expect(events).toEqual([
        'opening',
        'opened',
        'changed',
        'dirtyChanged',
        'closing',
        'closed',
      ]);
    });

    it('isolates subscriber errors so one failure does not break the engine', async () => {
      engine.on('document.changed', () => {
        throw new Error('Explosion in listener');
      });

      const { document: doc } = await engine.openResource('C:\\app\\test.ts', { initialContent: '' });
      // Should not throw even though subscriber exploded
      await expect(engine.updateText(doc.id, 'safe edit')).resolves.toBeDefined();
    });
  });
});
