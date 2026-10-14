/**
 * QM Editor Core Document Engine & Resource Lifecycle Subsystem
 * Phase 04, Step 36 — Core Application Engine
 */

import { DocumentModel, FileResource } from '../../types';
import {
  DocumentRecord,
  NormalizedResource,
  DocumentEventMap,
  DocumentEventKey,
  DocumentEventListener,
  OpenDocumentOptions,
  CreateUntitledOptions,
  SaveDocumentOptions,
  SaveAsOptions,
  DocumentCapabilities,
  DocumentMetadata,
  ReadOnlyReason,
} from './DocumentTypes';
import {
  DocumentNotFoundError,
  DocumentReadOnlyError,
  DocumentSaveError,
  DocumentSaveConflictError,
  DocumentDisposedError,
  DocumentUnsavedChangesError,
} from './DocumentErrors';
import {
  normalizeResourceUri,
  extractResourceBasename,
  extractResourceExtension,
  detectLineEnding,
  createNormalizedResource,
  bridgeFileResource,
  createUntitledUri,
} from './ResourceIdentity';
import { DocumentRegistry } from './DocumentRegistry';
import { fileService } from '../../services/FileService';
import { globalLanguageRegistry } from '../languageRegistry';
import { globalWorkspaceEngine } from '../workspace';
import { globalDocumentHistoryService } from '../history';
import { EditTransaction, CommittedEditTransaction, globalEditTransactionManager } from '../edit';
import { logger } from '../../utils/logger';

export class DocumentEngine {
  private registry = new DocumentRegistry();
  private listeners = new Map<DocumentEventKey, Set<DocumentEventListener<any>>>();
  private activeSaveLocks = new Map<string, Promise<DocumentRecord>>();
  private isDisposed: boolean = false;

  constructor() {
    // Register unsaved changes checker with the WorkspaceEngine
    globalWorkspaceEngine.registerUnsavedChangesChecker(() => {
      return this.hasUnsavedChanges();
    });
  }

  // ---------------------------------------------------------------------------
  // 1. Event Subscriptions & Dispatch
  // ---------------------------------------------------------------------------

