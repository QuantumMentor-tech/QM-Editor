/**
 * QM Editor Document Persistence Coordinator
 * Phase 05, Step 48 — Persistent Document Metadata, Resource State & Document Persistence Foundation
 */

import { DocumentEngine, globalDocumentEngine } from './DocumentEngine';
import { WorkspaceEngine, globalWorkspaceEngine } from '../workspace/WorkspaceEngine';
import {
  IDocumentMetadataRepository,
  globalDocumentMetadataRepository,
} from '../storage/repositories/DocumentMetadataRepository';
import {
  DocumentMetadataDTO,
  ResourceStateDTO,
  RecentDocumentDTO,
} from '../storage/StorageTypes';
import { EditorCoordinationService, globalEditorCoordinationService } from '../editor/EditorCoordinationService';
import { normalizeResourceUri } from './ResourceIdentity';
import { logger } from '../../utils/logger';

export interface DocumentPersistenceConfig {
  autoPersistMetadata?: boolean;
  maxRecentDocuments?: number;
  enableAutoLanguagePersistence?: boolean;
  enableAutoEncodingPersistence?: boolean;
}

export interface DocumentPersistenceCoordinatorDependencies {
  documentEngine?: DocumentEngine;
  workspaceEngine?: WorkspaceEngine;
  metadataRepo?: IDocumentMetadataRepository;
  editorCoordination?: EditorCoordinationService;
  config?: DocumentPersistenceConfig;
}

function toPersistedLineEnding(le?: string): 'lf' | 'crlf' | 'cr' | undefined {
  if (le === 'lf' || le === 'crlf' || le === 'cr') return le;
  return undefined;
}

export class DocumentPersistenceCoordinator {
  private static instance: DocumentPersistenceCoordinator;

  private documentEngine?: DocumentEngine;
  private workspaceEngine?: WorkspaceEngine;
  private metadataRepo?: IDocumentMetadataRepository;
  private editorCoordination?: EditorCoordinationService;

  private config: Required<DocumentPersistenceConfig>;
  private isDisposed: boolean = false;
  private unregisterListeners: Array<() => void> = [];

  constructor(deps: DocumentPersistenceCoordinatorDependencies = {}) {
    this.documentEngine = deps.documentEngine;
    this.workspaceEngine = deps.workspaceEngine;
    this.metadataRepo = deps.metadataRepo;
    this.editorCoordination = deps.editorCoordination;

    this.config = {
      autoPersistMetadata: deps.config?.autoPersistMetadata ?? true,
      maxRecentDocuments: deps.config?.maxRecentDocuments ?? 20,
      enableAutoLanguagePersistence: deps.config?.enableAutoLanguagePersistence ?? true,
      enableAutoEncodingPersistence: deps.config?.enableAutoEncodingPersistence ?? true,
    };
  }

  // ---------------------------------------------------------------------------
  // Lazy Dependency Getters
  // ---------------------------------------------------------------------------

  private getDocEngine(): DocumentEngine {
    return this.documentEngine || globalDocumentEngine;
  }

  private getWorkspaceEngine(): WorkspaceEngine {
    return this.workspaceEngine || globalWorkspaceEngine;
  }

  private getMetadataRepo(): IDocumentMetadataRepository {
    return this.metadataRepo || globalDocumentMetadataRepository;
  }

  private getEditorCoordination(): EditorCoordinationService {
    return this.editorCoordination || globalEditorCoordinationService;
  }

  public static getInstance(
    deps?: DocumentPersistenceCoordinatorDependencies
  ): DocumentPersistenceCoordinator {
    if (!DocumentPersistenceCoordinator.instance) {
      DocumentPersistenceCoordinator.instance = new DocumentPersistenceCoordinator(deps);
    }
    return DocumentPersistenceCoordinator.instance;
  }

  // ---------------------------------------------------------------------------
  // 1. Initialization & Event Wiring
  // ---------------------------------------------------------------------------

