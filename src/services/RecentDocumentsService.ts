/**
 * QM Editor Recent Documents & Resources Service
 * Phase 03, Step 14 — Quick Open, File Search & Workspace Navigation
 * Phase 05, Step 50 — Persistent Recent Resources, Navigation History & User Activity State
 */

import { RecentDocument } from '../types';
import {
  IRecentResourceRepository,
  globalRecentResourceRepository,
} from '../core/storage/repositories/RecentResourceRepository';
import { RecentResourceDTO } from '../core/storage/StorageTypes';
import { logger } from '../utils/logger';

const RECENT_DOCUMENTS_KEY = 'qm_editor_recent_documents_v1';
const MAX_RECENT_DOCUMENTS = 20;

const memoryStorage: Record<string, string> = {};

const getStorageItem = (key: string): string | null => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      return localStorage.getItem(key);
    }
  } catch {
    // Fallback to memory
  }
  return memoryStorage[key] || null;
};

const setStorageItem = (key: string, value: string): void => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fallback to memory
  }
  memoryStorage[key] = value;
};

export class RecentDocumentsService {
  private static repository: IRecentResourceRepository = globalRecentResourceRepository;
  private static isInitialized: boolean = false;
  private static cache: Map<string, RecentDocument[]> = new Map(); // workspaceId or 'global' -> list
  private static pendingWriteTimer: any = null;
  private static pendingOperations: Set<Promise<any>> = new Set();

  /**
   * Initializes RecentDocumentsService with durable storage repository.
   * Loads persisted recent resources into synchronous in-memory cache,
   * with backward-compatible migration from legacy localStorage.
   */
  public static async initialize(
    repository: IRecentResourceRepository = globalRecentResourceRepository,
    workspaceId?: string
  ): Promise<void> {
    this.repository = repository;

    try {
      // 1. Load global recent resources from durable repository
      const globalDurable = await this.repository.getRecentResources(undefined);
      if (globalDurable && globalDurable.length > 0) {
        this.cache.set('global', this.mapDTOToModel(globalDurable));
      } else {
        // Fallback: check legacy localStorage
        const legacyStored = getStorageItem(RECENT_DOCUMENTS_KEY);
        if (legacyStored) {
          try {
            const legacyParsed = JSON.parse(legacyStored);
            const validated = this.validateRecentDocuments(legacyParsed);
            if (validated.length > 0) {
              logger.info('Migrating legacy recent documents from localStorage to durable repository');
              this.cache.set('global', validated);
              const dtos = this.mapModelToDTO(validated);
              await this.repository.saveRecentResources(dtos, undefined);
            }
          } catch (e) {
            logger.warn('Failed to parse legacy recent documents', e);
          }
        }
      }

      // 2. If workspaceId provided, load workspace-scoped recent resources
      if (workspaceId) {
        const wsDurable = await this.repository.getRecentResources(workspaceId);
        if (wsDurable && wsDurable.length > 0) {
          this.cache.set(workspaceId, this.mapDTOToModel(wsDurable));
        }
      }

      this.isInitialized = true;
      logger.info('RecentDocumentsService initialized with durable repository', {
        globalCount: this.getRecentDocuments().length,
        workspaceId,
      });
    } catch (err) {
      logger.error('Failed to initialize RecentDocumentsService from durable storage', err);
    }
  }

