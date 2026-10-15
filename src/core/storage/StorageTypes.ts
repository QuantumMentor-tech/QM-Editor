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
  readonly kind?: 'file' | 'folder';
  readonly accessCount?: number;
}

export interface RecentResourceDTO {
  readonly resourceUri: string;
  readonly name: string;
  readonly lastAccessedAt: number;
  readonly kind: 'file' | 'folder';
  readonly workspaceId?: string;
  readonly accessCount?: number;
  readonly line?: number;
  readonly column?: number;
}

export interface PersistentNavigationLocationDTO {
  readonly uri: string;
  readonly line: number;
  readonly column: number;
  readonly endLine?: number;
  readonly endColumn?: number;
  readonly workspaceId?: string;
  readonly resourceId?: string;
  readonly documentTitle?: string;
  readonly timestamp: number;
}

export interface NavigationHistoryDTO {
  readonly version: number;
  readonly backStack: PersistentNavigationLocationDTO[];
  readonly forwardStack: PersistentNavigationLocationDTO[];
  readonly currentLocation: PersistentNavigationLocationDTO | null;
  readonly updatedAt: number;
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

export interface ResourceIndexEntryDTO {
  readonly resourceId: string;
  readonly workspaceId: string;
  readonly uri: string;
  readonly relativePath: string;
  readonly name: string;
  readonly kind: 'file' | 'directory';
  readonly parentPath: string;
  readonly size?: number;
  readonly modifiedAt?: number;
  readonly fingerprint?: string;
  readonly isBinary?: boolean;
  readonly indexedAt: number;
}

export interface WorkspaceIndexDTO {
  readonly version: number; // schema version 1
  readonly formatVersion: number; // index format version 1
  readonly workspaceId: string;
  readonly rootUri: string;
  readonly indexGeneration: number;
  readonly workspaceGeneration: number;
  readonly entries: ResourceIndexEntryDTO[];
  readonly totalFiles: number;
  readonly status: 'fresh' | 'stale' | 'rebuilding' | 'partial';
  readonly indexedAt: number;
}

// ---------------------------------------------------------------------------
// Document Recovery, Autosave & Crash-Safe Unsaved Work DTOs (Step 52)
// ---------------------------------------------------------------------------

export type RecoverySessionState = 'active' | 'clean' | 'candidate' | 'restored' | 'discarded';

export interface RecoverySessionDTO {
  readonly sessionId: string;
  readonly workspaceId?: string;
  readonly startedAt: number;
  readonly lastUpdatedAt: number;
  readonly state: RecoverySessionState;
  readonly schemaVersion: number;
}

export interface RecoveryBaseFileMetadataDTO {
  readonly path?: string;
  readonly size?: number;
  readonly modifiedAt?: number;
  readonly fingerprint?: string;
}

export interface RecoveryDocumentDTO {
  readonly recoveryId: string;
  readonly sessionId: string;
  readonly workspaceId?: string;
  readonly documentId: string;
  readonly resourceUri?: string; // undefined for untitled documents
  readonly isUntitled: boolean;
  readonly documentTitle: string;
  readonly documentRevision: number;
  readonly recoveryGeneration: number;
  readonly dirty: boolean;
  readonly baseFileMetadata?: RecoveryBaseFileMetadataDTO;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface RecoveryManifestDTO {
  readonly version: number; // schema version 1
  readonly sessionId: string;
  readonly workspaceId?: string;
  readonly startedAt: number;
  readonly lastUpdatedAt: number;
  readonly state: RecoverySessionState;
  readonly documents: RecoveryDocumentDTO[];
}

export interface RecoverySnapshotDTO {
  readonly version: number; // schema version 1
  readonly recoveryId: string;
  readonly sessionId: string;
  readonly documentId: string;
  readonly resourceUri?: string;
  readonly isUntitled: boolean;
  readonly documentRevision: number;
  readonly recoveryGeneration: number;
  readonly content: string;
  readonly encoding: string;
  readonly lineEnding: 'lf' | 'crlf' | 'cr';
  readonly baseFileMetadata?: RecoveryBaseFileMetadataDTO;
  readonly checksum: string;
  readonly createdAt: number;
}

// ---------------------------------------------------------------------------
// Local History & Document Snapshots DTOs (Step 53)
// ---------------------------------------------------------------------------

export type LocalHistorySource =
  | 'save'
  | 'manual'
  | 'preRestore'
  | 'externalSync'
  | 'transformation';

export interface LocalHistoryEntryDTO {
  readonly id: string;
  readonly historyEntryId?: string;
  readonly resourceUri: string;
  readonly workspaceId?: string;
  readonly documentId?: string;
  readonly createdAt: number;
  readonly source: LocalHistorySource;
  readonly documentRevision: number;
  readonly contentHash: string;
  readonly contentSize: number;
  readonly encoding: string;
  readonly lineEnding: 'lf' | 'crlf' | 'cr';
  readonly languageId: string;
  readonly label?: string;
}

export interface LocalHistorySnapshotDTO {
  readonly version: number; // schema version 1
  readonly id: string; // historyEntryId
  readonly content: string;
  readonly contentHash: string;
  readonly createdAt: number;
}

export interface LocalHistoryManifestDTO {
  readonly version: number; // schema version 1
  readonly resourceUri: string;
  readonly workspaceId?: string;
  readonly entries: LocalHistoryEntryDTO[];
  readonly lastUpdatedAt: number;
}