  public initialize(): void {
    if (this.unregisterListeners.length > 0) return;
    const docEngine = this.getDocEngine();

    // 1. On Document Opened
    const unsubOpened = docEngine.on('document.opened', async (payload) => {
      try {
        await this.handleDocumentOpened(payload.documentId, payload.resourceUri, payload.workspaceId);
      } catch (err) {
        logger.warn('DocumentPersistence: error handling document.opened', err);
      }
    });
    this.unregisterListeners.push(unsubOpened);

    // 2. On Document Saved
    const unsubSaved = docEngine.on('document.saved', async (payload) => {
      try {
        await this.handleDocumentSaved(payload.documentId, payload.resourceUri, payload.workspaceId, payload.timestamp);
      } catch (err) {
        logger.warn('DocumentPersistence: error handling document.saved', err);
      }
    });
    this.unregisterListeners.push(unsubSaved);

    // 3. On Document Save Failed
    const unsubSaveFailed = docEngine.on('document.saveFailed', (payload) => {
      // DO NOT update lastSavedAt or falsely report success
      logger.warn('DocumentPersistence: save failed on disk, metadata save suppressed.', {
        documentId: payload.documentId,
        uri: payload.resourceUri,
        error: payload.error,
      });
    });
    this.unregisterListeners.push(unsubSaveFailed);

    // 4. On Document Resource Changed (Save As / Rename)
    const unsubResourceChanged = docEngine.on('document.resourceChanged', async (payload) => {
      try {
        await this.handleResourceChanged(
          payload.documentId,
          payload.oldResourceUri,
          payload.newResourceUri,
          payload.newTitle,
          payload.workspaceId
        );
      } catch (err) {
        logger.warn('DocumentPersistence: error handling document.resourceChanged', err);
      }
    });
    this.unregisterListeners.push(unsubResourceChanged);

    // 5. On Document External Changed (disk modify, delete, rename)
    const unsubExternalChanged = docEngine.on('document.externalChanged', async (payload) => {
      try {
        await this.handleExternalChanged(payload.documentId, payload.resourceUri, payload.type, payload.workspaceId);
      } catch (err) {
        logger.warn('DocumentPersistence: error handling document.externalChanged', err);
      }
    });
    this.unregisterListeners.push(unsubExternalChanged);

    // 6. On Language Changed (manual override)
    const unsubLangChanged = docEngine.on('document.languageChanged', async (payload) => {
      try {
        await this.handleLanguageChanged(payload.documentId, payload.resourceUri, payload.languageId, payload.isManual, payload.workspaceId);
      } catch (err) {
        logger.warn('DocumentPersistence: error handling document.languageChanged', err);
      }
    });
    this.unregisterListeners.push(unsubLangChanged);

    // 7. On Encoding Changed
    const unsubEncChanged = docEngine.on('document.encodingChanged', async (payload) => {
      try {
        await this.handleEncodingChanged(payload.documentId, payload.resourceUri, payload.encoding, payload.isManual, payload.workspaceId);
      } catch (err) {
        logger.warn('DocumentPersistence: error handling document.encodingChanged', err);
      }
    });
    this.unregisterListeners.push(unsubEncChanged);

    // 8. On Read-Only Changed
    const unsubReadOnlyChanged = docEngine.on('document.readOnlyChanged', async (payload) => {
      try {
        await this.handleReadOnlyChanged(payload.documentId, payload.resourceUri, payload.isReadOnly, payload.reason, payload.workspaceId);
      } catch (err) {
        logger.warn('DocumentPersistence: error handling document.readOnlyChanged', err);
      }
    });
    this.unregisterListeners.push(unsubReadOnlyChanged);

    // 9. On Document Closing
    const unsubClosing = docEngine.on('document.closing', async (payload) => {
      try {
        await this.handleDocumentClosing(payload.documentId, payload.resourceUri, payload.workspaceId);
      } catch (err) {
        logger.warn('DocumentPersistence: error handling document.closing', err);
      }
    });
    this.unregisterListeners.push(unsubClosing);

    logger.info('DocumentPersistenceCoordinator initialized successfully.');
  }

