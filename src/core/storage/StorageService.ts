/**
 * QM Editor Storage Service
 * Phase 05, Step 46 — Data & Storage Architecture Foundation
 */

import {
  IStorageService,
  IStorageAdapter,
  StoredRecord,
  StorageScope,
  StorageHealthReport,
  StorageHealthState,
  StorageHealthIssue,
  StorageReadOptions,
  StorageWriteOptions,
} from './StorageTypes';
import {
  StorageNotReadyError,
  StorageDisposedError,
  StorageReadOnlyError,
  StorageCorruptDataError,
  StorageVersionConflictError,
  StorageValidationError,
  StorageMigrationError,
} from './StorageErrors';
import { LocalStorageAdapter } from './adapters/LocalStorageAdapter';
import { globalSchemaRegistry } from './schema/SchemaRegistry';
import { globalMigrationRegistry } from './schema/MigrationRegistry';
import { StorageSerializer } from './serialization/StorageSerializer';
import { logger } from '../../utils/logger';

export interface StorageServiceOptions {
  adapter?: IStorageAdapter;
  autoInitialize?: boolean;
}

export class StorageService implements IStorageService {
  private static instance: StorageService;
  private adapter: IStorageAdapter;
  private state: StorageHealthState = 'uninitialized';
  private issues: StorageHealthIssue[] = [];
  private activeMigrations: number = 0;
  private corruptedRecordCount: number = 0;
  private lastCheckedAt: number = Date.now();

  // Concurrency serialization queue per key
  private writeQueues = new Map<string, Promise<any>>();

  constructor(options: StorageServiceOptions = {}) {
    this.adapter = options.adapter || new LocalStorageAdapter();
  }