  public on<K extends DocumentEventKey>(
    event: K,
    listener: DocumentEventListener<K>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  public async emit<K extends DocumentEventKey>(
    event: K,
    payload: DocumentEventMap[K]
  ): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    for (const handler of Array.from(handlers)) {
      try {
        await handler(payload);
      } catch (err) {
        logger.error(`DocumentEngine: error in event subscriber for "${event}"`, {
          error: (err as Error).message,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Query & Lookup APIs
  // ---------------------------------------------------------------------------

  public getDocument(documentId: string): DocumentRecord | undefined {
    return this.registry.get(documentId);
  }

  public getByResource(rawUriOrPath: string): DocumentRecord | undefined {
    return this.registry.getByResource(rawUriOrPath);
  }

  public hasDocument(documentId: string): boolean {
    return this.registry.has(documentId);
  }

  public isResourceOpen(rawUriOrPath: string): boolean {
    return this.registry.hasResource(rawUriOrPath);
  }

  public getAllDocuments(): DocumentRecord[] {
    return this.registry.getAll();
  }

  public getOpenDocumentIds(): string[] {
    return this.registry.getOpenIds();
  }

  public getActiveDocument(): DocumentRecord | null {
    return this.registry.getActive();
  }

  public getActiveDocumentId(): string | null {
    return this.registry.getActiveId();
  }

  public getDirtyDocuments(): DocumentRecord[] {
    return this.registry.getAll().filter((d) => d.isDirty);
  }

  public hasUnsavedChanges(): boolean {
    return this.registry.getAll().some((d) => d.isDirty);
  }

  public getDocumentCount(): number {
    return this.registry.count();
  }

  // ---------------------------------------------------------------------------
  // 3. Document Opening & Creation
  // ---------------------------------------------------------------------------

  /**
   * Opens a resource by URI or path.
   * If already open, activates the existing document without creating duplicates.
   */
  public async openResource(
    rawUriOrPath: string,
    options: OpenDocumentOptions = {}
  ): Promise<{ document: DocumentRecord; alreadyOpen: boolean }> {
    this.assertNotDisposed('openResource');

    const normalizedUri = normalizeResourceUri(rawUriOrPath);

    // 1. Duplicate Open Prevention: Activate existing document
    const existing = this.registry.getByResource(normalizedUri);
    if (existing) {
      if (options.activate !== false) {
        this.registry.activate(existing.id);
      }
      return { document: existing, alreadyOpen: true };
    }

    // 2. Read content or use provided initial content
    let content = options.initialContent ?? '';
    let resourceModel: NormalizedResource;

    if (options.initialContent === undefined && !normalizedUri.startsWith('untitled:')) {
      // Need to read from storage if possible
      // If handle or file exists via FileService or physical path
      const basename = extractResourceBasename(normalizedUri);
      resourceModel = createNormalizedResource(normalizedUri, {
        name: basename,
        readOnly: options.readOnly,
      });
    } else {
      const basename = extractResourceBasename(normalizedUri);
      resourceModel = createNormalizedResource(normalizedUri, {
        name: basename,
        readOnly: options.readOnly,
      });
    }

    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const lineEnding = detectLineEnding(content);
    const resolvedLanguage = globalLanguageRegistry.resolveLanguage(
      normalizedUri,
      options.languageId
    );

    const metadata: DocumentMetadata = {
      languageId: resolvedLanguage.id,
      encoding: 'utf-8',
      lineEnding,
      fileSize: content.length,
      isReadOnly: Boolean(options.readOnly),
      readOnlyReason: options.readOnlyReason,
      missingResource: !resourceModel.exists,
      externallyModified: false,
      hasConflict: false,
    };

    const capabilities: DocumentCapabilities = {
      canWrite: !options.readOnly,
      canSaveAs: true,
      canReload: resourceModel.exists,
      canClose: true,
      writeBlockedReason: options.readOnly ? 'Document is read-only.' : undefined,
    };

    const record: DocumentRecord = {
      id: documentId,
      title: resourceModel.name,
      content,
      resourceUri: normalizedUri,
      resource: resourceModel,
      filePath: resourceModel.scheme === 'file' ? normalizedUri.replace(/^file:\/\/\/?/, '') : undefined,
      workspaceId: options.workspaceId || globalWorkspaceEngine.getWorkspaceId() || undefined,
      languageId: resolvedLanguage.id,
      contentRevision: 0,
      savedRevision: 0,
      isDirty: false,
      lifecycleState: 'ready',
      contentState: 'clean',
      metadata,
      capabilities,
      createdAt: Date.now(),
      lastSavedTimestamp: Date.now(),
      savedBaselineContent: content,
    };

    await this.emit('document.opening', {
      documentId: record.id,
      resourceUri: record.resourceUri,
      workspaceId: record.workspaceId,
    });

    this.registry.add(record, options.activate !== false);

    await this.emit('document.opened', {
      documentId: record.id,
      resourceUri: record.resourceUri,
      workspaceId: record.workspaceId,
      title: record.title,
      contentRevision: record.contentRevision,
    });

    logger.info('DocumentEngine: opened document', {
      documentId: record.id,
      uri: record.resourceUri,
      title: record.title,
    });

    return { document: record, alreadyOpen: false };
  }

  /**
   * Opens an existing FileResource model (e.g. from FileService picker or tree node).
   */
  public async openFileResource(
    fileResource: FileResource,
    content: string,
    options: OpenDocumentOptions = {}
  ): Promise<{ document: DocumentRecord; alreadyOpen: boolean }> {
    this.assertNotDisposed('openFileResource');

    const normalizedUri = normalizeResourceUri(fileResource.uri);
    const existing = this.registry.getByResource(normalizedUri);
    if (existing) {
      if (options.activate !== false) {
        this.registry.activate(existing.id);
      }
      return { document: existing, alreadyOpen: true };
    }

    const resource = bridgeFileResource(fileResource);
    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const lineEnding = detectLineEnding(content);
    const resolvedLanguage = globalLanguageRegistry.resolveLanguage(
      fileResource.uri,
      options.languageId
    );

    const isReadOnly = Boolean(fileResource.readOnly || options.readOnly);
    const metadata: DocumentMetadata = {
      languageId: resolvedLanguage.id,
      encoding: 'utf-8',
      lineEnding,
      fileSize: fileResource.size || content.length,
      modifiedTime: fileResource.modifiedTime,
      isReadOnly,
      readOnlyReason: options.readOnlyReason || (fileResource.readOnly ? 'filesystem' : undefined),
      missingResource: !fileResource.exists,
      externallyModified: false,
      hasConflict: false,
    };

    const capabilities: DocumentCapabilities = {
      canWrite: !isReadOnly,
      canSaveAs: true,
      canReload: fileResource.exists,
      canClose: true,
      writeBlockedReason: isReadOnly ? 'Document is read-only.' : undefined,
    };

    const record: DocumentRecord = {
      id: documentId,
      title: fileResource.name,
      content,
      resourceUri: normalizedUri,
      resource,
      filePath: resource.scheme === 'file' ? normalizedUri.replace(/^file:\/\/\/?/, '') : undefined,
      workspaceId: options.workspaceId || globalWorkspaceEngine.getWorkspaceId() || undefined,
      languageId: resolvedLanguage.id,
      contentRevision: 0,
      savedRevision: 0,
      isDirty: false,
      lifecycleState: 'ready',
      contentState: 'clean',
      metadata,
      capabilities,
      createdAt: Date.now(),
      lastSavedTimestamp: fileResource.modifiedTime || Date.now(),
      savedBaselineContent: content,
    };

    await this.emit('document.opening', {
      documentId: record.id,
      resourceUri: record.resourceUri,
      workspaceId: record.workspaceId,
    });

    this.registry.add(record, options.activate !== false);

    await this.emit('document.opened', {
      documentId: record.id,
      resourceUri: record.resourceUri,
      workspaceId: record.workspaceId,
      title: record.title,
      contentRevision: record.contentRevision,
    });

    logger.info('DocumentEngine: opened file resource', {
      documentId: record.id,
      uri: record.resourceUri,
      name: fileResource.name,
    });

    return { document: record, alreadyOpen: false };
  }

  /**
   * Creates a new Untitled document.
   */
  public async createUntitled(options: CreateUntitledOptions = {}): Promise<DocumentRecord> {
    this.assertNotDisposed('createUntitled');

    const seq = this.registry.getNextUntitledSequence();
    const untitledUri = createUntitledUri(seq);
    const title = options.title || (seq === 1 ? 'Untitled-1' : `Untitled-${seq}`);
    const content = options.content ?? '';

    const resource: NormalizedResource = {
      uri: untitledUri,
      scheme: 'untitled',
      name: title,
      extension: extractResourceExtension(title) || 'txt',
      exists: false,
      readOnly: false,
      size: content.length,
    };

    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const lineEnding = detectLineEnding(content);
    const resolvedLanguage = globalLanguageRegistry.resolveLanguage(
      title,
      options.languageId || 'plaintext'
    );

    const isInitiallyDirty = content.length > 0;

    const metadata: DocumentMetadata = {
      languageId: resolvedLanguage.id,
      encoding: 'utf-8',
      lineEnding,
      fileSize: content.length,
      isReadOnly: false,
      missingResource: false,
      externallyModified: false,
      hasConflict: false,
    };

    const capabilities: DocumentCapabilities = {
      canWrite: true,
      canSaveAs: true,
      canReload: false,
      canClose: true,
    };

    const record: DocumentRecord = {
      id: documentId,
      title,
      content,
      resourceUri: untitledUri,
      resource,
      workspaceId: options.workspaceId || globalWorkspaceEngine.getWorkspaceId() || undefined,
      languageId: resolvedLanguage.id,
      contentRevision: isInitiallyDirty ? 1 : 0,
      savedRevision: 0,
      isDirty: isInitiallyDirty,
      lifecycleState: 'ready',
      contentState: isInitiallyDirty ? 'dirty' : 'clean',
      metadata,
      capabilities,
      createdAt: Date.now(),
      lastSavedTimestamp: Date.now(),
      savedBaselineContent: isInitiallyDirty ? '' : content,
    };

    await this.emit('document.created', {
      documentId: record.id,
      resourceUri: record.resourceUri,
      workspaceId: record.workspaceId,
      title: record.title,
      isUntitled: true,
    });

    this.registry.add(record, options.activate !== false);

    await this.emit('document.opened', {
      documentId: record.id,
      resourceUri: record.resourceUri,
      workspaceId: record.workspaceId,
      title: record.title,
      contentRevision: record.contentRevision,
    });

    logger.info('DocumentEngine: created untitled document', {
      documentId: record.id,
      title: record.title,
      uri: record.resourceUri,
    });

    return record;
  }

  /**
   * Activates a document by ID.
   */
  public activateDocument(documentId: string): DocumentRecord | undefined {
    return this.registry.activate(documentId);
  }

  // ---------------------------------------------------------------------------
  // 4. Content Mutation & Buffer Synchronization
  // ---------------------------------------------------------------------------

  /**
   * Updates document text buffer directly and tracks revision and dirty state.
   */
  public async updateText(
    documentId: string,
    newContent: string,
    origin: string = 'user'
  ): Promise<DocumentRecord> {
    this.assertNotDisposed('updateText');

    const doc = this.registry.get(documentId);
    if (!doc) {
      throw new DocumentNotFoundError(documentId);
    }

    if (doc.metadata.isReadOnly) {
      throw new DocumentReadOnlyError(documentId, doc.metadata.readOnlyReason);
    }

    if (doc.content === newContent) {
      return doc;
    }

    const previousRevision = doc.contentRevision;
    const nextRevision = previousRevision + 1;
    const prevDirty = doc.isDirty;

    doc.content = newContent;
    doc.contentRevision = nextRevision;
    const isBaselineEqual =
      doc.savedBaselineContent !== undefined
        ? doc.savedBaselineContent === newContent
        : false;
    doc.isDirty = !isBaselineEqual && nextRevision !== doc.savedRevision;
    doc.contentState = doc.isDirty ? 'dirty' : 'clean';

    // Update metadata
    doc.metadata = {
      ...doc.metadata,
      fileSize: newContent.length,
      lineEnding: detectLineEnding(newContent),
    };

    await this.emit('document.changed', {
      documentId: doc.id,
      resourceUri: doc.resourceUri,
      workspaceId: doc.workspaceId,
      previousRevision,
      newRevision: nextRevision,
      origin,
      isDirty: doc.isDirty,
    });

    if (prevDirty !== doc.isDirty) {
      await this.emit('document.dirtyChanged', {
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        workspaceId: doc.workspaceId,
        isDirty: doc.isDirty,
        contentRevision: doc.contentRevision,
        savedRevision: doc.savedRevision,
      });
    }

    return doc;
  }

  /**
   * Applies an EditTransaction through EditTransactionManager.
   */
  public async applyTransaction(
    documentId: string,
    transaction: EditTransaction
  ): Promise<{ document: DocumentRecord; transaction: CommittedEditTransaction }> {
    this.assertNotDisposed('applyTransaction');

    const doc = this.registry.get(documentId);
    if (!doc) {
      throw new DocumentNotFoundError(documentId);
    }

    const legacyModel = this.toDocumentModel(doc);
    const result = await globalEditTransactionManager.applyTransaction(legacyModel, transaction);

    const prevDirty = doc.isDirty;
    const previousRevision = doc.contentRevision;

    doc.content = result.document.content;
    doc.contentRevision = result.document.contentRevision;
    doc.savedRevision = result.document.savedRevision;
    doc.isDirty = result.document.isDirty;
    doc.contentState = doc.isDirty ? 'dirty' : 'clean';

    doc.metadata = {
      ...doc.metadata,
      fileSize: doc.content.length,
      lineEnding: detectLineEnding(doc.content),
    };

    await this.emit('document.changed', {
      documentId: doc.id,
      resourceUri: doc.resourceUri,
      workspaceId: doc.workspaceId,
      previousRevision,
      newRevision: doc.contentRevision,
      origin: result.transaction.origin,
      isDirty: doc.isDirty,
    });

    if (prevDirty !== doc.isDirty) {
      await this.emit('document.dirtyChanged', {
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        workspaceId: doc.workspaceId,
        isDirty: doc.isDirty,
        contentRevision: doc.contentRevision,
        savedRevision: doc.savedRevision,
      });
    }

    return { document: doc, transaction: result.transaction };
  }

  // ---------------------------------------------------------------------------
  // 5. Saving, Save As & Revision Race Protection
  // ---------------------------------------------------------------------------

  /**
   * Saves document content to underlying storage with strict revision-race protection.
   */
  public async save(
    documentId: string,
    options: SaveDocumentOptions = {}
  ): Promise<DocumentRecord> {
    this.assertNotDisposed('save');

    const doc = this.registry.get(documentId);
    if (!doc) {
      throw new DocumentNotFoundError(documentId);
    }

    // Untitled documents must use Save As flow
    if (doc.resource.scheme === 'untitled') {
      return this.saveAs(documentId);
    }

    if (doc.metadata.isReadOnly) {
      throw new DocumentReadOnlyError(documentId, doc.metadata.readOnlyReason);
    }

    if (doc.metadata.hasConflict) {
      throw new DocumentSaveConflictError(documentId, doc.resourceUri);
    }

    // Coalesce / serialize concurrent saves for the same document
    if (this.activeSaveLocks.has(documentId)) {
      return this.activeSaveLocks.get(documentId)!;
    }

    const savePromise = this.executeSave(doc, options);
    this.activeSaveLocks.set(documentId, savePromise);

    try {
      return await savePromise;
    } finally {
      this.activeSaveLocks.delete(documentId);
    }
  }

  public async executeSave(
    doc: DocumentRecord,
    options: SaveDocumentOptions = {}
  ): Promise<DocumentRecord> {
    const persistingRevision = options?.targetRevision ?? doc.contentRevision;
    const contentSnapshot = doc.content;

    doc.lifecycleState = 'saving';
    doc.contentState = 'saving';

    await this.emit('document.saving', {
      documentId: doc.id,
      resourceUri: doc.resourceUri,
      workspaceId: doc.workspaceId,
      persistingRevision,
    });

    try {
      let updatedResource: FileResource;
      if (doc.resource.handle) {
        updatedResource = await fileService.writeFile(
          doc.resource.handle,
          contentSnapshot
        );
      } else {
        updatedResource = {
          uri: doc.resourceUri,
          name: doc.title,
          extension: doc.resource.extension || '',
          exists: true,
          size: contentSnapshot.length,
          modifiedTime: Date.now(),
          readOnly: false,
        };
      }

      // Save confirmed on disk
      doc.savedRevision = persistingRevision;
      doc.savedBaselineContent = contentSnapshot;
      doc.lastSavedTimestamp = Date.now();
      doc.lifecycleState = 'ready';

      // Update resource metadata
      doc.resource = bridgeFileResource(updatedResource);
      doc.metadata = {
        ...doc.metadata,
        fileSize: updatedResource.size || contentSnapshot.length,
        modifiedTime: updatedResource.modifiedTime || Date.now(),
        missingResource: false,
      };

      // CRITICAL REVISION INVARIANT:
      // If user typed during the save write, doc.contentRevision > persistingRevision!
      // In that case, isDirty remains true, preserving unsaved edits!
      const prevDirty = doc.isDirty;
      const isBaselineMatch = doc.savedBaselineContent === doc.content;
      doc.isDirty = !isBaselineMatch && doc.contentRevision !== doc.savedRevision;
      doc.contentState = doc.isDirty ? 'dirty' : 'clean';

      globalDocumentHistoryService.markSaved(doc.id, persistingRevision);

      await this.emit('document.saved', {
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        workspaceId: doc.workspaceId,
        savedRevision: persistingRevision,
        isStillDirty: doc.isDirty,
        timestamp: doc.lastSavedTimestamp,
      });

      if (prevDirty !== doc.isDirty) {
        await this.emit('document.dirtyChanged', {
          documentId: doc.id,
          resourceUri: doc.resourceUri,
          workspaceId: doc.workspaceId,
          isDirty: doc.isDirty,
          contentRevision: doc.contentRevision,
          savedRevision: doc.savedRevision,
        });
      }

      logger.info('DocumentEngine: saved document', {
        documentId: doc.id,
        savedRevision: persistingRevision,
        isStillDirty: doc.isDirty,
      });

      return doc;
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || 'Write failed';
      doc.lifecycleState = 'saveFailed';
      doc.contentState = 'saveFailed';
      doc.lastError = errorMsg;

      await this.emit('document.saveFailed', {
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        workspaceId: doc.workspaceId,
        persistingRevision,
        error: errorMsg,
      });

      logger.error('DocumentEngine: save failed', {
        documentId: doc.id,
        error: errorMsg,
      });

      throw new DocumentSaveError(doc.id, errorMsg);
    }
  }

  /**
   * Saves document to a new resource destination (Save As).
   * Reassigns resource identity while preserving document ID and in-memory history.
   */
  public async saveAs(
    documentId: string,
    options: SaveAsOptions = {}
  ): Promise<DocumentRecord> {
    this.assertNotDisposed('saveAs');

    const doc = this.registry.get(documentId);
    if (!doc) {
      throw new DocumentNotFoundError(documentId);
    }

    let targetHandle: FileSystemFileHandle | undefined;

    if (options.target && typeof options.target === 'object' && 'kind' in options.target) {
      targetHandle = options.target as FileSystemFileHandle;
    } else {
      const suggestedName = options.suggestedName || doc.title;
      const handle = await fileService.showSavePicker({ suggestedName });
      if (!handle) {
        // User cancelled picker dialog
        return doc;
      }
      targetHandle = handle;
    }

    const persistingRevision = doc.contentRevision;
    const contentSnapshot = doc.content;

    doc.lifecycleState = 'saving';
    doc.contentState = 'saving';

    await this.emit('document.saving', {
      documentId: doc.id,
      resourceUri: doc.resourceUri,
      workspaceId: doc.workspaceId,
      persistingRevision,
    });

    try {
      const writtenResource = await fileService.writeFile(targetHandle, contentSnapshot);
      const normalized = bridgeFileResource(writtenResource);
      const oldResourceUri = doc.resourceUri;

      // Reassign resource identity in registry
      this.registry.reassignResource(doc.id, normalized, normalized.name);

      // Re-resolve language
      const resolvedLang = globalLanguageRegistry.resolveLanguage(normalized.name);
      doc.languageId = resolvedLang.id;
      doc.savedRevision = persistingRevision;
      doc.savedBaselineContent = contentSnapshot;
      doc.lastSavedTimestamp = Date.now();
      doc.lifecycleState = 'ready';

      const prevDirty = doc.isDirty;
      const isBaselineMatch = doc.savedBaselineContent === doc.content;
      doc.isDirty = !isBaselineMatch && doc.contentRevision !== doc.savedRevision;
      doc.contentState = doc.isDirty ? 'dirty' : 'clean';

      doc.metadata = {
        ...doc.metadata,
        languageId: resolvedLang.id,
        fileSize: contentSnapshot.length,
        modifiedTime: Date.now(),
        missingResource: false,
      };

      globalDocumentHistoryService.markSaved(doc.id, persistingRevision);

      await this.emit('document.resourceChanged', {
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        workspaceId: doc.workspaceId,
        oldResourceUri,
        newResourceUri: doc.resourceUri,
        newTitle: doc.title,
      });

      await this.emit('document.saved', {
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        workspaceId: doc.workspaceId,
        savedRevision: persistingRevision,
        isStillDirty: doc.isDirty,
        timestamp: doc.lastSavedTimestamp,
      });

      if (prevDirty !== doc.isDirty) {
        await this.emit('document.dirtyChanged', {
          documentId: doc.id,
          resourceUri: doc.resourceUri,
          workspaceId: doc.workspaceId,
          isDirty: doc.isDirty,
          contentRevision: doc.contentRevision,
          savedRevision: doc.savedRevision,
        });
      }

      logger.info('DocumentEngine: Save As completed', {
        documentId: doc.id,
        fromUri: oldResourceUri,
        toUri: doc.resourceUri,
      });

      return doc;
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || 'Save As write failed';
      doc.lifecycleState = 'saveFailed';
      doc.contentState = 'saveFailed';
      doc.lastError = errorMsg;

      await this.emit('document.saveFailed', {
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        workspaceId: doc.workspaceId,
        persistingRevision,
        error: errorMsg,
      });

      throw new DocumentSaveError(doc.id, errorMsg);
    }
  }

  // ---------------------------------------------------------------------------
  // 6. External Changes & Conflict Reconciliation
  // ---------------------------------------------------------------------------

  /**
   * Reconciles an external filesystem change against an open document.
   * Guarantees that dirty buffers are NEVER silently overwritten.
   */
  public async reconcileExternalChange(
    documentId: string,
    changeType: 'modify' | 'delete' | 'rename',
    payload: {
      newContent?: string;
      newUri?: string;
      newName?: string;
    } = {}
  ): Promise<void> {
    this.assertNotDisposed('reconcileExternalChange');

    const doc = this.registry.get(documentId);
    if (!doc) return;

    // 1. External Deletion
    if (changeType === 'delete') {
      doc.metadata = {
        ...doc.metadata,
        missingResource: true,
      };
      doc.resource = {
        ...doc.resource,
        exists: false,
      };

      await this.emit('document.externalChanged', {
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        workspaceId: doc.workspaceId,
        type: 'delete',
        reloaded: false,
      });

      logger.warn('DocumentEngine: resource deleted on disk', {
        documentId: doc.id,
        uri: doc.resourceUri,
      });
      return;
    }

    // 2. External Rename
    if (changeType === 'rename' && payload.newUri) {
      const oldUri = doc.resourceUri;
      const normalizedNew = normalizeResourceUri(payload.newUri);
      const newName = payload.newName || extractResourceBasename(normalizedNew);

      const updatedResource: NormalizedResource = {
        ...doc.resource,
        uri: normalizedNew,
        name: newName,
      };

      this.registry.reassignResource(doc.id, updatedResource, newName);

      await this.emit('document.resourceChanged', {
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        workspaceId: doc.workspaceId,
        oldResourceUri: oldUri,
        newResourceUri: normalizedNew,
        newTitle: newName,
      });
      return;
    }

    // 3. External Modification
    if (changeType === 'modify') {
      if (doc.isDirty) {
        // Dirty document: CONFLICT DETECTED. Do NOT overwrite silently!
        doc.metadata = {
          ...doc.metadata,
          hasConflict: true,
          externallyModified: true,
        };

        await this.emit('document.conflictDetected', {
          documentId: doc.id,
          resourceUri: doc.resourceUri,
          workspaceId: doc.workspaceId,
          localRevision: doc.contentRevision,
          reason: 'File was modified on disk while unsaved changes exist in editor.',
        });

        logger.warn('DocumentEngine: conflict detected on dirty document', {
          documentId: doc.id,
          uri: doc.resourceUri,
        });
      } else {
        // Clean document: safe automatic reload
        const diskContent = payload.newContent ?? '';
        doc.content = diskContent;
        doc.contentRevision += 1;
        doc.savedRevision = doc.contentRevision;
        doc.savedBaselineContent = diskContent;
        doc.isDirty = false;
        doc.contentState = 'clean';
        doc.metadata = {
          ...doc.metadata,
          fileSize: diskContent.length,
          lineEnding: detectLineEnding(diskContent),
          externallyModified: false,
          hasConflict: false,
        };

        await this.emit('document.externalChanged', {
          documentId: doc.id,
          resourceUri: doc.resourceUri,
          workspaceId: doc.workspaceId,
          type: 'modify',
          reloaded: true,
        });

        logger.info('DocumentEngine: clean document safely reloaded from disk', {
          documentId: doc.id,
          uri: doc.resourceUri,
        });
      }
    }
  }

  /**
   * Resolves an external modification conflict.
   */
  public async resolveConflict(
    documentId: string,
    resolution: 'keep_local' | 'revert_disk',
    diskContent?: string
  ): Promise<void> {
    this.assertNotDisposed('resolveConflict');

    const doc = this.registry.get(documentId);
    if (!doc) return;

    if (resolution === 'keep_local') {
      doc.metadata = {
        ...doc.metadata,
        hasConflict: false,
        externallyModified: false,
      };
      logger.info('DocumentEngine: conflict resolved (keep_local)', { documentId });
      return;
    }

    if (resolution === 'revert_disk') {
      let content = diskContent;
      if (content === undefined && doc.resource.handle) {
        const readResult = await fileService.readFile(doc.resource.handle);
        content = readResult.content;
      }
      content = content ?? '';

      doc.content = content;
      doc.contentRevision += 1;
      doc.savedRevision = doc.contentRevision;
      doc.savedBaselineContent = content;
      doc.isDirty = false;
      doc.contentState = 'clean';
      doc.metadata = {
        ...doc.metadata,
        fileSize: content.length,
        lineEnding: detectLineEnding(content),
        hasConflict: false,
        externallyModified: false,
      };

      await this.emit('document.changed', {
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        workspaceId: doc.workspaceId,
        previousRevision: doc.contentRevision - 1,
        newRevision: doc.contentRevision,
        origin: 'revert_disk',
        isDirty: false,
      });

      await this.emit('document.dirtyChanged', {
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        workspaceId: doc.workspaceId,
        isDirty: false,
        contentRevision: doc.contentRevision,
        savedRevision: doc.savedRevision,
      });

      logger.info('DocumentEngine: conflict resolved (revert_disk)', { documentId });
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Document Close & Disposal
  // ---------------------------------------------------------------------------

  /**
   * Checks whether a document can be safely closed without data loss.
   */
  public canClose(documentId: string): { canClose: boolean; isDirty: boolean } {
    const doc = this.registry.get(documentId);
    if (!doc) return { canClose: true, isDirty: false };
    return { canClose: !doc.isDirty, isDirty: doc.isDirty };
  }

  /**
   * Closes a document. If dirty and !force, throws DocumentUnsavedChangesError.
   */
  public async close(documentId: string, force: boolean = false): Promise<boolean> {
    this.assertNotDisposed('close');

    const doc = this.registry.get(documentId);
    if (!doc) return true;

    if (doc.isDirty && !force) {
      throw new DocumentUnsavedChangesError(documentId, doc.title);
    }

    doc.lifecycleState = 'closing';

    await this.emit('document.closing', {
      documentId: doc.id,
      resourceUri: doc.resourceUri,
      workspaceId: doc.workspaceId,
      isDirty: doc.isDirty,
    });

    // Cleanup associated subsystem resources (diagnostics outlive closed tabs per Section 33)
    globalDocumentHistoryService.disposeDocument(documentId);

    const { removed } = this.registry.remove(documentId);
    if (removed) {
      removed.lifecycleState = 'closed';
    }

    await this.emit('document.closed', {
      documentId,
      resourceUri: doc.resourceUri,
      workspaceId: doc.workspaceId,
      title: doc.title,
    });

    logger.info('DocumentEngine: document closed', {
      documentId,
      uri: doc.resourceUri,
      title: doc.title,
    });

    return true;
  }

  /**
   * Closes all documents in the registry.
   */
  public async closeAll(force: boolean = false): Promise<boolean> {
    this.assertNotDisposed('closeAll');

    if (!force) {
      const dirty = this.getDirtyDocuments();
      if (dirty.length > 0) {
        throw new DocumentUnsavedChangesError(dirty[0].id, dirty[0].title);
      }
    }

    const ids = this.registry.getOpenIds();
    for (const id of ids) {
      await this.close(id, true);
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // 8. Document Preferences & Metadata Setters
  // ---------------------------------------------------------------------------

  /**
   * Updates the language identifier of an open document.
   */
  public async setDocumentLanguage(
    documentId: string,
    languageId: string,
    isManual: boolean = true
  ): Promise<void> {
    this.assertNotDisposed('setDocumentLanguage');
    const doc = this.registry.get(documentId);
    if (!doc) throw new DocumentNotFoundError(documentId);

    doc.languageId = languageId;
    doc.metadata = {
      ...doc.metadata,
      languageId,
    };

    await this.emit('document.languageChanged', {
      documentId: doc.id,
      resourceUri: doc.resourceUri,
      workspaceId: doc.workspaceId,
      languageId,
      isManual,
    });
  }

  /**
   * Updates the encoding metadata of an open document.
   */
  public async setDocumentEncoding(
    documentId: string,
    encoding: string,
    isManual: boolean = true
  ): Promise<void> {
    this.assertNotDisposed('setDocumentEncoding');
    const doc = this.registry.get(documentId);
    if (!doc) throw new DocumentNotFoundError(documentId);

    doc.metadata = {
      ...doc.metadata,
      encoding,
    };

    await this.emit('document.encodingChanged', {
      documentId: doc.id,
      resourceUri: doc.resourceUri,
      workspaceId: doc.workspaceId,
      encoding,
      isManual,
    });
  }

  /**
   * Sets or toggles read-only status on an open document.
   */
  public async setDocumentReadOnly(
    documentId: string,
    isReadOnly: boolean,
    reason?: ReadOnlyReason
  ): Promise<void> {
    this.assertNotDisposed('setDocumentReadOnly');
    const doc = this.registry.get(documentId);
    if (!doc) throw new DocumentNotFoundError(documentId);

    doc.metadata = {
      ...doc.metadata,
      isReadOnly,
      readOnlyReason: reason,
    };
    doc.capabilities = {
      ...doc.capabilities,
      canWrite: !isReadOnly,
      writeBlockedReason: isReadOnly
        ? reason
          ? `Document is read-only (${reason}).`
          : 'Document is read-only.'
        : undefined,
    };

    await this.emit('document.readOnlyChanged', {
      documentId: doc.id,
      resourceUri: doc.resourceUri,
      workspaceId: doc.workspaceId,
      isReadOnly,
      reason,
    });
  }

  // ---------------------------------------------------------------------------
  // 9. Legacy DocumentModel Bridge (for UI/Adapter Compatibility)
  // ---------------------------------------------------------------------------

  public toDocumentModel(record: DocumentRecord): DocumentModel {
    return {
      id: record.id,
      title: record.title,
      content: record.content,
      filePath: record.filePath,
      fileResource: {
        uri: record.resourceUri,
        name: record.resource.name,
        extension: record.resource.extension,
        readOnly: record.resource.readOnly,
        exists: record.resource.exists,
        size: record.resource.size,
        modifiedTime: record.resource.modifiedTime,
        handle: record.resource.handle,
      },
      language: record.languageId,
      contentRevision: record.contentRevision,
      savedRevision: record.savedRevision,
      isDirty: record.isDirty,
      lastSavedTimestamp: record.lastSavedTimestamp,
      savedBaselineContent: record.savedBaselineContent,
    };
  }

  public toDocumentModels(): DocumentModel[] {
    return this.registry.getAll().map((r) => this.toDocumentModel(r));
  }

  // ---------------------------------------------------------------------------
  // 9. Lifecycle Cleanup & Disposal
  // ---------------------------------------------------------------------------

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    this.registry.clear();
    this.listeners.clear();
    this.activeSaveLocks.clear();

    logger.info('DocumentEngine: disposed');
  }

  public reset(): void {
    this.isDisposed = false;
    this.registry.clear();
    this.listeners.clear();
    this.activeSaveLocks.clear();
  }

  private assertNotDisposed(operation: string): void {
    if (this.isDisposed) {
      throw new DocumentDisposedError(operation);
    }
  }
}

/**
 * Authoritative global DocumentEngine singleton.
 */
export const globalDocumentEngine = new DocumentEngine();
