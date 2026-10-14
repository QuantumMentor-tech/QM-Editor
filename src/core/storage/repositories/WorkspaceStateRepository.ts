/**
 * QM Editor Workspace State Repository Contract & Implementation
 * Phase 05, Step 46 — Data & Storage Architecture Foundation
 */

import {
  IStorageService,
  WorkspaceMetadataDTO,
  RecentWorkspaceDTO,
} from '../StorageTypes';
import { globalStorageService } from '../StorageService';

export interface IWorkspaceStateRepository {
  getWorkspaceMetadata(workspaceId: string): Promise<WorkspaceMetadataDTO | null>;
  saveWorkspaceMetadata(
    workspaceId: string,
    metadata: WorkspaceMetadataDTO,
    expectedRecordVersion?: number
  ): Promise<void>;
  getRecentWorkspaces(): Promise<RecentWorkspaceDTO[]>;
  saveRecentWorkspaces(
    workspaces: RecentWorkspaceDTO[],
    expectedRecordVersion?: number
  ): Promise<void>;
}

export class WorkspaceStateRepository implements IWorkspaceStateRepository {
  private readonly storage: IStorageService;
  private static readonly METADATA_KEY = 'metadata';
  private static readonly RECENT_WORKSPACES_KEY = 'recent_workspaces';
  private static readonly METADATA_SCHEMA_ID = 'qm.workspace.metadata';
  private static readonly RECENT_SCHEMA_ID = 'qm.navigation.recent';

  constructor(storage: IStorageService = globalStorageService) {
    this.storage = storage;
  }

  public async getWorkspaceMetadata(workspaceId: string): Promise<WorkspaceMetadataDTO | null> {
    const record = await this.storage.read<WorkspaceMetadataDTO>(
      `ws:${workspaceId}:${WorkspaceStateRepository.METADATA_KEY}`,
      WorkspaceStateRepository.METADATA_SCHEMA_ID
    );
    return record ? record.payload : null;
  }

  public async saveWorkspaceMetadata(
    workspaceId: string,
    metadata: WorkspaceMetadataDTO,
    expectedRecordVersion?: number
  ): Promise<void> {
    await this.storage.write<WorkspaceMetadataDTO>(
      WorkspaceStateRepository.METADATA_KEY,
      WorkspaceStateRepository.METADATA_SCHEMA_ID,
      metadata,
      'workspace',
      workspaceId,
      { expectedRecordVersion }
    );
  }

  public async getRecentWorkspaces(): Promise<RecentWorkspaceDTO[]> {
    const record = await this.storage.read<RecentWorkspaceDTO[]>(
      'app:recent_workspaces',
      WorkspaceStateRepository.RECENT_SCHEMA_ID
    );
    return record ? record.payload : [];
  }

  public async saveRecentWorkspaces(
    workspaces: RecentWorkspaceDTO[],
    expectedRecordVersion?: number
  ): Promise<void> {
    await this.storage.write<RecentWorkspaceDTO[]>(
      WorkspaceStateRepository.RECENT_WORKSPACES_KEY,
      WorkspaceStateRepository.RECENT_SCHEMA_ID,
      workspaces,
      'application',
      undefined,
      { expectedRecordVersion }
    );
  }
}

export const globalWorkspaceStateRepository = new WorkspaceStateRepository();
