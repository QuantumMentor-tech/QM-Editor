/**
 * QM Editor Local History Repository Contract & Implementation
 * Phase 05, Step 53 — Local History, Document Snapshots & Versioned Content Persistence
 */

import {
  IStorageService,
  LocalHistoryManifestDTO,
  LocalHistorySnapshotDTO,
} from '../StorageTypes';
import { globalStorageService } from '../StorageService';
import { logger } from '../../../utils/logger';

export interface ILocalHistoryRepository {
  getManifest(resourceUri: string, workspaceId?: string): Promise<LocalHistoryManifestDTO | null>;
  saveManifest(
    manifest: LocalHistoryManifestDTO,
    expectedRecordVersion?: number
  ): Promise<void>;
  deleteManifest(resourceUri: string, workspaceId?: string): Promise<boolean>;

  getSnapshot(snapshotId: string): Promise<LocalHistorySnapshotDTO | null>;
  saveSnapshot(
    snapshot: LocalHistorySnapshotDTO,
    expectedRecordVersion?: number
  ): Promise<void>;
  deleteSnapshot(snapshotId: string): Promise<boolean>;

  listManifests(workspaceId?: string): Promise<LocalHistoryManifestDTO[]>;
  clearResourceHistory(resourceUri: string, workspaceId?: string): Promise<void>;
  clearAllHistory(): Promise<void>;
}

export class LocalHistoryRepository implements ILocalHistoryRepository {
  private readonly storage: IStorageService;

  public static readonly MANIFEST_PREFIX = 'history:manifest:';
  public static readonly MANIFEST_SCHEMA_ID = 'qm.history.manifest';

  public static readonly SNAPSHOT_PREFIX = 'history:snapshot:';
  public static readonly SNAPSHOT_SCHEMA_ID = 'qm.history.snapshot';

  constructor(storage: IStorageService = globalStorageService) {
    this.storage = storage;
  }

  // ---------------------------------------------------------------------------
  // Key Helpers
  // ---------------------------------------------------------------------------

  private toManifestKey(resourceUri: string, workspaceId?: string): string {
    const wsPrefix = workspaceId ? `${workspaceId}:` : '';
    return `${LocalHistoryRepository.MANIFEST_PREFIX}${wsPrefix}${encodeURIComponent(resourceUri)}`;
  }

  private toSnapshotKey(snapshotId: string): string {
    return `${LocalHistoryRepository.SNAPSHOT_PREFIX}${snapshotId}`;
  }

  // ---------------------------------------------------------------------------
  // 1. History Manifest Operations
  // ---------------------------------------------------------------------------

  public async getManifest(
    resourceUri: string,
    workspaceId?: string
  ): Promise<LocalHistoryManifestDTO | null> {
    if (!resourceUri) return null;
    const key = this.toManifestKey(resourceUri, workspaceId);
    const fullKey = `app:${key}`;

    try {
      const record = await this.storage.read<LocalHistoryManifestDTO>(
        fullKey,
        LocalHistoryRepository.MANIFEST_SCHEMA_ID
      );
      return record ? record.payload : null;
    } catch (err) {
      logger.warn(
        `LocalHistoryRepository: failed to read history manifest for "${resourceUri}": ${
          (err as Error).message
        }`
      );
      return null;
    }
  }

  public async saveManifest(
    manifest: LocalHistoryManifestDTO,
    expectedRecordVersion?: number
  ): Promise<void> {
    const key = this.toManifestKey(manifest.resourceUri, manifest.workspaceId);
    await this.storage.write<LocalHistoryManifestDTO>(
      key,
      LocalHistoryRepository.MANIFEST_SCHEMA_ID,
      manifest,
      'application',
      undefined,
      { expectedRecordVersion }
    );
  }

  public async deleteManifest(
    resourceUri: string,
    workspaceId?: string
  ): Promise<boolean> {
    const key = this.toManifestKey(resourceUri, workspaceId);
    const fullKey = `app:${key}`;
    return this.storage.delete(fullKey);
  }

