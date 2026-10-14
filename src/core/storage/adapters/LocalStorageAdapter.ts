/**
 * QM Editor LocalStorage Storage Adapter
 * Phase 05, Step 46 — Data & Storage Architecture Foundation
 */

import { IStorageAdapter, StoredRecord, StorageScope } from '../StorageTypes';
import { StorageReadOnlyError } from '../StorageErrors';
import { logger } from '../../../utils/logger';

export class LocalStorageAdapter implements IStorageAdapter {
  public readonly name = 'LocalStorageAdapter';
  private readonly keyPrefix: string;
  private readonly memoryFallback = new Map<string, string>();
  private readOnly: boolean = false;
  private useMemoryFallback: boolean = false;

  constructor(keyPrefix: string = 'qm_record_') {
    this.keyPrefix = keyPrefix;
  }

  public async initialize(): Promise<void> {
    try {
      if (typeof localStorage === 'undefined' || !localStorage.getItem) {
        this.useMemoryFallback = true;
        logger.info('LocalStorage unavailable; LocalStorageAdapter operating with memory fallback.');
      } else {
        // Test write capability
        const testKey = `__qm_storage_test_${Date.now()}__`;
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
      }
    } catch (err) {
      this.useMemoryFallback = true;
      logger.warn('LocalStorage test write failed; switching to in-memory fallback.', err);
    }
  }

  public isReadOnly(): boolean {
    return this.readOnly;
  }

  public setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
  }

  private toStorageKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private fromStorageKey(storageKey: string): string | null {
    if (!storageKey.startsWith(this.keyPrefix)) return null;
    return storageKey.slice(this.keyPrefix.length);
  }

  public async get<T = unknown>(key: string): Promise<StoredRecord<T> | null> {
    const storageKey = this.toStorageKey(key);
    let raw: string | null = null;

    if (this.useMemoryFallback) {
      raw = this.memoryFallback.get(storageKey) || null;
    } else {
      try {
        raw = localStorage.getItem(storageKey);
      } catch (err) {
        logger.error(`Failed to read key "${key}" from localStorage.`, err);
        raw = this.memoryFallback.get(storageKey) || null;
      }
    }

    if (!raw) return null;

    try {
      return JSON.parse(raw) as StoredRecord<T>;
    } catch (err) {
      logger.warn(`Corrupted record detected at key "${key}". Quarantining record.`, err);
      // Quarantine corrupted record
      this.quarantineRecord(key, raw);
      return null;
    }
  }

  public async set<T = unknown>(record: StoredRecord<T>): Promise<void> {
    if (this.readOnly) {
      throw new StorageReadOnlyError();
    }

    const storageKey = this.toStorageKey(record.key);
    const serialized = JSON.stringify(record);

    if (this.useMemoryFallback) {
      this.memoryFallback.set(storageKey, serialized);
      return;
    }

    try {
      // Safe write: write to temp key, then commit
      const tempKey = `${storageKey}__tmp`;
      localStorage.setItem(tempKey, serialized);
      localStorage.setItem(storageKey, serialized);
      localStorage.removeItem(tempKey);
    } catch (err: any) {
      if (err?.name === 'QuotaExceededError' || err?.code === 22) {
        this.readOnly = true;
        throw new StorageReadOnlyError('Storage quota exceeded; storage entered read-only mode.');
      }
      // Fall back to memory for this record
      this.memoryFallback.set(storageKey, serialized);
      logger.error(`LocalStorage write failed for "${record.key}"; saved to memory fallback.`, err);
    }
  }

  public async delete(key: string): Promise<boolean> {
    if (this.readOnly) {
      throw new StorageReadOnlyError();
    }

    const storageKey = this.toStorageKey(key);
    let deleted = false;

    if (this.useMemoryFallback) {
      deleted = this.memoryFallback.delete(storageKey);
    } else {
      try {
        if (localStorage.getItem(storageKey) !== null) {
          localStorage.removeItem(storageKey);
          deleted = true;
        }
      } catch (err) {
        logger.error(`LocalStorage delete failed for "${key}".`, err);
      }
    }

    return deleted;
  }

  public async has(key: string): Promise<boolean> {
    const storageKey = this.toStorageKey(key);
    if (this.useMemoryFallback) {
      return this.memoryFallback.has(storageKey);
    }
    try {
      return localStorage.getItem(storageKey) !== null;
    } catch {
      return this.memoryFallback.has(storageKey);
    }
  }

  public async listKeys(prefix?: string): Promise<string[]> {
    const result: string[] = [];
    const searchPrefix = prefix ? `${this.keyPrefix}${prefix}` : this.keyPrefix;

    if (this.useMemoryFallback) {
      for (const k of this.memoryFallback.keys()) {
        if (k.startsWith(searchPrefix)) {
          const appKey = this.fromStorageKey(k);
          if (appKey) result.push(appKey);
        }
      }
      return result;
    }

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(searchPrefix)) {
          const appKey = this.fromStorageKey(k);
          if (appKey) result.push(appKey);
        }
      }
    } catch (err) {
      logger.error('Failed to enumerate localStorage keys.', err);
    }

    return result;
  }

  public async clear(scope?: StorageScope, workspaceId?: string): Promise<void> {
    if (this.readOnly) {
      throw new StorageReadOnlyError();
    }

    const keys = await this.listKeys();
    for (const key of keys) {
      const record = await this.get(key);
      if (!record) {
        await this.delete(key);
        continue;
      }

      const matchesScope = !scope || record.scope === scope;
      const matchesWs = !workspaceId || record.workspaceId === workspaceId;
      if (matchesScope && matchesWs) {
        await this.delete(key);
      }
    }
  }

  private quarantineRecord(key: string, corruptContent: string): void {
    const quarantineKey = `qm_corrupted_${key}_${Date.now()}`;
    try {
      if (!this.useMemoryFallback && typeof localStorage !== 'undefined') {
        localStorage.setItem(quarantineKey, corruptContent);
        localStorage.removeItem(this.toStorageKey(key));
      } else {
        this.memoryFallback.set(quarantineKey, corruptContent);
        this.memoryFallback.delete(this.toStorageKey(key));
      }
    } catch (err) {
      logger.error(`Failed to quarantine corrupted record "${key}".`, err);
    }
  }

  public async dispose(): Promise<void> {
    this.memoryFallback.clear();
  }
}