  // ---------------------------------------------------------------------------
  // 2. Lifecycle Handlers
  // ---------------------------------------------------------------------------

  private async handleDocumentOpened(
    _documentId: string,
    rawUri: string,
    explicitWorkspaceId?: string
  ): Promise<void> {
    if (this.isDisposed || !this.config.autoPersistMetadata) return;
    if (rawUri.startsWith('untitled:')) return; // Untitled buffers are non-persistent

    const workspaceId = explicitWorkspaceId || this.getWorkspaceEngine().getWorkspaceId() || 'global';
    const normUri = normalizeResourceUri(rawUri);

    const doc = this.getDocEngine().getByResource(normUri);
    if (!doc) return;

    const repo = this.getMetadataRepo();

    // 1. Look up existing persisted metadata
    const existingMeta = await repo.getDocumentMetadata(workspaceId, normUri);
    if (existingMeta) {
      // Apply manual language override if previously chosen by user
      if (existingMeta.isManualLanguage && existingMeta.languageId && existingMeta.languageId !== doc.languageId) {
        doc.languageId = existingMeta.languageId;
        doc.metadata = {
          ...doc.metadata,
          languageId: existingMeta.languageId,
        };
      }

      // Apply manual encoding override
      if (existingMeta.isManualEncoding && existingMeta.encoding && existingMeta.encoding !== doc.metadata.encoding) {
        doc.metadata = {
          ...doc.metadata,
          encoding: existingMeta.encoding,
        };
      }
    }

    // 2. Prepare durable metadata DTO
    const metadataDTO: DocumentMetadataDTO = {
      version: 1,
      resourceUri: normUri,
      workspaceId,
      languageId: doc.languageId,
      isManualLanguage: existingMeta?.isManualLanguage ?? false,
      encoding: doc.metadata.encoding || 'utf-8',
      isManualEncoding: existingMeta?.isManualEncoding ?? false,
      lineEnding: toPersistedLineEnding(doc.metadata.lineEnding) || 'lf',
      isReadOnly: doc.metadata.isReadOnly,
      readOnlyReason: doc.metadata.readOnlyReason,
      lastKnownSize: doc.metadata.fileSize,
      lastKnownModifiedTime: doc.metadata.modifiedTime,
      lastOpenedAt: Date.now(),
      lastSavedAt: existingMeta?.lastSavedAt,
      cursorPosition: existingMeta?.cursorPosition,
    };

    await repo.saveDocumentMetadata(workspaceId, normUri, metadataDTO);

    // 3. Save durable resource state
    const resourceStateDTO: ResourceStateDTO = {
      version: 1,
      resourceUri: normUri,
      workspaceId,
      basename: doc.resource.name,
      scheme: (doc.resource.scheme as any) || 'file',
      exists: doc.resource.exists,
      lastKnownModifiedTime: doc.metadata.modifiedTime,
      lastKnownSize: doc.metadata.fileSize,
      lastCheckedAt: Date.now(),
    };
    await repo.saveResourceState(workspaceId, normUri, resourceStateDTO);

    // 4. Record recent document history
    const recentEntry: RecentDocumentDTO = {
      path: normUri,
      name: doc.resource.name,
      lastOpened: Date.now(),
      workspaceId,
    };
    await repo.recordRecentDocument(workspaceId, recentEntry, this.config.maxRecentDocuments);
  }

