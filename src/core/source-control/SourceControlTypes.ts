/**
 * QM Editor Source Control Core Types & Interfaces
 * Phase 1, Step 18 — Git Integration & Source Control Foundation
 */

import { WorkspaceRootModel } from '../../types';

export type GitStatusType =
  | 'unmodified'
  | 'modified'
  | 'staged'
  | 'untracked'
  | 'deleted'
  | 'renamed'
  | 'conflict'
  | 'ignored'
  | 'unknown';

export interface SourceControlFileStatus {
  path: string;
  relativePath: string;
  repositoryId: string;
  indexStatus: GitStatusType;
  workingTreeStatus: GitStatusType;
  displayStatus: GitStatusType;
  isConflict: boolean;
  isIgnored: boolean;
  isUntracked: boolean;
}

export interface GitRepositoryState {
  repositoryId: string;
  providerId: string;
  repositoryRoot: string;
  displayName: string;
  isGitRepository: boolean;
  currentBranch: string | null;
  isDetachedHead: boolean;
  headCommit: string | null;
  fileStatuses: Map<string, SourceControlFileStatus>;
  stagedFiles: SourceControlFileStatus[];
  workingTreeFiles: SourceControlFileStatus[];
  untrackedFiles: SourceControlFileStatus[];
  conflictedFiles: SourceControlFileStatus[];
  isLoading: boolean;
  error: string | null;
  lastRefreshedTimestamp: number;
}

export interface SourceControlDiffResult {
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  isBinary: boolean;
  error?: string;
}

export interface SourceControlProvider {
  readonly id: string;
  readonly label: string;
  detectRepository(workspaceRoot: WorkspaceRootModel | null): Promise<boolean>;
  getRepositoryState(workspaceRoot: WorkspaceRootModel | null): Promise<GitRepositoryState>;
  getDiff(fileUri: string, workspaceRoot: WorkspaceRootModel | null): Promise<SourceControlDiffResult>;
}
