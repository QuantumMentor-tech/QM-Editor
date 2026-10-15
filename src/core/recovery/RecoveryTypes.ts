/**
 * QM Editor Document Recovery Types & Interfaces
 * Phase 05, Step 52 — Document Recovery, Autosave & Crash-Safe Unsaved Work Foundation
 */

import {
  RecoveryDocumentDTO,
  RecoverySnapshotDTO,
  RecoverySessionState,
} from '../storage/StorageTypes';

export type RecoveryDecisionState =
  | 'no_recovery_needed'
  | 'recovery_available'
  | 'disk_newer'
  | 'conflict'
  | 'original_missing'
  | 'untitled_recovery'
  | 'corrupt'
  | 'stale';

export interface RecoveryCandidateEvaluation {
  readonly candidate: RecoveryDocumentDTO;
  readonly decision: RecoveryDecisionState;
  readonly explanation: string;
  readonly snapshot?: RecoverySnapshotDTO;
  readonly diskStats?: {
    size?: number;
    modifiedAt?: number;
    exists: boolean;
  };
}

export interface RecoveryDiscoveryResult {
  readonly previousSessionId?: string;
  readonly previousSessionState?: RecoverySessionState;
  readonly wasAbnormalTermination: boolean;
  readonly candidates: RecoveryCandidateEvaluation[];
}

export interface RecoveryRestoreResult {
  readonly recoveryId: string;
  readonly documentId?: string;
  readonly restoredTitle: string;
  readonly isUntitled: boolean;
  readonly isDirty: boolean;
  readonly status: 'restored' | 'failed';
  readonly error?: string;
}

export interface RecoveryCoordinatorOptions {
  readonly autoSaveDelayMs?: number;
  readonly enabled?: boolean;
}

export type RecoveryHealthState = 'ready' | 'degraded' | 'unavailable' | 'disabled';

export interface RecoveryHealthReport {
  readonly state: RecoveryHealthState;
  readonly activeSessionId: string;
  readonly pendingSnapshotsCount: number;
  readonly activeCandidatesCount: number;
  readonly lastSnapshotAt?: number;
  readonly issues: string[];
}