  private async handleDocumentSaved(
    _documentId: string,
    rawUri: string,
    explicitWorkspaceId: string | undefined,
    timestamp: number
  ): Promise<void> {
    if (this.isDisposed || !this.config.autoPersistMetadata) return;
    if (rawUri.startsWith('untitled:')) return;

    const workspaceId = explicitWorkspaceId || this.getWorkspaceEngine().getWorkspaceId() || 'global';
    const normUri = normalizeResourceUri(rawUri);
    const doc = this.getDocEngine().getByResource(normUri);
    if (!doc) return;

    const repo = this.getMetadataRepo();
    const existing = await repo.getDocumentMetadata(workspaceId, normUri);

    const updatedMeta: DocumentMetadataDTO = {
      version: 1,
      resourceUri: normUri,
      workspaceId,
      languageId: doc.languageId,
      isManualLanguage: existing?.isManualLanguage ?? false,
      encoding: doc.metadata.encoding || 'utf-8',
      isManualEncoding: existing?.isManualEncoding ?? false,
      lineEnding: toPersistedLineEnding(doc.metadata.lineEnding) || 'lf',
      isReadOnly: doc.metadata.isReadOnly,
      readOnlyReason: doc.metadata.readOnlyReason,
      lastKnownSize: doc.metadata.fileSize,
      lastKnownModifiedTime: doc.metadata.modifiedTime,
      lastOpenedAt: existing?.lastOpenedAt || Date.now(),
      lastSavedAt: timestamp,
      cursorPosition: existing?.cursorPosition,
    };

    await repo.saveDocumentMetadata(workspaceId, normUri, updatedMeta);

    // Update resource state
    const resourceState: ResourceStateDTO = {
      version: 1,
      resourceUri: normUri,
      workspaceId,
      basename: doc.resource.name,
      scheme: (doc.resource.scheme as any) || 'file',
      exists: true,
      lastKnownModifiedTime: doc.metadata.modifiedTime,
      lastKnownSize: doc.metadata.fileSize,
      lastCheckedAt: Date.now(),
    };
    await repo.saveResourceState(workspaceId, normUri, resourceState);
  }

  private async handleResourceChanged(
    _documentId: string,
    oldRawUri: string,
    newRawUri: string,
    newTitle: string,
    explicitWorkspaceId?: string
  ): Promise<void> {
    if (this.isDisposed) return;
    const workspaceId = explicitWorkspaceId || this.getWorkspaceEngine().getWorkspaceId() || 'global';
    const oldNorm = normalizeResourceUri(oldRawUri);
    const newNorm = normalizeResourceUri(newRawUri);

    const repo = this.getMetadataRepo();

    // 1. Migrate Document Metadata from old to new URI
    const existing = await repo.getDocumentMetadata(workspaceId, oldNorm);
    const doc = this.getDocEngine().getByResource(newNorm);

    const migratedMeta: DocumentMetadataDTO = {
      version: 1,
      resourceUri: newNorm,
      workspaceId,
      languageId: doc?.languageId || existing?.languageId || 'plaintext',
      isManualLanguage: existing?.isManualLanguage ?? false,
      encoding: doc?.metadata.encoding || existing?.encoding || 'utf-8',
      isManualEncoding: existing?.isManualEncoding ?? false,
      lineEnding: toPersistedLineEnding(doc?.metadata.lineEnding) || toPersistedLineEnding(existing?.lineEnding) || 'lf',
      isReadOnly: doc?.metadata.isReadOnly ?? existing?.isReadOnly,
      readOnlyReason: doc?.metadata.readOnlyReason ?? existing?.readOnlyReason,
      lastKnownSize: doc?.metadata.fileSize ?? existing?.lastKnownSize,
      lastKnownModifiedTime: doc?.metadata.modifiedTime ?? existing?.lastKnownModifiedTime,
      lastOpenedAt: Date.now(),
      lastSavedAt: doc?.lastSavedTimestamp || existing?.lastSavedAt,
      cursorPosition: existing?.cursorPosition,
    };

    await repo.saveDocumentMetadata(workspaceId, newNorm, migratedMeta);

    // 2. Remove old metadata to prevent orphaned duplicates (only if old wasn't an untitled buffer)
    if (!oldNorm.startsWith('untitled:')) {
      await repo.deleteDocumentMetadata(workspaceId, oldNorm);
      await repo.deleteResourceState(workspaceId, oldNorm);
      await repo.removeRecentDocument(oldNorm, workspaceId);
    }

    // 3. Save new Resource State
    if (doc) {
      const resState: ResourceStateDTO = {
        version: 1,
        resourceUri: newNorm,
        workspaceId,
        basename: newTitle,
        scheme: (doc.resource.scheme as any) || 'file',
        exists: doc.resource.exists,
        lastKnownModifiedTime: doc.metadata.modifiedTime,
        lastKnownSize: doc.metadata.fileSize,
        lastCheckedAt: Date.now(),
      };
      await repo.saveResourceState(workspaceId, newNorm, resState);
    }

    // 4. Update Recent Documents
    await repo.recordRecentDocument(workspaceId, {
      path: newNorm,
      name: newTitle,
      lastOpened: Date.now(),
      workspaceId,
    }, this.config.maxRecentDocuments);
  }