  public static getInstance(options?: StorageServiceOptions): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService(options);
    }
    return StorageService.instance;
  }

  public setAdapter(adapter: IStorageAdapter): void {
    if (this.state === 'ready') {
      throw new Error('Cannot change storage adapter while storage is active.');
    }
    this.adapter = adapter;
  }

  public getAdapter(): IStorageAdapter {
    return this.adapter;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle & Health
  // ---------------------------------------------------------------------------

  public async initialize(): Promise<void> {
    if (this.state === 'ready') return;
    this.state = 'initializing';

    try {
      await this.adapter.initialize();
      this.state = this.adapter.isReadOnly() ? 'degraded' : 'ready';
      this.lastCheckedAt = Date.now();
      logger.info(`StorageService initialized successfully with adapter: ${this.adapter.name}`);
    } catch (err: any) {
      this.state = 'failed';
      this.recordIssue(
        `Storage initialization failed: ${err?.message || 'Unknown error'}`,
        'error'
      );
      logger.error('StorageService initialization failed.', err);
      throw err;
    }
  }

  public getHealth(): StorageHealthReport {
    return {
      state: this.state,
      adapterName: this.adapter.name,
      isReadOnly: this.adapter.isReadOnly(),
      activeMigrations: this.activeMigrations,
      corruptedRecordCount: this.corruptedRecordCount,
      lastCheckedAt: this.lastCheckedAt,
      issues: [...this.issues],
    };
  }

  private recordIssue(message: string, severity: 'warning' | 'error'): void {
    this.issues.push({
      message,
      severity,
      timestamp: Date.now(),
    });
    // Keep bounded history
    if (this.issues.length > 50) {
      this.issues.shift();
    }
  }

  private ensureReady(): void {
    if (this.state === 'disposed' || this.state === 'shuttingDown') {
      throw new StorageDisposedError();
    }
    if (this.state !== 'ready' && this.state !== 'degraded' && this.state !== 'recoveryRequired') {
      throw new StorageNotReadyError(`Storage service is in state: ${this.state}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Key Namespacing & Isolation
  // ---------------------------------------------------------------------------

  private formatKey(key: string, scope: StorageScope, workspaceId?: string): string {
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('Storage key must be a non-empty string.');
    }

    if (scope === 'workspace') {
      if (!workspaceId || workspaceId.trim().length === 0) {
        throw new Error('Workspace-scoped storage requires a valid workspaceId.');
      }
      return `ws:${workspaceId}:${key.trim()}`;
    }

    return `app:${key.trim()}`;
  }

  // ---------------------------------------------------------------------------
  // Read Operations
  // ---------------------------------------------------------------------------

  public async read<T = unknown>(
    key: string,
    schemaId: string,
    options: StorageReadOptions = {}
  ): Promise<StoredRecord<T> | null> {
    this.ensureReady();

    const record = await this.adapter.get<T>(key);
    if (!record) return null;

    // 1. Verify schema identity
    if (record.schemaId !== schemaId) {
      const msg = `Record "${key}" schema mismatch (expected "${schemaId}", got "${record.schemaId}").`;
      this.recordIssue(msg, 'warning');
      throw new StorageValidationError(msg, { key, expected: schemaId, actual: record.schemaId });
    }

    // 2. Corruption & Checksum Check
    if (record.checksum) {
      const computedChecksum = StorageSerializer.computeChecksum(
        StorageSerializer.serialize(record.payload, false)
      );
      if (record.checksum !== computedChecksum) {
        this.corruptedRecordCount++;
        this.state = 'recoveryRequired';
        const msg = `Checksum mismatch on record "${key}". Possible data corruption.`;
        this.recordIssue(msg, 'error');
        throw new StorageCorruptDataError(msg, { key, schemaId });
      }
    }

    // 3. Schema Governance & Auto-Migration
    const schemaDef = globalSchemaRegistry.get(schemaId);
    const targetVersion = options.expectedSchemaVersion ?? schemaDef?.currentVersion ?? record.schemaVersion;

    if (record.schemaVersion > targetVersion) {
      throw new StorageMigrationError(
        `Downgrading schema is unsupported for "${record.schemaId}" (stored v${record.schemaVersion} > target v${targetVersion}).`,
        { schemaId: record.schemaId, storedVersion: record.schemaVersion, targetVersion }
      );
    }

    if (record.schemaVersion < targetVersion) {
      if (options.autoMigrate !== false) {
        this.activeMigrations++;
        try {
          const migrated = await globalMigrationRegistry.migrateRecord<T>(record, targetVersion);
          // Persist migrated record back atomically if not read-only
          if (!this.adapter.isReadOnly()) {
            await this.adapter.set(migrated);
          }
          return migrated;
        } finally {
          this.activeMigrations--;
        }
      }
    }

    // 4. Validate payload against current schema definition
    if (schemaDef && record.schemaVersion === schemaDef.currentVersion) {
      try {
        globalSchemaRegistry.validate(schemaId, record.payload);
      } catch (err: any) {
        this.corruptedRecordCount++;
        this.state = 'recoveryRequired';
        this.recordIssue(`Schema validation failed on read for record "${key}".`, 'error');
        throw new StorageCorruptDataError(
          `Record "${key}" failed schema validation: ${err?.message}`,
          { key, schemaId }
        );
      }
    }

    return record;
  }

  // ---------------------------------------------------------------------------
  // Write Operations (Concurrency-Protected & Atomic)
  // ---------------------------------------------------------------------------

  public async write<T = unknown>(
    rawKey: string,
    schemaId: string,
    payload: T,
    scope: StorageScope,
    workspaceId?: string,
    options: StorageWriteOptions = {}
  ): Promise<StoredRecord<T>> {
    this.ensureReady();

    if (this.adapter.isReadOnly()) {
      throw new StorageReadOnlyError();
    }

    const key = this.formatKey(rawKey, scope, workspaceId);

    // Concurrency queue: serialize writes targeting the same key
    const currentQueue = this.writeQueues.get(key) || Promise.resolve();

    const writeOp = currentQueue.then(async () => {
      // 1. Schema Registration & Validation
      const schemaDef = globalSchemaRegistry.get(schemaId);
      if (!schemaDef) {
        throw new StorageValidationError(`Cannot write record with unregistered schema "${schemaId}".`);
      }

      if (!options.skipValidation) {
        globalSchemaRegistry.validate(schemaId, payload);
      }

      // 2. Secret Leak Inspection & Checksum Computation
      const serialized = StorageSerializer.serialize(payload, true);
      const checksum = StorageSerializer.computeChecksum(serialized);

      // 3. Optimistic Concurrency & Monotonic Versioning
      const existing = await this.adapter.get<T>(key);
      if (options.expectedRecordVersion !== undefined) {
        const currentVersion = existing?.recordVersion ?? 0;
        if (currentVersion !== options.expectedRecordVersion) {
          throw new StorageVersionConflictError(
            `Optimistic concurrency conflict on "${key}": expected recordVersion ${options.expectedRecordVersion}, got ${currentVersion}.`,
            { key, expected: options.expectedRecordVersion, actual: currentVersion }
          );
        }
      }

      const nextRecordVersion = (existing?.recordVersion ?? 0) + 1;
      const now = Date.now();

      const record: StoredRecord<T> = {
        key,
        schemaId,
        schemaVersion: schemaDef.currentVersion,
        recordVersion: nextRecordVersion,
        scope,
        workspaceId: scope === 'workspace' ? workspaceId : undefined,
        payload,
        checksum,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      // 4. Physical Commit
      await this.adapter.set(record);
      return record;
    });

    this.writeQueues.set(key, writeOp);

    try {
      return await writeOp;
    } finally {
      if (this.writeQueues.get(key) === writeOp) {
        this.writeQueues.delete(key);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Key Operations & Workspace Isolation
  // ---------------------------------------------------------------------------

  public async delete(key: string): Promise<boolean> {
    this.ensureReady();
    if (this.adapter.isReadOnly()) {
      throw new StorageReadOnlyError();
    }
    return this.adapter.delete(key);
  }

  public async has(key: string): Promise<boolean> {
    this.ensureReady();
    return this.adapter.has(key);
  }

  public async listKeys(prefix?: string): Promise<string[]> {
    this.ensureReady();
    return this.adapter.listKeys(prefix);
  }

  public async clearWorkspace(workspaceId: string): Promise<void> {
    this.ensureReady();
    if (this.adapter.isReadOnly()) {
      throw new StorageReadOnlyError();
    }
    await this.adapter.clear('workspace', workspaceId);
    logger.info(`Cleared persistent storage for workspace "${workspaceId}".`);
  }

  // ---------------------------------------------------------------------------
  // Shutdown & Reset
  // ---------------------------------------------------------------------------

  public async dispose(): Promise<void> {
    this.state = 'shuttingDown';
    // Wait for in-flight write queues to drain
    const pendingWrites = Array.from(this.writeQueues.values());
    if (pendingWrites.length > 0) {
      await Promise.allSettled(pendingWrites);
    }
    this.writeQueues.clear();

    await this.adapter.dispose();
    this.state = 'disposed';
    logger.info('StorageService disposed.');
  }

  public async reset(): Promise<void> {
    this.writeQueues.clear();
    this.issues = [];
    this.corruptedRecordCount = 0;
    this.activeMigrations = 0;
    await this.adapter.clear();
    this.state = 'ready';
  }
}

export const globalStorageService = StorageService.getInstance();
