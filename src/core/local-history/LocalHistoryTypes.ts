/**
 * QM Editor Local History Types & Interfaces
 * Phase 05, Step 53 — Local History, Document Snapshots & Versioned Content Persistence
 */

import {
  LocalHistoryEntryDTO,
  LocalHistorySource,
  LocalHistorySnapshotDTO,
  LocalHistoryManifestDTO,
} from '../storage/StorageTypes';

export type {
  LocalHistoryEntryDTO,
  LocalHistorySource,
  LocalHistorySnapshotDTO,
  LocalHistoryManifestDTO,
};

export interface HistoryPreview {
  readonly valid: boolean;
  readonly entry?: LocalHistoryEntryDTO;
  readonly snapshot?: LocalHistorySnapshotDTO;
  readonly historicalContent?: string;
  readonly currentContent?: string;
  readonly isIdenticalToCurrent?: boolean;
  readonly hasDifference?: boolean;
  readonly error?: string;
  readonly diffStats?: {
    addedLines: number;
    removedLines: number;
    totalLines: number;
  };
}

export interface HistoryRestoreOptions {
  /**
   * If true (default), creates a safety pre-restore snapshot of the current content before applying the historical version.
   */
  readonly createPreRestoreSnapshot?: boolean;
  /**
   * Optional custom label for the restore operation
   */
  readonly label?: string;
}

export interface HistoryRestoreResult {
  readonly success: boolean;
  readonly status: 'restored' | 'failed' | 'rejected';
  readonly entryId: string;
  readonly documentId?: string;
  readonly preRestoreEntryId?: string;
  readonly preRestoreSnapshotId?: string;
  readonly error?: string;
}

export interface LocalHistoryOptions {
  readonly enabled?: boolean;
  readonly maxEntriesPerFile?: number;
  readonly retentionDays?: number;
  readonly maxStorageBytes?: number;
}

export type LocalHistoryHealthState = 'ready' | 'degraded' | 'unavailable' | 'disabled';

export interface LocalHistoryHealthReport {
  readonly state: LocalHistoryHealthState;
  readonly enabled: boolean;
  readonly healthy: boolean;
  readonly entryCount: number;
  readonly totalEntriesCount: number;
  readonly totalResourcesCount: number;
  readonly storageBytesUsed: number;
  readonly issues: string[];
}