  private async handleExternalChanged(
    _documentId: string,
    rawUri: string,
    type: 'modify' | 'delete' | 'rename',
    explicitWorkspaceId?: string
  ): Promise<void> {
    if (this.isDisposed) return;
    const workspaceId = explicitWorkspaceId || this.getWorkspaceEngine().getWorkspaceId() || 'global';
    const normUri = normalizeResourceUri(rawUri);
    const repo = this.getMetadataRepo();

    if (type === 'delete') {
      const existingRes = await repo.getResourceState(workspaceId, normUri);
      if (existingRes) {
        await repo.saveResourceState(workspaceId, normUri, {
          ...existingRes,
          exists: false,
          lastCheckedAt: Date.now(),
        });
      }
    } else if (type === 'modify') {
      const doc = this.getDocEngine().getByResource(normUri);
      if (doc) {
        const existingMeta = await repo.getDocumentMetadata(workspaceId, normUri);
        if (existingMeta) {
          await repo.saveDocumentMetadata(workspaceId, normUri, {
            ...existingMeta,
            lastKnownSize: doc.metadata.fileSize,
            lastKnownModifiedTime: doc.metadata.modifiedTime,
          });
        }
      }
    }
  }

  private async handleLanguageChanged(
    _documentId: string,
    rawUri: string,
    languageId: string,
    isManual: boolean,
    explicitWorkspaceId?: string
  ): Promise<void> {
    if (this.isDisposed || !this.config.autoPersistMetadata) return;
    if (rawUri.startsWith('untitled:')) return;

    const workspaceId = explicitWorkspaceId || this.getWorkspaceEngine().getWorkspaceId() || 'global';
    const normUri = normalizeResourceUri(rawUri);
    const repo = this.getMetadataRepo();

    const existing = await repo.getDocumentMetadata(workspaceId, normUri);
    if (existing) {
      await repo.saveDocumentMetadata(workspaceId, normUri, {
        ...existing,
        languageId,
        isManualLanguage: isManual,
      });
    }
  }

  private async handleEncodingChanged(
    _documentId: string,
    rawUri: string,
    encoding: string,
    isManual: boolean,
    explicitWorkspaceId?: string
  ): Promise<void> {
    if (this.isDisposed || !this.config.autoPersistMetadata) return;
    if (rawUri.startsWith('untitled:')) return;

    const workspaceId = explicitWorkspaceId || this.getWorkspaceEngine().getWorkspaceId() || 'global';
    const normUri = normalizeResourceUri(rawUri);
    const repo = this.getMetadataRepo();

    const existing = await repo.getDocumentMetadata(workspaceId, normUri);
    if (existing) {
      await repo.saveDocumentMetadata(workspaceId, normUri, {
        ...existing,
        encoding,
        isManualEncoding: isManual,
      });
    }
  }

  private async handleReadOnlyChanged(
    _documentId: string,
    rawUri: string,
    isReadOnly: boolean,
    reason?: string,
    explicitWorkspaceId?: string
  ): Promise<void> {
    if (this.isDisposed || !this.config.autoPersistMetadata) return;
    if (rawUri.startsWith('untitled:')) return;

    const workspaceId = explicitWorkspaceId || this.getWorkspaceEngine().getWorkspaceId() || 'global';
    const normUri = normalizeResourceUri(rawUri);
    const repo = this.getMetadataRepo();

    const existing = await repo.getDocumentMetadata(workspaceId, normUri);
    if (existing) {
      await repo.saveDocumentMetadata(workspaceId, normUri, {
        ...existing,
        isReadOnly,
        readOnlyReason: reason,
      });
    }
  }

