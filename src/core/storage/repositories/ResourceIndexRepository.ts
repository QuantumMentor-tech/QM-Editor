/**
 * QM Editor Resource Index Repository Contract & Implementation
 * Phase 05, Step 51 — Persistent Workspace Indexes, Search Cache & Derived Data Storage
 */

import { IStorageService, WorkspaceIndexDTO } from '../StorageTypes';
import { globalStorageService } from '../StorageService';
import { logger } from '../../../utils/logger';

export interface IResourceIndexRepository {
  getIndex(workspaceId: string): Promise<WorkspaceIndexDTO | null>;
  saveIndex(
    workspaceId: string,
    index: WorkspaceIndexDTO,
    expectedRecordVersion?: number
  ): Promise<void>;
  deleteIndex(workspaceId: string): Promise<boolean>;
  clearAllIndexes(): Promise<void>;
}

export class ResourceIndexRepository implements IResourceIndexRepository {
  private readonly storage: IStorageService;
  public static readonly KEY = 'resource_index';
  public static readonly SCHEMA_ID = 'qm.workspace.index';

  constructor(storage: IStorageService = globalStorageService) {
    this.storage = storage;
  }

  public async getIndex(workspaceId: string): Promise<WorkspaceIndexDTO | null> {
    const fullKey = `ws:${workspaceId}:${ResourceIndexRepository.KEY}`;
    try {
      const record = await this.storage.read<WorkspaceIndexDTO>(
        fullKey,
        ResourceIndexRepository.SCHEMA_ID
      );
      return record ? record.payload : null;
    } catch (err) {
      logger.warn(`Failed to read resource index for workspace ${workspaceId}: ${(err as Error).message}`);
      return null;
    }
  }

  public async saveIndex(
    workspaceId: string,
    index: WorkspaceIndexDTO,
    expectedRecordVersion?: number
  ): Promise<void> {
    await this.storage.write<WorkspaceIndexDTO>(
      ResourceIndexRepository.KEY,
      ResourceIndexRepository.SCHEMA_ID,
      index,
      'workspace',
      workspaceId,
      { expectedRecordVersion }
    );
  }

  public async deleteIndex(workspaceId: string): Promise<boolean> {
    const fullKey = `ws:${workspaceId}:${ResourceIndexRepository.KEY}`;
    try {
      return await this.storage.delete(fullKey);
    } catch (err) {
      logger.warn(`Failed to delete resource index for workspace ${workspaceId}: ${(err as Error).message}`);
      return false;
    }
  }

  public async clearAllIndexes(): Promise<void> {
    try {
      const allKeys = await this.storage.listKeys('ws:');
      const indexKeys = allKeys.filter((k) => k.endsWith(`:${ResourceIndexRepository.KEY}`));
      for (const key of indexKeys) {
        await this.storage.delete(key);
      }
    } catch (err) {
      logger.warn(`Failed to clear all resource indexes: ${(err as Error).message}`);
    }
  }
}
