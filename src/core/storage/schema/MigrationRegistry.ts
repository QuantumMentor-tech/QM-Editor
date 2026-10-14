/**
 * QM Editor Storage Migration Registry & Pipeline
 * Phase 05, Step 46 — Data & Storage Architecture Foundation
 */

import { StorageMigration, StoredRecord } from '../StorageTypes';
import { StorageMigrationError } from '../StorageErrors';
import { globalSchemaRegistry } from './SchemaRegistry';
import { logger } from '../../../utils/logger';

export class MigrationRegistry {
  private static instance: MigrationRegistry;
  // schemaId -> map of "fromVersion:toVersion" -> StorageMigration
  private migrations = new Map<string, Map<string, StorageMigration<any, any>>>();

  private constructor() {}

  public static getInstance(): MigrationRegistry {
    if (!MigrationRegistry.instance) {
      MigrationRegistry.instance = new MigrationRegistry();
    }
    return MigrationRegistry.instance;
  }

  public registerMigration<TFrom = any, TTo = any>(migration: StorageMigration<TFrom, TTo>): void {
    if (migration.fromVersion >= migration.toVersion) {
      throw new StorageMigrationError(
        `Invalid migration versions for "${migration.schemaId}": fromVersion (${migration.fromVersion}) must be less than toVersion (${migration.toVersion}).`
      );
    }

    if (!this.migrations.has(migration.schemaId)) {
      this.migrations.set(migration.schemaId, new Map());
    }

    const key = `${migration.fromVersion}:${migration.toVersion}`;
    this.migrations.get(migration.schemaId)!.set(key, migration);
  }

  public hasMigration(schemaId: string, fromVersion: number, toVersion: number): boolean {
    const map = this.migrations.get(schemaId);
    if (!map) return false;
    return map.has(`${fromVersion}:${toVersion}`);
  }

  /**
   * Plans and executes an ordered chain of migrations to transition a record
   * from its current schemaVersion to targetVersion.
   */
  public async migrateRecord<T = unknown>(
    record: StoredRecord<any>,
    targetVersion: number
  ): Promise<StoredRecord<T>> {
    const currentVersion = record.schemaVersion;

    if (currentVersion === targetVersion) {
      return record as StoredRecord<T>;
    }

    if (currentVersion > targetVersion) {
      throw new StorageMigrationError(
        `Downgrading schema is unsupported for "${record.schemaId}" (stored v${currentVersion} > target v${targetVersion}).`,
        { schemaId: record.schemaId, storedVersion: currentVersion, targetVersion }
      );
    }

    const plan = this.findMigrationPlan(record.schemaId, currentVersion, targetVersion);
    if (!plan || plan.length === 0) {
      throw new StorageMigrationError(
        `No migration path available for schema "${record.schemaId}" from version ${currentVersion} to ${targetVersion}.`,
        { schemaId: record.schemaId, fromVersion: currentVersion, targetVersion }
      );
    }

    logger.info(
      `Migrating record "${record.key}" (${record.schemaId}) from v${currentVersion} to v${targetVersion} via ${plan.length} step(s).`
    );

    let currentPayload = record.payload;

    for (const step of plan) {
      try {
        currentPayload = await step.migrate(currentPayload);
      } catch (err: any) {
        throw new StorageMigrationError(
          `Migration step v${step.fromVersion} -> v${step.toVersion} failed for "${record.schemaId}": ${err?.message || 'Unknown error'}`,
          {
            schemaId: record.schemaId,
            failedStep: `${step.fromVersion}->${step.toVersion}`,
            originalRecord: record,
          }
        );
      }
    }

    // Validate final payload against schema registry
    const schemaDef = globalSchemaRegistry.get(record.schemaId);
    if (schemaDef && schemaDef.currentVersion === targetVersion) {
      try {
        globalSchemaRegistry.validate(record.schemaId, currentPayload);
      } catch (err: any) {
        throw new StorageMigrationError(
          `Migrated record payload failed validation for "${record.schemaId}" at v${targetVersion}: ${err?.message}`,
          { schemaId: record.schemaId, targetVersion }
        );
      }
    }

    return {
      ...record,
      schemaVersion: targetVersion,
      payload: currentPayload as T,
      updatedAt: Date.now(),
    };
  }

  /**
   * Simple breadth-first search to find shortest migration path from fromVersion to toVersion.
   */
  private findMigrationPlan(
    schemaId: string,
    fromVersion: number,
    toVersion: number
  ): StorageMigration[] | null {
    const map = this.migrations.get(schemaId);
    if (!map) return null;

    const queue: Array<{ version: number; path: StorageMigration[] }> = [
      { version: fromVersion, path: [] },
    ];
    const visited = new Set<number>([fromVersion]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.version === toVersion) {
        return current.path;
      }

      // Check all available outgoing migrations from current.version
      for (const [key, migration] of map.entries()) {
        const [fromV, toV] = key.split(':').map(Number);
        if (fromV === current.version && !visited.has(toV) && toV <= toVersion) {
          visited.add(toV);
          queue.push({
            version: toV,
            path: [...current.path, migration],
          });
        }
      }
    }

    return null;
  }

  public reset(): void {
    this.migrations.clear();
  }
}

export const globalMigrationRegistry = MigrationRegistry.getInstance();
