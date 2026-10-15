/**
 * QM Editor Document Recovery Repository Contract & Implementation
 * Phase 05, Step 52 — Document Recovery, Autosave & Crash-Safe Unsaved Work Foundation
 */

import {
  IStorageService,
  RecoverySessionDTO,
  RecoveryManifestDTO,
  RecoverySnapshotDTO,
} from '../StorageTypes';
import { globalStorageService } from '../StorageService';
import { logger } from '../../../utils/logger';

export interface IDocumentRecoveryRepository {
  getActiveSession(): Promise<RecoverySessionDTO | null>;
  setActiveSession(session: RecoverySessionDTO): Promise<void>;
  clearActiveSession(): Promise<void>;

  getManifest(sessionId: string): Promise<RecoveryManifestDTO | null>;
  saveManifest(
    manifest: RecoveryManifestDTO,
    expectedRecordVersion?: number
  ): Promise<void>;
  deleteManifest(sessionId: string): Promise<boolean>;

  getSnapshot(recoveryId: string): Promise<RecoverySnapshotDTO | null>;
  saveSnapshot(
    snapshot: RecoverySnapshotDTO,
    expectedRecordVersion?: number
  ): Promise<void>;
  deleteSnapshot(recoveryId: string): Promise<boolean>;

  listManifests(): Promise<RecoveryManifestDTO[]>;
  listSnapshotKeys(): Promise<string[]>;
  clearAllRecovery(): Promise<void>;
}

export class DocumentRecoveryRepository implements IDocumentRecoveryRepository {
  private readonly storage: IStorageService;

  public static readonly ACTIVE_SESSION_KEY = 'recovery:active_session';
  public static readonly SESSION_SCHEMA_ID = 'qm.recovery.session';

  public static readonly MANIFEST_PREFIX = 'recovery:manifest:';
  public static readonly MANIFEST_SCHEMA_ID = 'qm.recovery.manifest';

  public static readonly SNAPSHOT_PREFIX = 'recovery:snapshot:';
  public static readonly SNAPSHOT_SCHEMA_ID = 'qm.recovery.snapshot';

  constructor(storage: IStorageService = globalStorageService) {
    this.storage = storage;
  }

  // ---------------------------------------------------------------------------
  // 1. Active Session Pointers & Clean Shutdown Tracking
  // ---------------------------------------------------------------------------

  public async getActiveSession(): Promise<RecoverySessionDTO | null> {
    try {
      const fullKey = `app:${DocumentRecoveryRepository.ACTIVE_SESSION_KEY}`;
      const record = await this.storage.read<RecoverySessionDTO>(
        fullKey,
        DocumentRecoveryRepository.SESSION_SCHEMA_ID
      );
      return record ? record.payload : null;
    } catch (err) {
      logger.warn(
        `DocumentRecoveryRepository: failed to read active session pointer: ${
          (err as Error).message
        }`
      );
      return null;
    }
  }

  public async setActiveSession(session: RecoverySessionDTO): Promise<void> {
    await this.storage.write<RecoverySessionDTO>(
      DocumentRecoveryRepository.ACTIVE_SESSION_KEY,
      DocumentRecoveryRepository.SESSION_SCHEMA_ID,
      session,
      'application'
    );
  }

  public async clearActiveSession(): Promise<void> {
    const fullKey = `app:${DocumentRecoveryRepository.ACTIVE_SESSION_KEY}`;
    await this.storage.delete(fullKey);
  }

  // ---------------------------------------------------------------------------
  // 2. Recovery Manifests
  // ---------------------------------------------------------------------------

  public async getManifest(sessionId: string): Promise<RecoveryManifestDTO | null> {
    const key = `${DocumentRecoveryRepository.MANIFEST_PREFIX}${sessionId}`;
    const fullKey = `app:${key}`;
    try {
      const record = await this.storage.read<RecoveryManifestDTO>(
        fullKey,
        DocumentRecoveryRepository.MANIFEST_SCHEMA_ID
      );
      return record ? record.payload : null;
    } catch (err) {
      logger.warn(
        `DocumentRecoveryRepository: failed to read recovery manifest for session ${sessionId}: ${
          (err as Error).message
        }`
      );
      return null;
    }
  }

