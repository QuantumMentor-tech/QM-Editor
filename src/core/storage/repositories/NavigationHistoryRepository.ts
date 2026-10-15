/**
 * QM Editor Navigation History Repository Contract & Implementation
 * Phase 05, Step 50 — Persistent Recent Resources, Navigation History & User Activity State
 */

import { IStorageService, NavigationHistoryDTO } from '../StorageTypes';
import { globalStorageService } from '../StorageService';
import { logger } from '../../../utils/logger';

export interface INavigationHistoryRepository {
  getNavigationHistory(workspaceId?: string): Promise<NavigationHistoryDTO | null>;
  saveNavigationHistory(
    history: NavigationHistoryDTO,
    workspaceId?: string,
    expectedRecordVersion?: number
  ): Promise<void>;
  clearNavigationHistory(workspaceId?: string): Promise<void>;
}

export class NavigationHistoryRepository implements INavigationHistoryRepository {
  private readonly storage: IStorageService;
  private static readonly KEY = 'navigation_history';
  private static readonly SCHEMA_ID = 'qm.navigation.history';

  constructor(storage: IStorageService = globalStorageService) {
    this.storage = storage;
  }

  public async getNavigationHistory(workspaceId?: string): Promise<NavigationHistoryDTO | null> {
    const key = workspaceId
      ? `ws:${workspaceId}:${NavigationHistoryRepository.KEY}`
      : `app:${NavigationHistoryRepository.KEY}`;

    try {
      const record = await this.storage.read<NavigationHistoryDTO>(
        key,
        NavigationHistoryRepository.SCHEMA_ID
      );
      return record ? record.payload : null;
    } catch (err) {
      logger.warn(`Failed to read navigation history for ${key}`, err);
      return null;
    }
  }

  public async saveNavigationHistory(
    history: NavigationHistoryDTO,
    workspaceId?: string,
    expectedRecordVersion?: number
  ): Promise<void> {
    const scope = workspaceId ? 'workspace' : 'application';

    await this.storage.write<NavigationHistoryDTO>(
      NavigationHistoryRepository.KEY,
      NavigationHistoryRepository.SCHEMA_ID,
      history,
      scope,
      workspaceId,
      { expectedRecordVersion }
    );
  }

  public async clearNavigationHistory(workspaceId?: string): Promise<void> {
    const key = workspaceId
      ? `ws:${workspaceId}:${NavigationHistoryRepository.KEY}`
      : `app:${NavigationHistoryRepository.KEY}`;

    await this.storage.delete(key);
  }
}

export const globalNavigationHistoryRepository = new NavigationHistoryRepository();
