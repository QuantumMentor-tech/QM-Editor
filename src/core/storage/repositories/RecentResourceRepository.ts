/**
 * QM Editor Recent Resource Repository Contract & Implementation
 * Phase 05, Step 50 — Persistent Recent Resources, Navigation History & User Activity State
 */

import { IStorageService, RecentResourceDTO } from '../StorageTypes';
import { globalStorageService } from '../StorageService';
import { logger } from '../../../utils/logger';

export interface IRecentResourceRepository {
  getRecentResources(workspaceId?: string): Promise<RecentResourceDTO[]>;
  saveRecentResources(
    resources: RecentResourceDTO[],
    workspaceId?: string,
    expectedRecordVersion?: number
  ): Promise<void>;
  recordAccess(
    resource: RecentResourceDTO,
    workspaceId?: string,
    maxRetention?: number
  ): Promise<RecentResourceDTO[]>;
  removeRecentResource(resourceUri: string, workspaceId?: string): Promise<RecentResourceDTO[]>;
  clearRecentResources(workspaceId?: string): Promise<void>;
}

export class RecentResourceRepository implements IRecentResourceRepository {
  private readonly storage: IStorageService;
  private static readonly KEY = 'recent_resources';
  private static readonly SCHEMA_ID = 'qm.navigation.recent';

  constructor(storage: IStorageService = globalStorageService) {
    this.storage = storage;
  }

  public async getRecentResources(workspaceId?: string): Promise<RecentResourceDTO[]> {
    const key = workspaceId
      ? `ws:${workspaceId}:${RecentResourceRepository.KEY}`
      : `app:${RecentResourceRepository.KEY}`;

    try {
      const record = await this.storage.read<RecentResourceDTO[]>(
        key,
        RecentResourceRepository.SCHEMA_ID
      );
      return record ? record.payload : [];
    } catch (err) {
      logger.warn(`Failed to read recent resources for ${key}`, err);
      return [];
    }
  }

  public async saveRecentResources(
    resources: RecentResourceDTO[],
    workspaceId?: string,
    expectedRecordVersion?: number
  ): Promise<void> {
    const scope = workspaceId ? 'workspace' : 'application';

    await this.storage.write<RecentResourceDTO[]>(
      RecentResourceRepository.KEY,
      RecentResourceRepository.SCHEMA_ID,
      resources,
      scope,
      workspaceId,
      { expectedRecordVersion }
    );
  }

  public async recordAccess(
    resource: RecentResourceDTO,
    workspaceId?: string,
    maxRetention: number = 30
  ): Promise<RecentResourceDTO[]> {
    if (!resource || !resource.resourceUri) {
      return this.getRecentResources(workspaceId);
    }

    const current = await this.getRecentResources(workspaceId);
    const existing = current.find((r) => r.resourceUri === resource.resourceUri);
    const accessCount = (existing?.accessCount ?? 0) + 1;

    const updatedEntry: RecentResourceDTO = {
      ...resource,
      lastAccessedAt: Date.now(),
      accessCount,
    };

    const filtered = current.filter((r) => r.resourceUri !== resource.resourceUri);
    const updated = [updatedEntry, ...filtered].slice(0, maxRetention);

    await this.saveRecentResources(updated, workspaceId);

    // If recorded in workspace scope, also update global MRU history
    if (workspaceId) {
      const globalCurrent = await this.getRecentResources(undefined);
      const globalFiltered = globalCurrent.filter((r) => r.resourceUri !== resource.resourceUri);
      const globalUpdated = [updatedEntry, ...globalFiltered].slice(0, maxRetention * 2);
      await this.saveRecentResources(globalUpdated, undefined);
    }

    return updated;
  }

  public async removeRecentResource(
    resourceUri: string,
    workspaceId?: string
  ): Promise<RecentResourceDTO[]> {
    if (!resourceUri) return this.getRecentResources(workspaceId);

    if (workspaceId) {
      const current = await this.getRecentResources(workspaceId);
      const updated = current.filter((r) => r.resourceUri !== resourceUri);
      await this.saveRecentResources(updated, workspaceId);
    }

    const globalCurrent = await this.getRecentResources(undefined);
    const globalUpdated = globalCurrent.filter((r) => r.resourceUri !== resourceUri);
    await this.saveRecentResources(globalUpdated, undefined);

    return workspaceId ? this.getRecentResources(workspaceId) : globalUpdated;
  }

  public async clearRecentResources(workspaceId?: string): Promise<void> {
    if (workspaceId) {
      await this.storage.delete(`ws:${workspaceId}:${RecentResourceRepository.KEY}`);
    }
    await this.storage.delete(`app:${RecentResourceRepository.KEY}`);
  }
}

export const globalRecentResourceRepository = new RecentResourceRepository();
