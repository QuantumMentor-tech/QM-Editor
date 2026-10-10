/**
 * QM Editor Source Control Service
 * Phase 1, Step 18 — Git Integration & Source Control Foundation
 */

import {
  GitRepositoryState,
  SourceControlDiffResult,
  SourceControlFileStatus,
  SourceControlProvider,
} from './SourceControlTypes';
import { defaultGitProvider } from './GitProvider';
import { WorkspaceRootModel } from '../../types';
import { logger } from '../../utils/logger';

export class SourceControlService {
  private activeProvider: SourceControlProvider = defaultGitProvider;
  private currentGenerationId = 0;
  private stateListeners: Set<(state: GitRepositoryState) => void> = new Set();
  private currentState: GitRepositoryState = {
    repositoryId: '',
    providerId: defaultGitProvider.id,
    repositoryRoot: '',
    displayName: '',
    isGitRepository: false,
    currentBranch: null,
    isDetachedHead: false,
    headCommit: null,
    fileStatuses: new Map(),
    stagedFiles: [],
    workingTreeFiles: [],
    untrackedFiles: [],
    conflictedFiles: [],
    isLoading: false,
    error: null,
    lastRefreshedTimestamp: 0,
  };

  /**
   * Returns current active repository state snapshot
   */
  public getState(): GitRepositoryState {
    return this.currentState;
  }

  /**
   * Registers listener for repository state updates
   */
  public subscribe(listener: (state: GitRepositoryState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.currentState);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.stateListeners.forEach((listener) => {
      try {
        listener(this.currentState);
      } catch (err) {
        logger.error('Error in SourceControlService state listener', { error: (err as Error).message });
      }
    });
  }

  /**
   * Refreshes Git repository status with async generation token protection
   */
  public async refresh(workspaceRoot: WorkspaceRootModel | null): Promise<GitRepositoryState> {
    const generationId = ++this.currentGenerationId;

    this.currentState = {
      ...this.currentState,
      isLoading: true,
      error: null,
    };
    this.notifyListeners();

    try {
      const newState = await this.activeProvider.getRepositoryState(workspaceRoot);

      // Verify request is still current
      if (generationId !== this.currentGenerationId) {
        logger.info('Discarding stale source control refresh response', { generationId, current: this.currentGenerationId });
        return this.currentState;
      }

      this.currentState = newState;
      this.notifyListeners();
      return this.currentState;
    } catch (err) {
      if (generationId !== this.currentGenerationId) {
        return this.currentState;
      }

      const errMsg = (err as Error).message || 'Failed to inspect Git status';
      logger.error('Source control refresh error', { error: errMsg });

      this.currentState = {
        ...this.currentState,
        isLoading: false,
        error: errMsg,
      };
      this.notifyListeners();
      return this.currentState;
    }
  }

  /**
   * Updates dirty or untracked status of an individual file resource in state
   */
  public updateFileStatus(fileUri: string, statusType: SourceControlFileStatus['displayStatus']): void {
    if (!fileUri || !this.currentState.isGitRepository) return;

    const key = fileUri.toLowerCase();
    const existing = this.currentState.fileStatuses.get(key);
    const relativePath = existing ? existing.relativePath : fileUri.split('/').pop() || fileUri;

    const updatedStatus: SourceControlFileStatus = {
      path: fileUri,
      relativePath,
      repositoryId: this.currentState.repositoryId,
      indexStatus: existing?.indexStatus || 'unmodified',
      workingTreeStatus: statusType,
      displayStatus: statusType,
      isConflict: statusType === 'conflict',
      isIgnored: statusType === 'ignored',
      isUntracked: statusType === 'untracked',
    };

    const newStatuses = new Map(this.currentState.fileStatuses);
    newStatuses.set(key, updatedStatus);

    const workingTreeFiles = Array.from(newStatuses.values()).filter(
      (s) => s.displayStatus === 'modified' || s.displayStatus === 'deleted'
    );
    const untrackedFiles = Array.from(newStatuses.values()).filter((s) => s.isUntracked);
    const stagedFiles = Array.from(newStatuses.values()).filter((s) => s.displayStatus === 'staged');
    const conflictedFiles = Array.from(newStatuses.values()).filter((s) => s.isConflict);

    this.currentState = {
      ...this.currentState,
      fileStatuses: newStatuses,
      workingTreeFiles,
      untrackedFiles,
      stagedFiles,
      conflictedFiles,
      lastRefreshedTimestamp: Date.now(),
    };
    this.notifyListeners();
  }

  /**
   * Fetches read-only diff model for target file
   */
  public async getDiff(fileUri: string, workspaceRoot: WorkspaceRootModel | null): Promise<SourceControlDiffResult> {
    return await this.activeProvider.getDiff(fileUri, workspaceRoot);
  }
}

export const sourceControlService = new SourceControlService();