  private async handleDocumentClosing(
    documentId: string,
    rawUri: string,
    explicitWorkspaceId?: string
  ): Promise<void> {
    if (this.isDisposed || !this.config.autoPersistMetadata) return;
    if (rawUri.startsWith('untitled:')) return;

    const workspaceId = explicitWorkspaceId || this.getWorkspaceEngine().getWorkspaceId() || 'global';
    const normUri = normalizeResourceUri(rawUri);
    const doc = this.getDocEngine().getByResource(normUri);
    if (!doc) return;

    const repo = this.getMetadataRepo();
    const existing = await repo.getDocumentMetadata(workspaceId, normUri);

    // Capture cursor if active
    const activeDoc = this.getDocEngine().getActiveDocument();
    let cursorPos = existing?.cursorPosition;
    if (activeDoc && activeDoc.id === documentId) {
      const pos = this.getEditorCoordination().getCursorPosition();
      if (pos) {
        cursorPos = { line: pos.line, column: pos.column };
      }
    }

    const finalMeta: DocumentMetadataDTO = {
      version: 1,
      resourceUri: normUri,
      workspaceId,
      languageId: doc.languageId,
      isManualLanguage: existing?.isManualLanguage ?? false,
      encoding: doc.metadata.encoding || 'utf-8',
      isManualEncoding: existing?.isManualEncoding ?? false,
      lineEnding: toPersistedLineEnding(doc.metadata.lineEnding) || 'lf',
      isReadOnly: doc.metadata.isReadOnly,
      readOnlyReason: doc.metadata.readOnlyReason,
      lastKnownSize: doc.metadata.fileSize,
      lastKnownModifiedTime: doc.metadata.modifiedTime,
      lastOpenedAt: existing?.lastOpenedAt || Date.now(),
      lastSavedAt: existing?.lastSavedAt,
      cursorPosition: cursorPos,
    };

    await repo.saveDocumentMetadata(workspaceId, normUri, finalMeta);
  }

  // ---------------------------------------------------------------------------
  // 3. Public Query & Retrieval API
  // ---------------------------------------------------------------------------

  public async getMetadata(workspaceId: string, resourceUri: string): Promise<DocumentMetadataDTO | null> {
    const normUri = normalizeResourceUri(resourceUri);
    return this.getMetadataRepo().getDocumentMetadata(workspaceId, normUri);
  }

  public async getResourceState(workspaceId: string, resourceUri: string): Promise<ResourceStateDTO | null> {
    const normUri = normalizeResourceUri(resourceUri);
    return this.getMetadataRepo().getResourceState(workspaceId, normUri);
  }

  public async getRecentDocuments(workspaceId?: string): Promise<RecentDocumentDTO[]> {
    return this.getMetadataRepo().getRecentDocuments(workspaceId);
  }

  public async deleteMetadata(workspaceId: string, resourceUri: string): Promise<boolean> {
    const normUri = normalizeResourceUri(resourceUri);
    return this.getMetadataRepo().deleteDocumentMetadata(workspaceId, normUri);
  }

  public async clearWorkspace(workspaceId: string): Promise<void> {
    return this.getMetadataRepo().clearWorkspaceDocuments(workspaceId);
  }

  // ---------------------------------------------------------------------------
  // 4. Lifecycle & Disposal
  // ---------------------------------------------------------------------------

  public dispose(): void {
    this.isDisposed = true;
    for (const unsub of this.unregisterListeners) {
      unsub();
    }
    this.unregisterListeners = [];
    logger.info('DocumentPersistenceCoordinator disposed.');
  }

  public reset(): void {
    this.isDisposed = false;
  }
}

export const globalDocumentPersistenceCoordinator = DocumentPersistenceCoordinator.getInstance();