  public static isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Retrieves bounded list of validated recent documents from memory cache.
   * Synchronous for 60fps UI performance in Quick Open and Recent Documents modal.
   */
  public static getRecentDocuments(workspaceId?: string): RecentDocument[] {
    if (workspaceId && this.cache.has(workspaceId)) {
      return [...this.cache.get(workspaceId)!];
    }
    if (this.cache.has('global')) {
      return [...this.cache.get('global')!];
    }

    // Fallback to legacy local storage if not yet initialized in memory
    try {
      const stored = getStorageItem(RECENT_DOCUMENTS_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      const validated = this.validateRecentDocuments(parsed);
      this.cache.set('global', validated);
      return validated;
    } catch (err) {
      logger.warn('Failed to load recent documents from storage; returning empty list.', err);
      return [];
    }
  }

  /**
   * Asynchronous getter querying durable storage directly
   */
  public static async getRecentDocumentsAsync(workspaceId?: string): Promise<RecentDocument[]> {
    try {
      const records = await this.repository.getRecentResources(workspaceId);
      const docs = this.mapDTOToModel(records);
      const targetKey = workspaceId || 'global';
      this.cache.set(targetKey, docs);
      return docs;
    } catch {
      return this.getRecentDocuments(workspaceId);
    }
  }

  /**
   * Adds or updates a recent document access record.
   * Deduplicates by URI and moves it to the top (MRU order).
   */
  public static addRecentDocument(
    uri: string,
    name?: string,
    workspaceId?: string,
    line?: number,
    column?: number
  ): RecentDocument[] {
    if (!uri || uri.trim().length === 0) return this.getRecentDocuments(workspaceId);

    const normalizedUri = uri.trim();
    const docName = name && name.trim().length > 0 ? name.trim() : this.extractFilename(normalizedUri);

    const newItem: RecentDocument = {
      uri: normalizedUri,
      name: docName,
      lastOpened: Date.now(),
      exists: true,
    };

    // 1. Update Global Cache
    const globalCurrent = this.getRecentDocuments(undefined);
    const globalFiltered = globalCurrent.filter((item) => item.uri !== normalizedUri);
    const globalUpdated = [newItem, ...globalFiltered].slice(0, MAX_RECENT_DOCUMENTS);
    this.cache.set('global', globalUpdated);

    // 2. Update Workspace Cache if applicable
    let wsUpdated = globalUpdated;
    if (workspaceId) {
      const wsCurrent = this.getRecentDocuments(workspaceId);
      const wsFiltered = wsCurrent.filter((item) => item.uri !== normalizedUri);
      wsUpdated = [newItem, ...wsFiltered].slice(0, MAX_RECENT_DOCUMENTS);
      this.cache.set(workspaceId, wsUpdated);
    }

    // 3. Persist to legacy localStorage
    try {
      setStorageItem(RECENT_DOCUMENTS_KEY, JSON.stringify(globalUpdated));
    } catch (err) {
      logger.warn('Failed to save recent documents to localStorage.', err);
    }

    // 4. Queue durable write to repository if initialized
    if (this.isInitialized) {
      this.queueDurableWrite({
        resourceUri: normalizedUri,
        name: docName,
        lastAccessedAt: newItem.lastOpened,
        kind: 'file',
        workspaceId,
        line,
        column,
      });
    }

    return workspaceId ? wsUpdated : globalUpdated;
  }

  /**
   * Asynchronous variant awaiting confirmed storage persistence
   */
  public static async addRecentDocumentAsync(
    uri: string,
    name?: string,
    workspaceId?: string,
    line?: number,
    column?: number
  ): Promise<RecentDocument[]> {
    const updated = this.addRecentDocument(uri, name, workspaceId, line, column);

    if (this.isInitialized) {
      try {
        const dto: RecentResourceDTO = {
          resourceUri: uri.trim(),
          name: name && name.trim().length > 0 ? name.trim() : this.extractFilename(uri.trim()),
          lastAccessedAt: Date.now(),
          kind: 'file',
          workspaceId,
          line,
          column,
        };
        await this.repository.recordAccess(dto, workspaceId, MAX_RECENT_DOCUMENTS);
      } catch (err) {
        logger.error('Failed to persist recent document asynchronously to repository', err);
      }
    }

    return updated;
  }

  /**
   * Removes a document from recent history
   */
  public static removeRecentDocument(uri: string, workspaceId?: string): RecentDocument[] {
    if (!uri) return this.getRecentDocuments(workspaceId);
    const normalizedUri = uri.trim();

    const globalCurrent = this.getRecentDocuments(undefined);
    const globalUpdated = globalCurrent.filter((item) => item.uri !== normalizedUri);
    this.cache.set('global', globalUpdated);

    try {
      setStorageItem(RECENT_DOCUMENTS_KEY, JSON.stringify(globalUpdated));
    } catch (err) {
      logger.warn('Failed to update recent documents after removal.', err);
    }

    let wsUpdated = globalUpdated;
    if (workspaceId) {
      const wsCurrent = this.getRecentDocuments(workspaceId);
      wsUpdated = wsCurrent.filter((item) => item.uri !== normalizedUri);
      this.cache.set(workspaceId, wsUpdated);
    }

    if (this.isInitialized) {
      const op = this.repository.removeRecentResource(normalizedUri, workspaceId).catch((err) => {
        logger.error('Failed to remove recent resource from repository', err);
      });
      this.trackOperation(op);
    }

    return workspaceId ? wsUpdated : globalUpdated;
  }

  /**
   * Updates resource URI on file rename
   */
  public static updateResourceUri(
    oldUri: string,
    newUri: string,
    workspaceId?: string
  ): RecentDocument[] {
    if (!oldUri || !newUri) return this.getRecentDocuments(workspaceId);
    const newName = this.extractFilename(newUri);

    const updateItem = (item: RecentDocument): RecentDocument => {
      if (item.uri === oldUri) {
        return {
          ...item,
          uri: newUri,
          name: newName,
          lastOpened: Date.now(),
        };
      }
      return item;
    };

    const globalCurrent = this.getRecentDocuments(undefined);
    const globalUpdated = globalCurrent.map(updateItem);
    this.cache.set('global', globalUpdated);

    try {
      setStorageItem(RECENT_DOCUMENTS_KEY, JSON.stringify(globalUpdated));
    } catch {
      // non-fatal
    }

    let wsUpdated = globalUpdated;
    if (workspaceId) {
      const wsCurrent = this.getRecentDocuments(workspaceId);
      wsUpdated = wsCurrent.map(updateItem);
      this.cache.set(workspaceId, wsUpdated);
    }

    if (this.isInitialized) {
      const op = (async () => {
        await this.repository.removeRecentResource(oldUri, workspaceId);
        await this.repository.recordAccess(
          {
            resourceUri: newUri,
            name: newName,
            lastAccessedAt: Date.now(),
            kind: 'file',
            workspaceId,
          },
          workspaceId,
          MAX_RECENT_DOCUMENTS
        );
      })().catch((err) => {
        logger.error('Failed to update renamed recent resource in repository', err);
      });
      this.trackOperation(op);
    }

    return workspaceId ? wsUpdated : globalUpdated;
  }

  /**
   * Clears recent document history
   */
  public static clearRecentDocuments(workspaceId?: string): void {
    if (workspaceId) {
      this.cache.delete(workspaceId);
    } else {
      this.cache.clear();
    }

    try {
      setStorageItem(RECENT_DOCUMENTS_KEY, JSON.stringify([]));
    } catch (err) {
      logger.warn('Failed to clear recent documents list.', err);
    }

    if (this.isInitialized) {
      const op = this.repository.clearRecentResources(workspaceId).catch((err) => {
        logger.error('Failed to clear recent resources in repository', err);
      });
      this.trackOperation(op);
    }
  }

  public static async flush(): Promise<void> {
    if (this.pendingWriteTimer) {
      clearTimeout(this.pendingWriteTimer);
      this.pendingWriteTimer = null;
    }
    await Promise.allSettled(Array.from(this.pendingOperations));
  }

  public static resetForTesting(): void {
    if (this.pendingWriteTimer) {
      clearTimeout(this.pendingWriteTimer);
      this.pendingWriteTimer = null;
    }
    this.pendingOperations.clear();
    this.cache.clear();
    this.isInitialized = false;
    this.repository = globalRecentResourceRepository;
    setStorageItem(RECENT_DOCUMENTS_KEY, JSON.stringify([]));
  }

  public static validateRecentDocuments(data: unknown): RecentDocument[] {
    if (!Array.isArray(data)) return [];

    const valid: RecentDocument[] = [];
    for (const item of data) {
      if (
        item &&
        typeof item === 'object' &&
        typeof item.uri === 'string' &&
        item.uri.trim().length > 0
      ) {
        valid.push({
          uri: item.uri.trim(),
          name:
            typeof item.name === 'string' && item.name.trim().length > 0
              ? item.name.trim()
              : this.extractFilename(item.uri.trim()),
          lastOpened:
            typeof item.lastOpened === 'number' && item.lastOpened > 0
              ? item.lastOpened
              : Date.now(),
          exists: true,
        });
      }
    }

    return valid.slice(0, MAX_RECENT_DOCUMENTS);
  }

  private static extractFilename(uri: string): string {
    const parts = uri.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || uri;
  }

  private static mapDTOToModel(dtos: RecentResourceDTO[]): RecentDocument[] {
    return dtos.map((dto) => ({
      uri: dto.resourceUri,
      name: dto.name,
      lastOpened: dto.lastAccessedAt,
      exists: true,
    }));
  }

  private static mapModelToDTO(models: RecentDocument[], workspaceId?: string): RecentResourceDTO[] {
    return models.map((m) => ({
      resourceUri: m.uri,
      name: m.name,
      lastAccessedAt: m.lastOpened,
      kind: 'file',
      workspaceId,
    }));
  }

  private static queueDurableWrite(dto: RecentResourceDTO): void {
    if (this.pendingWriteTimer) {
      clearTimeout(this.pendingWriteTimer);
    }
    this.pendingWriteTimer = setTimeout(() => {
      this.pendingWriteTimer = null;
      const op = this.repository
        .recordAccess(dto, dto.workspaceId, MAX_RECENT_DOCUMENTS)
        .catch((err) => {
          logger.error('Failed to record recent resource access to repository', err);
        });
      this.trackOperation(op);
    }, 50);
  }

  private static trackOperation(op: Promise<any>): void {
    this.pendingOperations.add(op);
    op.finally(() => {
      this.pendingOperations.delete(op);
    });
  }
}
