/**
 * QM Editor Workspace Index Coordinator
 * Phase 05, Step 51 — Persistent Workspace Indexes, Search Cache & Derived Data Storage
 */

import { WorkspaceEngine, globalWorkspaceEngine } from '../workspace';
import { WorkspaceIndexService, workspaceIndexService, QuickOpenResource } from '../../services/WorkspaceIndexService';
import { IResourceIndexRepository, ResourceIndexRepository } from '../storage/repositories/ResourceIndexRepository';
import { FileService, fileService, normalizePath } from '../../services/FileService';
import {
  WorkspaceIndexDTO,
  IndexValidationResult,
  IndexStatus,
  computeResourceFingerprint,
} from './IndexTypes';
import { logger } from '../../utils/logger';

import { ResourceSynchronizationService, globalResourceSynchronizationService } from '../watcher';

export class WorkspaceIndexCoordinator {
  private readonly workspaceEngine: WorkspaceEngine;
  private readonly indexService: WorkspaceIndexService;
  private readonly repository: IResourceIndexRepository;
  private readonly fileService: FileService;
  private readonly syncService?: ResourceSynchronizationService;

  private activeWorkspaceId: string | null = null;
  private activeWorkspaceGeneration: number = 0;
  private currentIndexGeneration: number = 0;
  private persistDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isDisposed: boolean = false;
  private unsubscribers: Array<() => void> = [];

  constructor(
    workspaceEngine: WorkspaceEngine = globalWorkspaceEngine,
    indexService: WorkspaceIndexService = workspaceIndexService,
    repository: IResourceIndexRepository = new ResourceIndexRepository(),
    fileServiceInstance: FileService = fileService,
    syncService: ResourceSynchronizationService = globalResourceSynchronizationService
  ) {
    this.workspaceEngine = workspaceEngine;
    this.indexService = indexService;
    this.repository = repository;
    this.fileService = fileServiceInstance;
    this.syncService = syncService;

    if (this.syncService) {
      this.attachSyncService(this.syncService);
    }
  }

  public attachSyncService(sync: ResourceSynchronizationService): void {
    this.unsubscribers.push(
      sync.on('watcher.externalChangeDetected', (e) => {
        if (e.type === 'create') {
          this.handleResourceCreated(e.uri);
        } else if (e.type === 'delete') {
          this.handleResourceDeleted(e.uri);
        } else if (e.type === 'rename' && e.oldUri) {
          this.handleResourceRenamed(e.oldUri, e.uri);
        } else if (e.type === 'modify') {
          this.handleResourceModified(e.uri);
        }
      }),
      sync.on('synchronization.resourceDeleted', (e) => {
        this.handleResourceDeleted(e.resourceUri);
      }),
      sync.on('synchronization.resourceRenamed', (e) => {
        this.handleResourceRenamed(e.oldResourceUri, e.newResourceUri);
      }),
      sync.on('synchronization.resourceRecreated', (e) => {
        this.handleResourceCreated(e.resourceUri);
      })
    );
  }

  public getActiveWorkspaceId(): string | null {
    return this.activeWorkspaceId;
  }

  public getCurrentIndexGeneration(): number {
    return this.currentIndexGeneration;
  }

  public getStatus(): IndexStatus {
    return this.indexService.getStatus();
  }

  // ---------------------------------------------------------------------------
  // 1. Lifecycle & Startup Restoration
  // ---------------------------------------------------------------------------

  /**
   * Initializes index for a workspace. Loads persistent cache if valid and fresh,
   * otherwise prepares the index for rebuild.
   */
  public async initialize(workspaceId: string, _rootUri: string): Promise<boolean> {
    if (this.isDisposed) return false;

    this.activeWorkspaceId = workspaceId;
    this.activeWorkspaceGeneration = this.workspaceEngine.getGeneration();
    this.indexService.setStatus('loading');

    const expectedGeneration = this.activeWorkspaceGeneration;

    try {
      const persisted = await this.repository.getIndex(workspaceId);

      // Verify workspace has not changed mid-flight
      if (
        this.activeWorkspaceId !== workspaceId ||
        this.activeWorkspaceGeneration !== expectedGeneration
      ) {
        logger.info('WorkspaceIndexCoordinator: workspace switched during index load; discarding', {
          loadedFor: workspaceId,
          active: this.activeWorkspaceId,
        });
        return false;
      }

      if (persisted) {
        const validation = await this.evaluateFreshness(persisted);

        if (validation.isValid && validation.freshness === 'fresh') {
          this.currentIndexGeneration = persisted.indexGeneration;
          this.indexService.loadFromDTO(persisted);
          this.indexService.setStatus('ready');
          logger.info('WorkspaceIndexCoordinator: restored fresh index from storage', {
            workspaceId,
            files: persisted.totalFiles,
            generation: persisted.indexGeneration,
          });
          return true;
        } else if (validation.isValid && validation.freshness === 'partiallyFresh') {
          // Usable candidates immediately; schedule background reconciliation
          this.currentIndexGeneration = persisted.indexGeneration;
          this.indexService.loadFromDTO(persisted);
          this.indexService.setStatus('stale');
          logger.info('WorkspaceIndexCoordinator: restored partially fresh index; background reconcile recommended', {
            workspaceId,
          });
          return true;
        } else {
          logger.warn('WorkspaceIndexCoordinator: persisted index is invalid/stale; marking for rebuild', {
            workspaceId,
            reason: validation.reason,
          });
          this.indexService.clearIndex();
          this.indexService.setStatus('stale');
          return false;
        }
      } else {
        logger.info('WorkspaceIndexCoordinator: no persisted index found for workspace', { workspaceId });
        this.indexService.clearIndex();
        this.indexService.setStatus('uninitialized');
        return false;
      }
    } catch (err) {
      logger.error('WorkspaceIndexCoordinator: failed to initialize index from storage', {
        workspaceId,
        error: (err as Error).message,
      });
      this.indexService.clearIndex();
      this.indexService.setStatus('degraded');
      return false;
    }
  }

