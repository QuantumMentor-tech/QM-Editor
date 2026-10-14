/**
 * QM Editor Settings Repository Contract & Implementation
 * Phase 05, Step 46 — Data & Storage Architecture Foundation
 */

import { IStorageService, UserSettingsDTO, WorkspaceSettingsDTO } from '../StorageTypes';
import { globalStorageService } from '../StorageService';

export interface ISettingsRepository {
  getUserSettings(): Promise<UserSettingsDTO>;
  getUserSettingsRecord(): Promise<{ settings: UserSettingsDTO; recordVersion: number } | null>;
  saveUserSettings(settings: UserSettingsDTO, expectedRecordVersion?: number): Promise<void>;
  clearUserSettings(): Promise<void>;
  getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettingsDTO>;
  getWorkspaceSettingsRecord(
    workspaceId: string
  ): Promise<{ settings: WorkspaceSettingsDTO; recordVersion: number } | null>;
  saveWorkspaceSettings(
    workspaceId: string,
    settings: WorkspaceSettingsDTO,
    expectedRecordVersion?: number
  ): Promise<void>;
  clearWorkspaceSettings(workspaceId: string): Promise<void>;
}

export class SettingsRepository implements ISettingsRepository {
  private readonly storage: IStorageService;
  private static readonly USER_SETTINGS_KEY = 'user_settings';
  private static readonly WORKSPACE_SETTINGS_KEY = 'settings';
  private static readonly USER_SCHEMA_ID = 'qm.settings.user';
  private static readonly WORKSPACE_SCHEMA_ID = 'qm.settings.workspace';

  constructor(storage: IStorageService = globalStorageService) {
    this.storage = storage;
  }

  public async getUserSettings(): Promise<UserSettingsDTO> {
    const record = await this.getUserSettingsRecord();
    return record ? record.settings : {};
  }

  public async getUserSettingsRecord(): Promise<{ settings: UserSettingsDTO; recordVersion: number } | null> {
    const record = await this.storage.read<UserSettingsDTO>(
      'app:user_settings',
      SettingsRepository.USER_SCHEMA_ID
    );
    if (!record) return null;
    return {
      settings: record.payload,
      recordVersion: record.recordVersion,
    };
  }

  public async saveUserSettings(
    settings: UserSettingsDTO,
    expectedRecordVersion?: number
  ): Promise<void> {
    await this.storage.write<UserSettingsDTO>(
      SettingsRepository.USER_SETTINGS_KEY,
      SettingsRepository.USER_SCHEMA_ID,
      settings,
      'application',
      undefined,
      { expectedRecordVersion }
    );
  }

  public async clearUserSettings(): Promise<void> {
    await this.storage.delete('app:user_settings');
  }

  public async getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettingsDTO> {
    const record = await this.getWorkspaceSettingsRecord(workspaceId);
    return record ? record.settings : {};
  }

  public async getWorkspaceSettingsRecord(
    workspaceId: string
  ): Promise<{ settings: WorkspaceSettingsDTO; recordVersion: number } | null> {
    const record = await this.storage.read<WorkspaceSettingsDTO>(
      `ws:${workspaceId}:${SettingsRepository.WORKSPACE_SETTINGS_KEY}`,
      SettingsRepository.WORKSPACE_SCHEMA_ID
    );
    if (!record) return null;
    return {
      settings: record.payload,
      recordVersion: record.recordVersion,
    };
  }

  public async saveWorkspaceSettings(
    workspaceId: string,
    settings: WorkspaceSettingsDTO,
    expectedRecordVersion?: number
  ): Promise<void> {
    await this.storage.write<WorkspaceSettingsDTO>(
      SettingsRepository.WORKSPACE_SETTINGS_KEY,
      SettingsRepository.WORKSPACE_SCHEMA_ID,
      settings,
      'workspace',
      workspaceId,
      { expectedRecordVersion }
    );
  }

  public async clearWorkspaceSettings(workspaceId: string): Promise<void> {
    await this.storage.delete(`ws:${workspaceId}:${SettingsRepository.WORKSPACE_SETTINGS_KEY}`);
  }
}

export const globalSettingsRepository = new SettingsRepository();
