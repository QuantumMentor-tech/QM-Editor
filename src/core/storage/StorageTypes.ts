/**
 * QM Editor Storage & Persistence Types
 * Phase 05, Step 46 — Data & Storage Architecture Foundation
 */

export type StorageScope = 'application' | 'workspace';

export type DataClassification =
  | 'persistent'
  | 'session'
  | 'derived'
  | 'cache'
  | 'temporary'
  | 'external-authoritative';

export type StorageHealthState =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'degraded'
  | 'recoveryRequired'
  | 'failed'
  | 'shuttingDown'
  | 'disposed';

export interface StorageHealthIssue {
  readonly message: string;
  readonly severity: 'warning' | 'error';
  readonly timestamp: number;
}

export interface StorageHealthReport {
  readonly state: StorageHealthState;
  readonly adapterName: string;
  readonly isReadOnly: boolean;
  readonly activeMigrations: number;
  readonly corruptedRecordCount: number;
  readonly lastCheckedAt: number;
  readonly issues: StorageHealthIssue[];
}

/**
 * Envelope for any structured record stored durably.
 * Enforces schema versioning, optimistic concurrency record versions,
 * timestamps, and scope boundaries.
 */
export interface StoredRecord<T = unknown> {
  readonly key: string;
  readonly schemaId: string;
  readonly schemaVersion: number;
  readonly recordVersion: number;
  readonly scope: StorageScope;
  readonly workspaceId?: string;
  readonly payload: T;
  readonly checksum?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * Pluggable physical storage adapter interface.
 */
export interface IStorageAdapter {
  readonly name: string;
  initialize(): Promise<void>;
  get<T = unknown>(key: string): Promise<StoredRecord<T> | null>;
  set<T = unknown>(record: StoredRecord<T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  listKeys(prefix?: string): Promise<string[]>;
  clear(scope?: StorageScope, workspaceId?: string): Promise<void>;
  isReadOnly(): boolean;
  setReadOnly(readOnly: boolean): void;
  dispose(): Promise<void>;
}

/**
 * Schema definition with runtime validator.
 */
export interface StorageSchemaDefinition<T = unknown> {
  readonly schemaId: string;
  readonly currentVersion: number;
  readonly description: string;
  validate(data: unknown): data is T;
  sanitize?(data: T): T;
}

/**
 * Explicit, ordered schema migration contract.
 */
export interface StorageMigration<TFrom = any, TTo = any> {
  readonly schemaId: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly description: string;
  migrate(from: TFrom): Promise<TTo> | TTo;
}

/**
 * Storage read and write options.
 */
export interface StorageReadOptions {
  readonly expectedSchemaVersion?: number;
  readonly autoMigrate?: boolean;
}

export interface StorageWriteOptions {
  readonly expectedRecordVersion?: number;
  readonly skipValidation?: boolean;
}

/**
 * Central Storage Service public contract.
 */
export interface IStorageService {
  initialize(): Promise<void>;
  getHealth(): StorageHealthReport;
  read<T>(
    key: string,
    schemaId: string,
    options?: StorageReadOptions
  ): Promise<StoredRecord<T> | null>;
  write<T>(
    key: string,
    schemaId: string,
    payload: T,
    scope: StorageScope,
    workspaceId?: string,
    options?: StorageWriteOptions
  ): Promise<StoredRecord<T>>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  listKeys(prefix?: string): Promise<string[]>;
  clearWorkspace(workspaceId: string): Promise<void>;
  dispose(): Promise<void>;
  reset(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Standard Domain DTOs
// ---------------------------------------------------------------------------

export interface UserSettingsDTO {
  readonly [key: string]: unknown;
}

export interface WorkspaceSettingsDTO {
  readonly [key: string]: unknown;
}

export interface WorkspaceMetadataDTO {
  readonly id: string;
  readonly name: string;
  readonly roots: Array<{ rootId: string; uri: string; name: string }>;
  readonly createdAt: number;
  readonly lastActiveAt: number;
}

export interface WorkspaceSessionDTO {
  readonly version: number;
  readonly openFilePaths: string[];
  readonly activeFilePath?: string;
  readonly lastLocations?: Record<string, { line: number; column: number }>;
  readonly timestamp: number;
}

export interface RecentWorkspaceDTO {
  readonly path: string;
  readonly name: string;
  readonly lastOpened: number;
}

export interface RecentDocumentDTO {
  readonly path: string;
  readonly name: string;
  readonly lastOpened: number;
  readonly line?: number;
  readonly column?: number;
  readonly workspaceId?: string;
}

export interface DocumentMetadataDTO {
  readonly version: number;
  readonly resourceUri: string;
  readonly workspaceId: string;
  readonly languageId: string;
  readonly isManualLanguage?: boolean;
  readonly encoding: string;
  readonly isManualEncoding?: boolean;
  readonly lineEnding?: 'lf' | 'crlf' | 'cr';
  readonly isReadOnly?: boolean;
  readonly readOnlyReason?: string;
  readonly lastKnownSize?: number;
  readonly lastKnownModifiedTime?: number;
  readonly lastOpenedAt: number;
  readonly lastSavedAt?: number;
  readonly cursorPosition?: { line: number; column: number };
  readonly pinned?: boolean;
}

export interface ResourceStateDTO {
  readonly version: number;
  readonly resourceUri: string;
  readonly workspaceId: string;
  readonly basename: string;
  readonly scheme: 'file' | 'browser-fs' | 'virtual';
  readonly exists: boolean;
  readonly lastKnownModifiedTime?: number;
  readonly lastKnownSize?: number;
  readonly lastCheckedAt: number;
}

