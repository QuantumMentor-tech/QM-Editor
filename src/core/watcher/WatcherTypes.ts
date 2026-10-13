/**
 * QM Editor Filesystem Watcher & External Change Reconciliation — Types & Contracts
 * Phase 04, Step 32 — Core Engine Subsystem
 */

export type FileSystemChangeType = 'create' | 'modify' | 'delete' | 'rename';

export interface RawFileSystemEvent {
  uri: string;
  type: FileSystemChangeType;
  oldUri?: string;
  timestamp: number;
  handle?: FileSystemHandle;
  workspaceGeneration?: number;
}

export interface CoalescedFileSystemEvent {
  uri: string;
  type: FileSystemChangeType;
  oldUri?: string;
  timestamp: number;
  handle?: FileSystemHandle;
  workspaceGeneration?: number;
}

export interface WatcherSubscriptionOptions {
  id?: string;
  recursive?: boolean;
  workspaceGeneration?: number;
  excludes?: string[];
}

export interface WatcherSubscription {
  id: string;
  targetUri: string;
  recursive: boolean;
  workspaceGeneration?: number;
  excludes: string[];
  onEvents: (events: CoalescedFileSystemEvent[]) => void;
  disposed: boolean;
}

// ---------------------------------------------------------------------------
// Native Watcher Abstraction & Health Contracts
// ---------------------------------------------------------------------------

export interface WatchHandle {
  id: string;
  rootUri: string;
  recursive: boolean;
  stop: () => Promise<void>;
}

export interface FileWatchAdapter {
  readonly name: string;
  isAvailable(): boolean;
  watch(
    rootUri: string,
    onEvent: (event: RawFileSystemEvent) => void,
    options?: WatcherSubscriptionOptions
  ): Promise<WatchHandle>;
  dispose(): Promise<void>;
}

export interface WatcherHealthReport {
  status: 'healthy' | 'degraded' | 'disabled' | 'error';
  activeWatchersCount: number;
  activeSubscriptionsCount: number;
  adapterName: string;
  lastError?: string;
  uptimeMs?: number;
}

// ---------------------------------------------------------------------------
// Change Classification & Correlation Contracts
// ---------------------------------------------------------------------------

export type ChangeClassificationType =
  | 'unopened_resource'
  | 'clean_document_reload'
  | 'dirty_document_conflict'
  | 'external_delete'
  | 'external_rename'
  | 'external_recreate'
  | 'internal_save'
  | 'ignored_path';

export interface ClassifiedResourceChange {
  uri: string;
  type: FileSystemChangeType;
  classification: ChangeClassificationType;
  documentId?: string;
  oldUri?: string;
  timestamp: number;
  workspaceGeneration: number;
  conflictReason?: string;
  newContent?: string;
}

export interface SaveCorrelationTicket {
  operationId: string;
  workspaceId?: string;
  resourceUri: string;
  expectedRevision?: number;
  timestamp: number;
  expiresAt: number;
}

export type ExternalChangeConflictState =
  | 'none'
  | 'conflict_detected'
  | 'reloaded'
  | 'deleted_on_disk';

export interface ReconciledDocumentResult {
  documentId: string;
  uri: string;
  status: 'reloaded' | 'conflict' | 'orphaned' | 'renamed' | 'ignored';
  conflictReason?: string;
  newContent?: string;
}

export interface WatcherEventMap {
  'watcher.eventsCoalesced': {
    events: CoalescedFileSystemEvent[];
    batchCount: number;
  };
  'watcher.subscriptionAdded': {
    subscriptionId: string;
    targetUri: string;
    recursive: boolean;
  };
  'watcher.subscriptionDisposed': {
    subscriptionId: string;
    targetUri: string;
  };
  'watcher.rootStarted': {
    rootUri: string;
    handleId: string;
  };
  'watcher.rootStopped': {
    rootUri: string;
    handleId: string;
  };
  'watcher.healthChanged': {
    health: WatcherHealthReport;
  };
  'watcher.externalChangeDetected': {
    uri: string;
    type: FileSystemChangeType;
    oldUri?: string;
  };
  'watcher.conflictDetected': {
    documentId: string;
    uri: string;
    localRevision: number;
  };
  'watcher.conflictResolved': {
    documentId: string;
    uri: string;
    resolution: 'keep_local' | 'revert_disk';
  };
  'synchronization.changeClassified': {
    change: ClassifiedResourceChange;
  };
  'synchronization.documentReloaded': {
    documentId: string;
    resourceUri: string;
    newRevision: number;
  };
  'synchronization.conflictDetected': {
    documentId: string;
    resourceUri: string;
    localRevision: number;
    reason: string;
  };
  'synchronization.resourceDeleted': {
    documentId?: string;
    resourceUri: string;
  };
  'synchronization.resourceRenamed': {
    documentId?: string;
    oldResourceUri: string;
    newResourceUri: string;
  };
  'synchronization.resourceRecreated': {
    documentId?: string;
    resourceUri: string;
  };
}

export type WatcherEventKey = keyof WatcherEventMap;
export type WatcherEventListener<K extends WatcherEventKey> = (
  payload: WatcherEventMap[K]
) => void | Promise<void>;

