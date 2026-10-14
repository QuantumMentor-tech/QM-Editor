/**
 * QM Editor In-Memory Storage Adapter
 * Phase 05, Step 46 — Data & Storage Architecture Foundation
 */

import { IStorageAdapter, StoredRecord, StorageScope } from '../StorageTypes';
import { StorageReadOnlyError } from '../StorageErrors';

export class MemoryStorageAdapter implements IStorageAdapter {
  public readonly name = 'MemoryStorageAdapter';
  private records = new Map<string, string>(); // store serialized to emulate disk/db boundaries
  private readOnly: boolean = false;
  private isInitialized: boolean = false;

  public async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  public isReadOnly(): boolean {
    return this.readOnly;
  }

  public setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
  }

  public async get<T = unknown>(key: string): Promise<StoredRecord<T> | null> {
    const raw = this.records.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as StoredRecord<T>;
  }

  public async set<T = unknown>(record: StoredRecord<T>): Promise<void> {
    if (this.readOnly) {
      throw new StorageReadOnlyError();
    }
    this.records.set(record.key, JSON.stringify(record));
  }

  public async delete(key: string): Promise<boolean> {
    if (this.readOnly) {
      throw new StorageReadOnlyError();
    }
    return this.records.delete(key);
  }

  public async has(key: string): Promise<boolean> {
    return this.records.has(key);
  }

  public async listKeys(prefix?: string): Promise<string[]> {
    const keys = Array.from(this.records.keys());
    if (!prefix) return keys;
    return keys.filter((k) => k.startsWith(prefix));
  }

  public async clear(scope?: StorageScope, workspaceId?: string): Promise<void> {
    if (this.readOnly) {
      throw new StorageReadOnlyError();
    }

    if (!scope && !workspaceId) {
      this.records.clear();
      return;
    }

    for (const [key, raw] of this.records.entries()) {
      try {
        const record = JSON.parse(raw) as StoredRecord;
        const matchesScope = !scope || record.scope === scope;
        const matchesWs = !workspaceId || record.workspaceId === workspaceId;
        if (matchesScope && matchesWs) {
          this.records.delete(key);
        }
      } catch {
        // Corrupted record, delete if clearing
        this.records.delete(key);
      }
    }
  }

  public async dispose(): Promise<void> {
    this.records.clear();
    this.isInitialized = false;
  }
}
