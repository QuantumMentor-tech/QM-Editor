/**
 * QM Editor Workspace Indexing & Derived Data Types
 * Phase 05, Step 51 — Persistent Workspace Indexes, Search Cache & Derived Data Storage
 */

import type { ResourceIndexEntryDTO, WorkspaceIndexDTO } from '../storage/StorageTypes';

export type { ResourceIndexEntryDTO, WorkspaceIndexDTO };

export type IndexFreshness = 'fresh' | 'partiallyFresh' | 'stale' | 'invalid' | 'missing';

export type IndexStatus =
  | 'uninitialized'
  | 'loading'
  | 'ready'
  | 'fresh'
  | 'stale'
  | 'rebuilding'
  | 'partial'
  | 'degraded'
  | 'failed'
  | 'disposed';

export interface IndexValidationResult {
  readonly isValid: boolean;
  readonly freshness: IndexFreshness;
  readonly reason?: string;
}

export interface IndexReconcileResult {
  readonly added: number;
  readonly removed: number;
  readonly updated: number;
  readonly total: number;
}

/**
 * Computes a lightweight advisory fingerprint from file metadata.
 */
export function computeResourceFingerprint(size?: number, modifiedAt?: number): string {
  const s = typeof size === 'number' && size >= 0 ? size : 0;
  const m = typeof modifiedAt === 'number' && modifiedAt >= 0 ? modifiedAt : 0;
  return `${s}:${m}`;
}
