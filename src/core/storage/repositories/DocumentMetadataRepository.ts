/**
 * QM Editor Document Metadata & Resource State Repository
 * Phase 05, Step 48 — Persistent Document Metadata, Resource State & Document Persistence Foundation
 */

import {
  IStorageService,
  DocumentMetadataDTO,
  ResourceStateDTO,
  RecentDocumentDTO,
} from '../StorageTypes';
import { globalStorageService } from '../StorageService';
import { logger } from '../../../utils/logger';

export interface IDocumentMetadataRepository {
  // Document Metadata
  getDocumentMetadata(workspaceId: string, resourceUri: string): Promise<DocumentMetadataDTO | null>;
  saveDocumentMetadata(
    workspaceId: string,
    resourceUri: string,
    metadata: DocumentMetadataDTO,
    expectedRecordVersion?: number
  ): Promise<void>;
  deleteDocumentMetadata(workspaceId: string, resourceUri: string): Promise<boolean>;
  listWorkspaceDocuments(workspaceId: string): Promise<DocumentMetadataDTO[]>;
  clearWorkspaceDocuments(workspaceId: string): Promise<void>;

  // Resource State
  getResourceState(workspaceId: string, resourceUri: string): Promise<ResourceStateDTO | null>;
  saveResourceState(
    workspaceId: string,
    resourceUri: string,
    state: ResourceStateDTO,
    expectedRecordVersion?: number
  ): Promise<void>;
  deleteResourceState(workspaceId: string, resourceUri: string): Promise<boolean>;

  // Recent Documents
  getRecentDocuments(workspaceId?: string): Promise<RecentDocumentDTO[]>;
  recordRecentDocument(
    workspaceId: string,
    doc: RecentDocumentDTO,
    maxRetention?: number
  ): Promise<RecentDocumentDTO[]>;
  removeRecentDocument(resourceUri: string, workspaceId?: string): Promise<RecentDocumentDTO[]>;
  clearRecentDocuments(workspaceId?: string): Promise<void>;
}

export class DocumentMetadataRepository implements IDocumentMetadataRepository {
  private readonly storage: IStorageService;

  public static readonly DOC_SCHEMA_ID = 'qm.document.metadata';
  public static readonly RES_SCHEMA_ID = 'qm.resource.state';
  public static readonly RECENT_SCHEMA_ID = 'qm.navigation.recent';

  private static readonly RECENT_DOCS_KEY = 'recent_documents';

  constructor(storage: IStorageService = globalStorageService) {
    this.storage = storage;
  }

  // ---------------------------------------------------------------------------
  // Key Helpers
  // ---------------------------------------------------------------------------

  private toDocKey(resourceUri: string): string {
    return `doc:${encodeURIComponent(resourceUri)}`;
  }

  private toResKey(resourceUri: string): string {
    return `res:${encodeURIComponent(resourceUri)}`;
  }

  // ---------------------------------------------------------------------------
  // 1. Document Metadata Operations
  // ---------------------------------------------------------------------------

  public async getDocumentMetadata(
    workspaceId: string,
    resourceUri: string
  ): Promise<DocumentMetadataDTO | null> {
    if (!workspaceId || !resourceUri) return null;
    const key = `ws:${workspaceId}:${this.toDocKey(resourceUri)}`;
    const record = await this.storage.read<DocumentMetadataDTO>(key, DocumentMetadataRepository.DOC_SCHEMA_ID);
    return record ? record.payload : null;
  }

  public async saveDocumentMetadata(
    workspaceId: string,
    resourceUri: string,
    metadata: DocumentMetadataDTO,
    expectedRecordVersion?: number
  ): Promise<void> {
    if (!workspaceId || !resourceUri) return;
    const rawKey = this.toDocKey(resourceUri);
    await this.storage.write<DocumentMetadataDTO>(
      rawKey,
      DocumentMetadataRepository.DOC_SCHEMA_ID,
      metadata,
      'workspace',
      workspaceId,
      { expectedRecordVersion }
    );
  }

  public async deleteDocumentMetadata(workspaceId: string, resourceUri: string): Promise<boolean> {
    if (!workspaceId || !resourceUri) return false;
    const key = `ws:${workspaceId}:${this.toDocKey(resourceUri)}`;
    return this.storage.delete(key);
  }

  public async listWorkspaceDocuments(workspaceId: string): Promise<DocumentMetadataDTO[]> {
    if (!workspaceId) return [];
    const prefix = `ws:${workspaceId}:doc:`;
    const keys = await this.storage.listKeys(prefix);
    const results: DocumentMetadataDTO[] = [];

    for (const key of keys) {
      try {
        const record = await this.storage.read<DocumentMetadataDTO>(key, DocumentMetadataRepository.DOC_SCHEMA_ID);
        if (record && record.payload) {
          results.push(record.payload);
        }
      } catch (err) {
        logger.warn(`Failed reading document metadata at "${key}"; skipped.`, err);
      }
    }

    return results;
  }