  public async saveManifest(
    manifest: RecoveryManifestDTO,
    expectedRecordVersion?: number
  ): Promise<void> {
    const key = `${DocumentRecoveryRepository.MANIFEST_PREFIX}${manifest.sessionId}`;
    await this.storage.write<RecoveryManifestDTO>(
      key,
      DocumentRecoveryRepository.MANIFEST_SCHEMA_ID,
      manifest,
      'application',
      undefined,
      { expectedRecordVersion }
    );
  }

  public async deleteManifest(sessionId: string): Promise<boolean> {
    const key = `${DocumentRecoveryRepository.MANIFEST_PREFIX}${sessionId}`;
    const fullKey = `app:${key}`;
    return this.storage.delete(fullKey);
  }

  // ---------------------------------------------------------------------------
  // 3. Recovery Snapshots
  // ---------------------------------------------------------------------------

  public async getSnapshot(recoveryId: string): Promise<RecoverySnapshotDTO | null> {
    const key = `${DocumentRecoveryRepository.SNAPSHOT_PREFIX}${recoveryId}`;
    const fullKey = `app:${key}`;
    try {
      const record = await this.storage.read<RecoverySnapshotDTO>(
        fullKey,
        DocumentRecoveryRepository.SNAPSHOT_SCHEMA_ID
      );
      return record ? record.payload : null;
    } catch (err) {
      logger.warn(
        `DocumentRecoveryRepository: failed to read recovery snapshot ${recoveryId}: ${
          (err as Error).message
        }`
      );
      return null;
    }
  }

  public async saveSnapshot(
    snapshot: RecoverySnapshotDTO,
    expectedRecordVersion?: number
  ): Promise<void> {
    const key = `${DocumentRecoveryRepository.SNAPSHOT_PREFIX}${snapshot.recoveryId}`;
    await this.storage.write<RecoverySnapshotDTO>(
      key,
      DocumentRecoveryRepository.SNAPSHOT_SCHEMA_ID,
      snapshot,
      'application',
      undefined,
      { expectedRecordVersion }
    );
  }

  public async deleteSnapshot(recoveryId: string): Promise<boolean> {
    const key = `${DocumentRecoveryRepository.SNAPSHOT_PREFIX}${recoveryId}`;
    const fullKey = `app:${key}`;
    return this.storage.delete(fullKey);
  }

  // ---------------------------------------------------------------------------
  // 4. Discovery & Bulk Query
  // ---------------------------------------------------------------------------

  public async listManifests(): Promise<RecoveryManifestDTO[]> {
    const prefix = `app:${DocumentRecoveryRepository.MANIFEST_PREFIX}`;
    const keys = await this.storage.listKeys(prefix);
    const manifests: RecoveryManifestDTO[] = [];

    for (const key of keys) {
      try {
        const record = await this.storage.read<RecoveryManifestDTO>(
          key,
          DocumentRecoveryRepository.MANIFEST_SCHEMA_ID
        );
        if (record && record.payload) {
          manifests.push(record.payload);
        }
      } catch (err) {
        logger.warn(
          `DocumentRecoveryRepository: skipping malformed or corrupt manifest "${key}": ${
            (err as Error).message
          }`
        );
      }
    }

    return manifests;
  }

  public async listSnapshotKeys(): Promise<string[]> {
    const prefix = `app:${DocumentRecoveryRepository.SNAPSHOT_PREFIX}`;
    return this.storage.listKeys(prefix);
  }

  public async clearAllRecovery(): Promise<void> {
    // 1. Delete active session
    await this.clearActiveSession();

    // 2. Delete all manifests
    const manifestPrefix = `app:${DocumentRecoveryRepository.MANIFEST_PREFIX}`;
    const manifestKeys = await this.storage.listKeys(manifestPrefix);
    for (const k of manifestKeys) {
      await this.storage.delete(k);
    }

    // 3. Delete all snapshots
    const snapshotPrefix = `app:${DocumentRecoveryRepository.SNAPSHOT_PREFIX}`;
    const snapshotKeys = await this.storage.listKeys(snapshotPrefix);
    for (const k of snapshotKeys) {
      await this.storage.delete(k);
    }

    logger.info('DocumentRecoveryRepository: cleared all recovery state.');
  }
}

export const globalDocumentRecoveryRepository = new DocumentRecoveryRepository();
