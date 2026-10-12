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
}

export type WatcherEventKey = keyof WatcherEventMap;
export type WatcherEventListener<K extends WatcherEventKey> = (
  payload: WatcherEventMap[K]
) => void | Promise<void>;
