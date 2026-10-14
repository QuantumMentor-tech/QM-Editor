/**
 * QM Editor Session State Repository Contract & Implementation
 * Phase 05, Step 46 — Data & Storage Architecture Foundation
 */

import { IStorageService, WorkspaceSessionDTO } from '../StorageTypes';
import { globalStorageService } from '../StorageService';

export interface ISessionStateRepository {
  getWorkspaceSession(workspaceId: string): Promise<WorkspaceSessionDTO | null>;
  saveWorkspaceSession(
    workspaceId: string,
    session: WorkspaceSessionDTO,
    expectedRecordVersion?: number
  ): Promise<void>;
  clearWorkspaceSession(workspaceId: string): Promise<void>;
}

export class SessionStateRepository implements ISessionStateRepository {
  private readonly storage: IStorageService;
  private static readonly SESSION_KEY = 'session';
  private static readonly SESSION_SCHEMA_ID = 'qm.session.workspace';

  constructor(storage: IStorageService = globalStorageService) {
    this.storage = storage;
  }

  public async getWorkspaceSession(workspaceId: string): Promise<WorkspaceSessionDTO | null> {
    const record = await this.storage.read<WorkspaceSessionDTO>(
      `ws:${workspaceId}:${SessionStateRepository.SESSION_KEY}`,
      SessionStateRepository.SESSION_SCHEMA_ID
    );
    return record ? record.payload : null;
  }

  public async saveWorkspaceSession(
    workspaceId: string,
    session: WorkspaceSessionDTO,
    expectedRecordVersion?: number
  ): Promise<void> {
    await this.storage.write<WorkspaceSessionDTO>(
      SessionStateRepository.SESSION_KEY,
      SessionStateRepository.SESSION_SCHEMA_ID,
      session,
      'workspace',
      workspaceId,
      { expectedRecordVersion }
    );
  }

  public async clearWorkspaceSession(workspaceId: string): Promise<void> {
    await this.storage.delete(`ws:${workspaceId}:${SessionStateRepository.SESSION_KEY}`);
  }
}

export const globalSessionStateRepository = new SessionStateRepository();