  /**
   * Evaluates freshness and validity of an index DTO.
   */
  public async evaluateFreshness(index: WorkspaceIndexDTO): Promise<IndexValidationResult> {
    if (index.version !== 1 || index.formatVersion !== 1) {
      return { isValid: false, freshness: 'invalid', reason: 'Schema or format version mismatch.' };
    }

    if (!Array.isArray(index.entries)) {
      return { isValid: false, freshness: 'invalid', reason: 'Entries payload is corrupted.' };
    }

    if (index.entries.length === 0) {
      return { isValid: true, freshness: 'fresh', reason: 'Empty workspace index.' };
    }

    // Sample-check up to 5 entries against the filesystem
    const sampleSize = Math.min(5, index.entries.length);
    let validSampleCount = 0;

    for (let i = 0; i < sampleSize; i++) {
      const entry = index.entries[i];
      try {
        const exists = await this.fileService.fileExists(entry.uri);
        if (exists) {
          validSampleCount++;
        }
      } catch {
        // file system error on check
      }
    }

    if (validSampleCount === sampleSize) {
      return { isValid: true, freshness: 'fresh' };
    } else if (validSampleCount > 0) {
      return { isValid: true, freshness: 'partiallyFresh', reason: 'Some sampled files moved or deleted.' };
    } else {
      return { isValid: false, freshness: 'stale', reason: 'Sampled files no longer exist on disk.' };
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Incremental Index Mutations (Watcher Integration)
  // ---------------------------------------------------------------------------

  /**
   * Adds or updates a newly created or discovered resource.
   */
  public handleResourceCreated(
    uri: string,
    relativePath?: string,
    name?: string,
    stat?: { size?: number; modifiedAt?: number; isDirectory?: boolean }
  ): void {
    if (this.isDisposed || !this.activeWorkspaceId) return;

    const fileName = name || uri.split('/').pop() || uri;
    const relPath = relativePath || fileName;
    const parentParts = relPath.split('/');
    parentParts.pop();
    const parentPath = parentParts.join('/');
    const isFolder = stat?.isDirectory ?? false;
    const fingerprint = computeResourceFingerprint(stat?.size, stat?.modifiedAt);

    const resource: QuickOpenResource = {
      id: uri,
      uri: uri,
      name: fileName,
      relativePath: relPath,
      parentPath,
      isFolder,
      size: stat?.size,
      modifiedAt: stat?.modifiedAt,
      fingerprint,
    };

    this.indexService.addOrUpdateResource(resource);
    this.schedulePersist();
  }

  /**
   * Removes a resource from the index on deletion.
   */
  public handleResourceDeleted(uri: string): void {
    if (this.isDisposed || !this.activeWorkspaceId) return;
    const removed = this.indexService.removeResource(uri);
    if (removed) {
      this.schedulePersist();
    }
  }

  /**
   * Updates a resource path and name on rename.
   */
  public handleResourceRenamed(oldUri: string, newUri: string): void {
    if (this.isDisposed || !this.activeWorkspaceId) return;
    const updated = this.indexService.renameResource(oldUri, newUri);
    if (updated) {
      this.schedulePersist();
    }
  }

  /**
   * Refreshes metadata & fingerprint when a file is modified.
   */
  public handleResourceModified(
    uri: string,
    stat?: { size?: number; modifiedAt?: number }
  ): void {
    if (this.isDisposed || !this.activeWorkspaceId) return;
    const norm = normalizePath(uri);
    const resources = this.indexService.getResources();
    const existing = resources.find((r) => r.uri === uri || normalizePath(r.uri) === norm);

    if (existing) {
      existing.size = stat?.size ?? existing.size;
      existing.modifiedAt = stat?.modifiedAt ?? existing.modifiedAt;
      existing.fingerprint = computeResourceFingerprint(existing.size, existing.modifiedAt);
      this.indexService.addOrUpdateResource(existing);
      this.schedulePersist();
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Rebuild, Invalidation & Reconciliation
  // ---------------------------------------------------------------------------

  /**
   * Performs a clean full rebuild of the workspace index.
   */
  public async rebuildIndex(workspaceId: string, rootUri: string): Promise<WorkspaceIndexDTO | null> {
    if (this.isDisposed) return null;

    const generation = this.workspaceEngine.getGeneration();
    this.activeWorkspaceId = workspaceId;
    this.activeWorkspaceGeneration = generation;
    this.currentIndexGeneration++;

    this.indexService.setStatus('rebuilding');

    try {
      const dto = this.indexService.toDTO(workspaceId, rootUri, generation);

      // Verify workspace generation did not change during rebuild
      if (
        this.activeWorkspaceId !== workspaceId ||
        this.workspaceEngine.getGeneration() !== generation
      ) {
        logger.info('WorkspaceIndexCoordinator: workspace changed during rebuild; dropping result', {
          rebuiltFor: workspaceId,
          active: this.activeWorkspaceId,
        });
        return null;
      }

      await this.repository.saveIndex(workspaceId, dto);

      if (
        this.activeWorkspaceId !== workspaceId ||
        this.workspaceEngine.getGeneration() !== generation
      ) {
        logger.info('WorkspaceIndexCoordinator: workspace changed after save; dropping result', {
          rebuiltFor: workspaceId,
          active: this.activeWorkspaceId,
        });
        return null;
      }

      this.indexService.setStatus('ready');

      logger.info('WorkspaceIndexCoordinator: index rebuild complete and persisted', {
        workspaceId,
        files: dto.totalFiles,
        generation: dto.indexGeneration,
      });

      return dto;
    } catch (err) {
      logger.error('WorkspaceIndexCoordinator: rebuild failed', {
        workspaceId,
        error: (err as Error).message,
      });
      this.indexService.setStatus('failed');
      return null;
    }
  }

  /**
   * Explicitly clears the workspace index from memory and persistent storage.
   */
  public async clearIndex(workspaceId?: string): Promise<void> {
    const wsId = workspaceId || this.activeWorkspaceId;
    this.indexService.clearIndex();

    if (this.persistDebounceTimer) {
      clearTimeout(this.persistDebounceTimer);
      this.persistDebounceTimer = null;
    }

    if (wsId) {
      try {
        await this.repository.deleteIndex(wsId);
        logger.info('WorkspaceIndexCoordinator: persistent index deleted', { workspaceId: wsId });
      } catch (err) {
        logger.warn('WorkspaceIndexCoordinator: failed to delete persistent index', {
          workspaceId: wsId,
          error: (err as Error).message,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Persistence Scheduling & Write Coalescing
  // ---------------------------------------------------------------------------

  /**
   * Schedules debounced write to storage (coalesces bursts of changes).
   */
  public schedulePersist(delayMs: number = 300): void {
    if (this.isDisposed || !this.activeWorkspaceId) return;

    if (this.persistDebounceTimer) {
      clearTimeout(this.persistDebounceTimer);
    }

    this.persistDebounceTimer = setTimeout(async () => {
      this.persistDebounceTimer = null;
      await this.persist();
    }, delayMs);
  }

  /**
   * Writes the current in-memory index to durable storage immediately.
   */
  public async persist(): Promise<void> {
    if (this.isDisposed || !this.activeWorkspaceId) return;

    const workspaceId = this.activeWorkspaceId;
    const currentGen = this.activeWorkspaceGeneration;
    const primaryRoot = this.workspaceEngine.getPrimaryRoot();
    const rootUri = primaryRoot ? primaryRoot.uri : `workspace://${workspaceId}`;

    const dto = this.indexService.toDTO(workspaceId, rootUri, currentGen);

    try {
      await this.repository.saveIndex(workspaceId, dto);
      logger.info('WorkspaceIndexCoordinator: persistent index written successfully', {
        workspaceId,
        totalFiles: dto.totalFiles,
      });
    } catch (err) {
      logger.error('WorkspaceIndexCoordinator: failed to persist index to storage', {
        workspaceId,
        error: (err as Error).message,
      });
    }
  }

  /**
   * Flushes any pending debounced writes immediately (e.g. before shutdown).
   */
  public async flush(): Promise<void> {
    if (this.persistDebounceTimer) {
      clearTimeout(this.persistDebounceTimer);
      this.persistDebounceTimer = null;
      await this.persist();
    }
  }

  /**
   * Disposes the coordinator and releases resources.
   */
  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    if (this.persistDebounceTimer) {
      clearTimeout(this.persistDebounceTimer);
      this.persistDebounceTimer = null;
    }

    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];

    this.indexService.setStatus('disposed');
    logger.info('WorkspaceIndexCoordinator disposed');
  }

  public resetForTesting(): void {
    this.isDisposed = false;
    this.activeWorkspaceId = null;
    this.activeWorkspaceGeneration = 0;
    this.currentIndexGeneration = 0;
    if (this.persistDebounceTimer) {
      clearTimeout(this.persistDebounceTimer);
      this.persistDebounceTimer = null;
    }
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    this.indexService.resetForTesting();
  }
}

export const globalWorkspaceIndexCoordinator = new WorkspaceIndexCoordinator();

