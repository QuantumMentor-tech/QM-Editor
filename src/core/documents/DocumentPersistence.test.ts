/**
 * QM Editor Document Persistence & Resource State Test Suite
 * Phase 05, Step 48 — Persistent Document Metadata, Resource State & Document Persistence Foundation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DocumentPersistenceCoordinator,
  DocumentEngine,
} from './index';
import {
  StorageService,
  MemoryStorageAdapter,
  DocumentMetadataRepository,
  globalSchemaRegistry,
  globalMigrationRegistry,
  DocumentMetadataDTO,
  ResourceStateDTO,
} from '../storage';
import { WorkspaceEngine } from '../workspace/WorkspaceEngine';
import { EditorCoordinationService } from '../editor/EditorCoordinationService';

describe('Document Metadata & Resource State Persistence (Step 48)', () => {
  let memoryAdapter: MemoryStorageAdapter;
  let storageService: StorageService;
  let docRepo: DocumentMetadataRepository;
  let documentEngine: DocumentEngine;
  let workspaceEngine: WorkspaceEngine;
  let editorCoordination: EditorCoordinationService;
  let coordinator: DocumentPersistenceCoordinator;

  const WORKSPACE_A = 'ws-test-alpha';
  const WORKSPACE_B = 'ws-test-beta';
  const FILE_URI_A = 'file:///C:/projects/app/src/index.ts';
  const FILE_URI_B = 'file:///C:/projects/other/src/index.ts';

  beforeEach(async () => {
    memoryAdapter = new MemoryStorageAdapter();
    storageService = new StorageService({ adapter: memoryAdapter });
    await storageService.initialize();

    docRepo = new DocumentMetadataRepository(storageService);
    documentEngine = new DocumentEngine();
    workspaceEngine = new WorkspaceEngine();
    editorCoordination = new EditorCoordinationService();

    coordinator = new DocumentPersistenceCoordinator({
      documentEngine,
      workspaceEngine,
      metadataRepo: docRepo,
      editorCoordination,
      config: {
        autoPersistMetadata: true,
        maxRecentDocuments: 5,
        enableAutoLanguagePersistence: true,
        enableAutoEncodingPersistence: true,
      },
    });

    coordinator.initialize();
  });

  afterEach(async () => {
    coordinator.dispose();
    documentEngine.dispose();
    editorCoordination.dispose();
    await storageService.dispose();
    globalSchemaRegistry.reset();
    globalMigrationRegistry.reset();
  });

  // ---------------------------------------------------------------------------
  // 1. Serialization, Validation & Repository CRUD
  // ---------------------------------------------------------------------------
  describe('Document Metadata & Resource State CRUD', () => {
    it('saves, reads, and deletes document metadata correctly', async () => {
      const metaDTO: DocumentMetadataDTO = {
        version: 1,
        resourceUri: FILE_URI_A,
        workspaceId: WORKSPACE_A,
        languageId: 'typescript',
        isManualLanguage: true,
        encoding: 'utf-8',
        isManualEncoding: false,
        lineEnding: 'lf',
        isReadOnly: false,
        lastKnownSize: 1024,
        lastKnownModifiedTime: 1700000000,
        lastOpenedAt: 1700000001,
        lastSavedAt: 1700000002,
        cursorPosition: { line: 12, column: 4 },
      };

      await docRepo.saveDocumentMetadata(WORKSPACE_A, FILE_URI_A, metaDTO);

      const retrieved = await docRepo.getDocumentMetadata(WORKSPACE_A, FILE_URI_A);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.resourceUri).toBe(FILE_URI_A);
      expect(retrieved!.workspaceId).toBe(WORKSPACE_A);
      expect(retrieved!.languageId).toBe('typescript');
      expect(retrieved!.isManualLanguage).toBe(true);
      expect(retrieved!.cursorPosition).toEqual({ line: 12, column: 4 });

      // Delete
      const deleted = await docRepo.deleteDocumentMetadata(WORKSPACE_A, FILE_URI_A);
      expect(deleted).toBe(true);

      const afterDelete = await docRepo.getDocumentMetadata(WORKSPACE_A, FILE_URI_A);
      expect(afterDelete).toBeNull();
    });

    it('saves and reads resource state correctly', async () => {
      const resDTO: ResourceStateDTO = {
        version: 1,
        resourceUri: FILE_URI_A,
        workspaceId: WORKSPACE_A,
        basename: 'index.ts',
        scheme: 'file',
        exists: true,
        lastKnownModifiedTime: 1700000000,
        lastKnownSize: 2048,
        lastCheckedAt: 1700000005,
      };

      await docRepo.saveResourceState(WORKSPACE_A, FILE_URI_A, resDTO);

      const retrieved = await docRepo.getResourceState(WORKSPACE_A, FILE_URI_A);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.basename).toBe('index.ts');
      expect(retrieved!.exists).toBe(true);
      expect(retrieved!.scheme).toBe('file');
      expect(retrieved!.lastKnownSize).toBe(2048);

      const deleted = await docRepo.deleteResourceState(WORKSPACE_A, FILE_URI_A);
      expect(deleted).toBe(true);
      expect(await docRepo.getResourceState(WORKSPACE_A, FILE_URI_A)).toBeNull();
    });

    it('lists all document metadata records belonging to a workspace', async () => {
      const doc1: DocumentMetadataDTO = {
        version: 1,
        resourceUri: 'file:///C:/projects/app/file1.ts',
        workspaceId: WORKSPACE_A,
        languageId: 'typescript',
        encoding: 'utf-8',
        lineEnding: 'lf',
        lastOpenedAt: Date.now(),
      };
      const doc2: DocumentMetadataDTO = {
        version: 1,
        resourceUri: 'file:///C:/projects/app/file2.ts',
        workspaceId: WORKSPACE_A,
        languageId: 'typescript',
        encoding: 'utf-8',
        lineEnding: 'lf',
        lastOpenedAt: Date.now(),
      };

      await docRepo.saveDocumentMetadata(WORKSPACE_A, doc1.resourceUri, doc1);
      await docRepo.saveDocumentMetadata(WORKSPACE_A, doc2.resourceUri, doc2);

      const docs = await docRepo.listWorkspaceDocuments(WORKSPACE_A);
      expect(docs.length).toBe(2);
      expect(docs.map((d) => d.resourceUri).sort()).toEqual([
        'file:///C:/projects/app/file1.ts',
        'file:///C:/projects/app/file2.ts',
      ]);
    });

    it('clears all document and resource metadata when clearWorkspaceDocuments is called', async () => {
      const doc: DocumentMetadataDTO = {
        version: 1,
        resourceUri: FILE_URI_A,
        workspaceId: WORKSPACE_A,
        languageId: 'typescript',
        encoding: 'utf-8',
        lineEnding: 'lf',
        lastOpenedAt: Date.now(),
      };
      const res: ResourceStateDTO = {
        version: 1,
        resourceUri: FILE_URI_A,
        workspaceId: WORKSPACE_A,
        basename: 'index.ts',
        scheme: 'file',
        exists: true,
        lastCheckedAt: Date.now(),
      };

      await docRepo.saveDocumentMetadata(WORKSPACE_A, FILE_URI_A, doc);
      await docRepo.saveResourceState(WORKSPACE_A, FILE_URI_A, res);

      await docRepo.clearWorkspaceDocuments(WORKSPACE_A);

      expect(await docRepo.getDocumentMetadata(WORKSPACE_A, FILE_URI_A)).toBeNull();
      expect(await docRepo.getResourceState(WORKSPACE_A, FILE_URI_A)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Validation & Corruption Protection
  // ---------------------------------------------------------------------------
  describe('Metadata Validation & Protection', () => {
    it('rejects document metadata with invalid or missing required properties', async () => {
      const invalidMeta = {
        version: 1,
        resourceUri: '', // Invalid empty URI
        workspaceId: WORKSPACE_A,
        languageId: 'typescript',
      } as any;

      await expect(
        docRepo.saveDocumentMetadata(WORKSPACE_A, 'invalid-uri', invalidMeta)
      ).rejects.toThrow();
    });

    it('validates and accepts valid optional fields without corruption', async () => {
      const validMeta: DocumentMetadataDTO = {
        version: 1,
        resourceUri: FILE_URI_A,
        workspaceId: WORKSPACE_A,
        languageId: 'markdown',
        encoding: 'utf-8',
        lineEnding: 'crlf',
        lastOpenedAt: Date.now(),
        isReadOnly: true,
        readOnlyReason: 'File is locked by source control',
      };

      await docRepo.saveDocumentMetadata(WORKSPACE_A, FILE_URI_A, validMeta);
      const read = await docRepo.getDocumentMetadata(WORKSPACE_A, FILE_URI_A);
      expect(read?.isReadOnly).toBe(true);
      expect(read?.readOnlyReason).toBe('File is locked by source control');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Workspace Isolation
  // ---------------------------------------------------------------------------
  describe('Workspace Isolation', () => {
    it('ensures document metadata is strictly isolated per workspace', async () => {
      const metaA: DocumentMetadataDTO = {
        version: 1,
        resourceUri: FILE_URI_A,
        workspaceId: WORKSPACE_A,
        languageId: 'typescript',
        encoding: 'utf-8',
        lineEnding: 'lf',
        lastOpenedAt: Date.now(),
      };
      const metaB: DocumentMetadataDTO = {
        version: 1,
        resourceUri: FILE_URI_B,
        workspaceId: WORKSPACE_B,
        languageId: 'python',
        encoding: 'utf-8',
        lineEnding: 'lf',
        lastOpenedAt: Date.now(),
      };

      await docRepo.saveDocumentMetadata(WORKSPACE_A, FILE_URI_A, metaA);
      await docRepo.saveDocumentMetadata(WORKSPACE_B, FILE_URI_B, metaB);

      // Workspace A cannot read Workspace B's document
      const readFromA = await docRepo.getDocumentMetadata(WORKSPACE_A, FILE_URI_B);
      expect(readFromA).toBeNull();

      const readFromB = await docRepo.getDocumentMetadata(WORKSPACE_B, FILE_URI_A);
      expect(readFromB).toBeNull();

      const listA = await docRepo.listWorkspaceDocuments(WORKSPACE_A);
      expect(listA.length).toBe(1);
      expect(listA[0].languageId).toBe('typescript');

      const listB = await docRepo.listWorkspaceDocuments(WORKSPACE_B);
      expect(listB.length).toBe(1);
      expect(listB[0].languageId).toBe('python');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Document Open Lifecycle & Preference Restoration
  // ---------------------------------------------------------------------------
  describe('Document Open Lifecycle', () => {
    it('persists metadata and restores manual language override on document open', async () => {
      // Pre-save metadata with manual language override 'markdown'
      const preSaved: DocumentMetadataDTO = {
        version: 1,
        resourceUri: FILE_URI_A,
        workspaceId: WORKSPACE_A,
        languageId: 'markdown',
        isManualLanguage: true,
        encoding: 'utf-8',
        isManualEncoding: false,
        lineEnding: 'lf',
        lastOpenedAt: 1000,
      };
      await docRepo.saveDocumentMetadata(WORKSPACE_A, FILE_URI_A, preSaved);

      // Open document in DocumentEngine with default detected language 'typescript'
      const { document: doc } = await documentEngine.openResource(FILE_URI_A, {
        initialContent: '# Hello QM',
        languageId: 'typescript',
        workspaceId: WORKSPACE_A,
      });

      // Coordinator handles document.opened and restores manual override
      expect(doc.languageId).toBe('markdown');

      // Stored metadata reflects updated lastOpenedAt
      const updated = await coordinator.getMetadata(WORKSPACE_A, FILE_URI_A);
      expect(updated).not.toBeNull();
      expect(updated!.languageId).toBe('markdown');
      expect(updated!.isManualLanguage).toBe(true);
      expect(updated!.lastOpenedAt).toBeGreaterThan(1000);
    });

    it('records recent document on open', async () => {
      await documentEngine.openResource(FILE_URI_A, {
        initialContent: 'console.log("hello");',
        languageId: 'typescript',
        workspaceId: WORKSPACE_A,
      });

      const recent = await coordinator.getRecentDocuments(WORKSPACE_A);
      expect(recent.length).toBe(1);
      expect(recent[0].path).toBe(FILE_URI_A);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Document Save Lifecycle & Failure Safety
  // ---------------------------------------------------------------------------
  describe('Document Save Lifecycle', () => {
    it('updates lastSavedAt and timestamps on successful document save', async () => {
      const { document: doc } = await documentEngine.openResource(FILE_URI_A, {
        initialContent: 'export const a = 1;',
        languageId: 'typescript',
        workspaceId: WORKSPACE_A,
      });

      // Simulate successful save event
      const saveTimestamp = Date.now() + 5000;
      doc.isDirty = false;
      doc.lastSavedTimestamp = saveTimestamp;
      await documentEngine.emit('document.saved', {
        documentId: doc.id,
        resourceUri: FILE_URI_A,
        workspaceId: WORKSPACE_A,
        timestamp: saveTimestamp,
        savedRevision: 1,
        isStillDirty: false,
      });

      const meta = await coordinator.getMetadata(WORKSPACE_A, FILE_URI_A);
      expect(meta?.lastSavedAt).toBe(saveTimestamp);
    });

    it('suppresses metadata save update on save failure', async () => {
      const { document: doc } = await documentEngine.openResource(FILE_URI_A, {
        initialContent: 'export const a = 1;',
        languageId: 'typescript',
        workspaceId: WORKSPACE_A,
      });

      const beforeSave = await coordinator.getMetadata(WORKSPACE_A, FILE_URI_A);
      expect(beforeSave?.lastSavedAt).toBeUndefined();

      // Emit saveFailed
      await documentEngine.emit('document.saveFailed', {
        documentId: doc.id,
        resourceUri: FILE_URI_A,
        workspaceId: WORKSPACE_A,
        persistingRevision: 1,
        error: 'Permission denied on disk write',
      });

      const afterFailedSave = await coordinator.getMetadata(WORKSPACE_A, FILE_URI_A);
      // Must NOT falsely report save success or set lastSavedAt
      expect(afterFailedSave?.lastSavedAt).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Save As & Rename Resource Migration
  // ---------------------------------------------------------------------------
  describe('Save As & Rename Resource Lifecycle', () => {
    it('migrates metadata and cleans up old URI records without orphaned duplicates', async () => {
      const { document: doc } = await documentEngine.openResource(FILE_URI_A, {
        initialContent: 'let x = 10;',
        languageId: 'typescript',
        workspaceId: WORKSPACE_A,
      });

      // Manually set language override
      await documentEngine.setDocumentLanguage(doc.id, 'javascript', true);

      // Verify old URI metadata exists
      const oldMeta = await coordinator.getMetadata(WORKSPACE_A, FILE_URI_A);
      expect(oldMeta?.languageId).toBe('javascript');

      // Trigger Save As / Rename to new URI
      const NEW_URI = 'file:///C:/projects/app/src/renamed.js';
      doc.resource = {
        ...doc.resource,
        uri: NEW_URI,
        name: 'renamed.js',
      };
      await documentEngine.emit('document.resourceChanged', {
        documentId: doc.id,
        resourceUri: NEW_URI,
        oldResourceUri: FILE_URI_A,
        newResourceUri: NEW_URI,
        newTitle: 'renamed.js',
        workspaceId: WORKSPACE_A,
      });

      // Old metadata must be cleaned up
      const oldCheck = await coordinator.getMetadata(WORKSPACE_A, FILE_URI_A);
      expect(oldCheck).toBeNull();

      // New metadata must exist and inherit manual preferences
      const newCheck = await coordinator.getMetadata(WORKSPACE_A, NEW_URI);
      expect(newCheck).not.toBeNull();
      expect(newCheck?.languageId).toBe('javascript');
      expect(newCheck?.isManualLanguage).toBe(true);

      // Verify recent documents updated to new URI
      const recent = await coordinator.getRecentDocuments(WORKSPACE_A);
      expect(recent.some((r) => r.path === NEW_URI)).toBe(true);
      expect(recent.some((r) => r.path === FILE_URI_A)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. External Changes (Modify / Delete)
  // ---------------------------------------------------------------------------
  describe('External Changes Reconciliation', () => {
    it('updates resource state exists to false on external file deletion without destroying history', async () => {
      const { document: doc } = await documentEngine.openResource(FILE_URI_A, {
        initialContent: 'test',
        languageId: 'typescript',
        workspaceId: WORKSPACE_A,
      });

      const initialRes = await coordinator.getResourceState(WORKSPACE_A, FILE_URI_A);
      expect(initialRes?.exists).toBe(true);

      // External file watcher reports delete
      await documentEngine.emit('document.externalChanged', {
        documentId: doc.id,
        resourceUri: FILE_URI_A,
        type: 'delete',
        workspaceId: WORKSPACE_A,
        reloaded: false,
      });

      const updatedRes = await coordinator.getResourceState(WORKSPACE_A, FILE_URI_A);
      expect(updatedRes?.exists).toBe(false);

      // Metadata record is still preserved for diagnostics/reopening
      const meta = await coordinator.getMetadata(WORKSPACE_A, FILE_URI_A);
      expect(meta).not.toBeNull();
    });

    it('refreshes last-known modified timestamp and size on external modification', async () => {
      const { document: doc } = await documentEngine.openResource(FILE_URI_A, {
        initialContent: 'test',
        languageId: 'typescript',
        workspaceId: WORKSPACE_A,
      });

      doc.metadata = {
        ...doc.metadata,
        fileSize: 4096,
        modifiedTime: 1750000000,
      };

      await documentEngine.emit('document.externalChanged', {
        documentId: doc.id,
        resourceUri: FILE_URI_A,
        type: 'modify',
        workspaceId: WORKSPACE_A,
        reloaded: true,
      });

      const meta = await coordinator.getMetadata(WORKSPACE_A, FILE_URI_A);
      expect(meta?.lastKnownSize).toBe(4096);
      expect(meta?.lastKnownModifiedTime).toBe(1750000000);
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Untitled Buffer Exclusion & Strict Content Authority Boundary
  // ---------------------------------------------------------------------------
  describe('Untitled Buffers & Content Protection', () => {
    it('excludes untitled buffers from persistent document metadata storage', async () => {
      const untitledDoc = await documentEngine.createUntitled({
        workspaceId: WORKSPACE_A,
        content: 'temporary scratchpad',
      });

      // Untitled URI starts with 'untitled:'
      expect(untitledDoc.resource.uri).toMatch(/^untitled:/);

      // Coordinator must NOT persist untitled buffers
      const meta = await coordinator.getMetadata(WORKSPACE_A, untitledDoc.resource.uri);
      expect(meta).toBeNull();

      const res = await coordinator.getResourceState(WORKSPACE_A, untitledDoc.resource.uri);
      expect(res).toBeNull();
    });

    it('strictly avoids persisting buffer text or source code contents in metadata', async () => {
      const sensitiveCode = 'const SECRET_TOKEN = "xyz-12345";';
      await documentEngine.openResource(FILE_URI_A, {
        initialContent: sensitiveCode,
        languageId: 'typescript',
        workspaceId: WORKSPACE_A,
      });

      const meta = await coordinator.getMetadata(WORKSPACE_A, FILE_URI_A);
      expect(meta).not.toBeNull();

      // Check serialized representation in underlying storage adapter
      const rawStored = await memoryAdapter.get(`ws:${WORKSPACE_A}:doc:${encodeURIComponent(FILE_URI_A)}`);
      expect(rawStored).not.toBeNull();
      const stringified = JSON.stringify(rawStored);
      expect(stringified).not.toContain(sensitiveCode);
      expect(stringified).not.toContain('SECRET_TOKEN');
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Concurrency & Stale Write Protection
  // ---------------------------------------------------------------------------
  describe('Record Versioning & Concurrency Protection', () => {
    it('rejects stale metadata writes when expectedRecordVersion does not match', async () => {
      const meta: DocumentMetadataDTO = {
        version: 1,
        resourceUri: FILE_URI_A,
        workspaceId: WORKSPACE_A,
        languageId: 'typescript',
        encoding: 'utf-8',
        lineEnding: 'lf',
        lastOpenedAt: 1000,
      };

      // Initial write creates record version 1
      await docRepo.saveDocumentMetadata(WORKSPACE_A, FILE_URI_A, meta);

      // Another write bumps record to version 2
      await docRepo.saveDocumentMetadata(WORKSPACE_A, FILE_URI_A, {
        ...meta,
        lastOpenedAt: 2000,
      });

      // A stale update expecting version 1 must be rejected
      await expect(
        docRepo.saveDocumentMetadata(WORKSPACE_A, FILE_URI_A, { ...meta, lastOpenedAt: 3000 }, 1)
      ).rejects.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Schema Migration
  // ---------------------------------------------------------------------------
  describe('Document Metadata Schema Migration Pipeline', () => {
    it('executes schema migration when reading older document metadata schema version', async () => {
      // Register v2 schema
      globalSchemaRegistry.register({
        schemaId: 'qm.document.metadata',
        currentVersion: 2,
        description: 'V2 Document Metadata Schema with pinned flag',
        validate: (data: unknown): data is any => {
          if (typeof data !== 'object' || data === null) return false;
          const d = data as Record<string, any>;
          return typeof d.version === 'number' && typeof d.pinned === 'boolean';
        },
      });

      // Register migration from v1 to v2
      globalMigrationRegistry.registerMigration({
        schemaId: 'qm.document.metadata',
        fromVersion: 1,
        toVersion: 2,
        description: 'Migrate document metadata from v1 to v2',
        migrate: async (oldPayload: any) => ({
          ...oldPayload,
          version: 2,
          pinned: false,
        }),
      });

      // Write a v1 record directly to adapter
      const rawV1 = {
        key: `ws:${WORKSPACE_A}:doc:${encodeURIComponent(FILE_URI_A)}`,
        schemaId: 'qm.document.metadata',
        schemaVersion: 1,
        recordVersion: 1,
        createdAt: 1000,
        updatedAt: 1000,
        scope: 'workspace',
        workspaceId: WORKSPACE_A,
        payload: {
          version: 1,
          resourceUri: FILE_URI_A,
          workspaceId: WORKSPACE_A,
          languageId: 'typescript',
          encoding: 'utf-8',
          lineEnding: 'lf',
          lastOpenedAt: 1000,
        },
      };
      await memoryAdapter.set(rawV1 as any);

      // Reading via storage auto-migrates to v2
      const read = await storageService.read<any>(
        `ws:${WORKSPACE_A}:doc:${encodeURIComponent(FILE_URI_A)}`,
        'qm.document.metadata'
      );
      expect(read).not.toBeNull();
      expect(read!.schemaVersion).toBe(2);
      expect(read!.payload.version).toBe(2);
      expect(read!.payload.pinned).toBe(false);
      expect(read!.payload.languageId).toBe('typescript');
    });
  });
});