  public async clearWorkspaceDocuments(workspaceId: string): Promise<void> {
    if (!workspaceId) return;
    const docPrefix = `ws:${workspaceId}:doc:`;
    const resPrefix = `ws:${workspaceId}:res:`;
    const docKeys = await this.storage.listKeys(docPrefix);
    const resKeys = await this.storage.listKeys(resPrefix);

    for (const k of [...docKeys, ...resKeys]) {
      await this.storage.delete(k);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Resource State Operations
  // ---------------------------------------------------------------------------

  public async getResourceState(
    workspaceId: string,
    resourceUri: string
  ): Promise<ResourceStateDTO | null> {
    if (!workspaceId || !resourceUri) return null;
    const key = `ws:${workspaceId}:${this.toResKey(resourceUri)}`;
    const record = await this.storage.read<ResourceStateDTO>(key, DocumentMetadataRepository.RES_SCHEMA_ID);
    return record ? record.payload : null;
  }

  public async saveResourceState(
    workspaceId: string,
    resourceUri: string,
    state: ResourceStateDTO,
    expectedRecordVersion?: number
  ): Promise<void> {
    if (!workspaceId || !resourceUri) return;
    const rawKey = this.toResKey(resourceUri);
    await this.storage.write<ResourceStateDTO>(
      rawKey,
      DocumentMetadataRepository.RES_SCHEMA_ID,
      state,
      'workspace',
      workspaceId,
      { expectedRecordVersion }
    );
  }

  public async deleteResourceState(workspaceId: string, resourceUri: string): Promise<boolean> {
    if (!workspaceId || !resourceUri) return false;
    const key = `ws:${workspaceId}:${this.toResKey(resourceUri)}`;
    return this.storage.delete(key);
  }

  // ---------------------------------------------------------------------------
  // 3. Recent Documents Operations
  // ---------------------------------------------------------------------------

  public async getRecentDocuments(workspaceId?: string): Promise<RecentDocumentDTO[]> {
    const key = workspaceId
      ? `ws:${workspaceId}:${DocumentMetadataRepository.RECENT_DOCS_KEY}`
      : `app:${DocumentMetadataRepository.RECENT_DOCS_KEY}`;

    const record = await this.storage.read<RecentDocumentDTO[]>(key, DocumentMetadataRepository.RECENT_SCHEMA_ID);
    return record ? record.payload : [];
  }

  public async recordRecentDocument(
    workspaceId: string,
    doc: RecentDocumentDTO,
    maxRetention: number = 20
  ): Promise<RecentDocumentDTO[]> {
    if (!doc || !doc.path) {
      return this.getRecentDocuments(workspaceId);
    }

    const current = await this.getRecentDocuments(workspaceId);
    // Deduplicate by path
    const filtered = current.filter((d) => d.path !== doc.path);
    const updated = [doc, ...filtered].slice(0, maxRetention);

    // Save workspace-scoped recent documents
    await this.storage.write<RecentDocumentDTO[]>(
      DocumentMetadataRepository.RECENT_DOCS_KEY,
      DocumentMetadataRepository.RECENT_SCHEMA_ID,
      updated,
      'workspace',
      workspaceId
    );

    // Also update global application recent documents
    const globalCurrent = await this.getRecentDocuments(undefined);
    const globalFiltered = globalCurrent.filter((d) => d.path !== doc.path);
    const globalUpdated = [doc, ...globalFiltered].slice(0, maxRetention);

    await this.storage.write<RecentDocumentDTO[]>(
      DocumentMetadataRepository.RECENT_DOCS_KEY,
      DocumentMetadataRepository.RECENT_SCHEMA_ID,
      globalUpdated,
      'application'
    );

    return updated;
  }

  public async removeRecentDocument(
    resourceUri: string,
    workspaceId?: string
  ): Promise<RecentDocumentDTO[]> {
    if (!resourceUri) return this.getRecentDocuments(workspaceId);

    if (workspaceId) {
      const current = await this.getRecentDocuments(workspaceId);
      const updated = current.filter((d) => d.path !== resourceUri);
      await this.storage.write<RecentDocumentDTO[]>(
        DocumentMetadataRepository.RECENT_DOCS_KEY,
        DocumentMetadataRepository.RECENT_SCHEMA_ID,
        updated,
        'workspace',
        workspaceId
      );
    }

    const globalCurrent = await this.getRecentDocuments(undefined);
    const globalUpdated = globalCurrent.filter((d) => d.path !== resourceUri);
    await this.storage.write<RecentDocumentDTO[]>(
      DocumentMetadataRepository.RECENT_DOCS_KEY,
      DocumentMetadataRepository.RECENT_SCHEMA_ID,
      globalUpdated,
      'application'
    );

    return workspaceId ? this.getRecentDocuments(workspaceId) : globalUpdated;
  }

  public async clearRecentDocuments(workspaceId?: string): Promise<void> {
    if (workspaceId) {
      await this.storage.delete(`ws:${workspaceId}:${DocumentMetadataRepository.RECENT_DOCS_KEY}`);
    }
    await this.storage.delete(`app:${DocumentMetadataRepository.RECENT_DOCS_KEY}`);
  }
}

export const globalDocumentMetadataRepository = new DocumentMetadataRepository();