  // ---------------------------------------------------------------------------
  // 2. Snapshot Content Operations
  // ---------------------------------------------------------------------------

  public async getSnapshot(
    snapshotId: string
  ): Promise<LocalHistorySnapshotDTO | null> {
    if (!snapshotId) return null;
    const key = this.toSnapshotKey(snapshotId);
    const fullKey = `app:${key}`;

    try {
      const record = await this.storage.read<LocalHistorySnapshotDTO>(
        fullKey,
        LocalHistoryRepository.SNAPSHOT_SCHEMA_ID
      );
      return record ? record.payload : null;
    } catch (err) {
      logger.warn(
        `LocalHistoryRepository: failed to read history snapshot "${snapshotId}": ${
          (err as Error).message
        }`
      );
      return null;
    }
  }

  public async saveSnapshot(
    snapshot: LocalHistorySnapshotDTO,
    expectedRecordVersion?: number
  ): Promise<void> {
    const key = this.toSnapshotKey(snapshot.id);
    await this.storage.write<LocalHistorySnapshotDTO>(
      key,
      LocalHistoryRepository.SNAPSHOT_SCHEMA_ID,
      snapshot,
      'application',
      undefined,
      { expectedRecordVersion }
    );
  }

  public async deleteSnapshot(snapshotId: string): Promise<boolean> {
    const key = this.toSnapshotKey(snapshotId);
    const fullKey = `app:${key}`;
    return this.storage.delete(fullKey);
  }

  // ---------------------------------------------------------------------------
  // 3. Discovery & Bulk Operations
  // ---------------------------------------------------------------------------

  public async listManifests(workspaceId?: string): Promise<LocalHistoryManifestDTO[]> {
    const prefix = `app:${LocalHistoryRepository.MANIFEST_PREFIX}`;
    const keys = await this.storage.listKeys(prefix);
    const manifests: LocalHistoryManifestDTO[] = [];

    for (const key of keys) {
      try {
        const record = await this.storage.read<LocalHistoryManifestDTO>(
          key,
          LocalHistoryRepository.MANIFEST_SCHEMA_ID
        );
        if (record && record.payload) {
          if (!workspaceId || record.payload.workspaceId === workspaceId) {
            manifests.push(record.payload);
          }
        }
      } catch (err) {
        logger.warn(
          `LocalHistoryRepository: skipping corrupt or invalid manifest "${key}": ${
            (err as Error).message
          }`
        );
      }
    }

    return manifests;
  }

  public async clearResourceHistory(
    resourceUri: string,
    workspaceId?: string
  ): Promise<void> {
    const manifest = await this.getManifest(resourceUri, workspaceId);
    if (!manifest) return;

    // Delete all associated snapshots
    for (const entry of manifest.entries) {
      await this.deleteSnapshot(entry.id);
    }

    // Delete manifest
    await this.deleteManifest(resourceUri, workspaceId);
    logger.info(`LocalHistoryRepository: cleared history for "${resourceUri}".`);
  }

  public async clearAllHistory(): Promise<void> {
    // 1. Delete all manifests
    const manifestPrefix = `app:${LocalHistoryRepository.MANIFEST_PREFIX}`;
    const manifestKeys = await this.storage.listKeys(manifestPrefix);
    for (const k of manifestKeys) {
      await this.storage.delete(k);
    }

    // 2. Delete all snapshots
    const snapshotPrefix = `app:${LocalHistoryRepository.SNAPSHOT_PREFIX}`;
    const snapshotKeys = await this.storage.listKeys(snapshotPrefix);
    for (const k of snapshotKeys) {
      await this.storage.delete(k);
    }

    logger.info('LocalHistoryRepository: cleared all local history records.');
  }
}

export const globalLocalHistoryRepository = new LocalHistoryRepository();
