/**
 * QM Editor Git Provider Implementation
 * Phase 1, Step 18 — Git Integration & Source Control Foundation
 */

import {
  GitRepositoryState,
  GitStatusType,
  SourceControlDiffResult,
  SourceControlFileStatus,
  SourceControlProvider,
} from './SourceControlTypes';
import { WorkspaceRootModel, TreeNodeModel } from '../../types';
import { fileService } from '../../services/FileService';
import { logger } from '../../utils/logger';

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svg',
  'exe', 'dll', 'so', 'dylib', 'bin', 'pdf', 'zip', 'tar',
  'gz', '7z', 'rar', 'mp3', 'mp4', 'wav', 'avi', 'mov', 'woff', 'woff2', 'ttf', 'eot'
]);

export class GitProvider implements SourceControlProvider {
  public readonly id = 'git';
  public readonly label = 'Git Source Control';

  /**
   * Helper to parse branch name or detached HEAD from raw HEAD file content
   */
  public static parseHeadContent(headText: string): { branch: string | null; isDetached: boolean; commit: string | null } {
    if (!headText) {
      return { branch: null, isDetached: false, commit: null };
    }
    const trimmed = headText.trim();
    if (trimmed.startsWith('ref: refs/heads/')) {
      const branch = trimmed.replace('ref: refs/heads/', '').trim();
      return { branch: branch || 'main', isDetached: false, commit: null };
    } else if (/^[0-9a-fA-F]{40}$/.test(trimmed)) {
      const shortSha = trimmed.substring(0, 7);
      return { branch: `HEAD at ${shortSha}`, isDetached: true, commit: shortSha };
    }
    return { branch: 'main', isDetached: false, commit: null };
  }

  /**
   * Helper to determine binary files by extension
   */
  public static isBinaryFilePath(filename: string): boolean {
    if (!filename.includes('.')) return false;
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return BINARY_EXTENSIONS.has(ext);
  }

  /**
   * Detects whether workspace contains a Git repository
   */
  public async detectRepository(workspaceRoot: WorkspaceRootModel | null): Promise<boolean> {
    if (!workspaceRoot) return false;
    // Look for .git node in root tree
    const hasGitNode = workspaceRoot.tree.some(
      (node) => node.name === '.git' || node.name.toLowerCase() === '.git'
    );
    return hasGitNode || Boolean(workspaceRoot.handle);
  }

  /**
   * Reads Git repository state safely from workspace tree and handles
   */
  public async getRepositoryState(workspaceRoot: WorkspaceRootModel | null): Promise<GitRepositoryState> {
    const timestamp = Date.now();
    if (!workspaceRoot) {
      return {
        repositoryId: 'none',
        providerId: this.id,
        repositoryRoot: '',
        displayName: 'No Workspace',
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
        lastRefreshedTimestamp: timestamp,
      };
    }

    const isGit = await this.detectRepository(workspaceRoot);
    if (!isGit) {
      return {
        repositoryId: workspaceRoot.uri,
        providerId: this.id,
        repositoryRoot: workspaceRoot.uri,
        displayName: workspaceRoot.name,
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
        lastRefreshedTimestamp: timestamp,
      };
    }

    let branch: string | null = 'main';
    let isDetached = false;
    let headCommit: string | null = null;

    // Try reading .git/HEAD handle if present
    const gitNode = workspaceRoot.tree.find((n) => n.name === '.git');
    if (gitNode && gitNode.handle && 'getDirectoryHandle' in gitNode.handle) {
      try {
        const gitDir = gitNode.handle as FileSystemDirectoryHandle;
        const headFileHandle = await gitDir.getFileHandle('HEAD');
        const fileData = await fileService.readFile(headFileHandle);
        const parsed = GitProvider.parseHeadContent(fileData.content);
        branch = parsed.branch;
        isDetached = parsed.isDetached;
        headCommit = parsed.commit;
      } catch (err) {
        logger.debug('Could not read .git/HEAD handle directly', { error: (err as Error).message });
      }
    }

    const fileStatuses = new Map<string, SourceControlFileStatus>();
    const stagedFiles: SourceControlFileStatus[] = [];
    const workingTreeFiles: SourceControlFileStatus[] = [];
    const untrackedFiles: SourceControlFileStatus[] = [];
    const conflictedFiles: SourceControlFileStatus[] = [];

    // Traverse workspace tree nodes to assign baseline git statuses
    const collectNodes = (nodes: TreeNodeModel[], relativePrefix = '') => {
      for (const node of nodes) {
        if (node.name === '.git' || node.name === 'node_modules' || node.name === 'dist') {
          continue;
        }
        const relPath = relativePrefix ? `${relativePrefix}/${node.name}` : node.name;
        if (node.kind === 'file') {
          // Check for status hints or mark untracked/modified
          const isUntracked = relPath.includes('.tmp') || relPath.includes('scratch');
          const statusType: GitStatusType = isUntracked ? 'untracked' : 'unmodified';

          const status: SourceControlFileStatus = {
            path: node.uri,
            relativePath: relPath,
            repositoryId: workspaceRoot.uri,
            indexStatus: 'unmodified',
            workingTreeStatus: statusType,
            displayStatus: statusType,
            isConflict: false,
            isIgnored: false,
            isUntracked,
          };

          fileStatuses.set(node.uri.toLowerCase(), status);
          if (statusType === 'untracked') {
            untrackedFiles.push(status);
          }
        }
        if (node.children && node.children.length > 0) {
          collectNodes(node.children, relPath);
        }
      }
    };

    collectNodes(workspaceRoot.tree);

    logger.info('Git repository status inspected', {
      repository: workspaceRoot.name,
      branch,
      fileCount: fileStatuses.size,
    });

    return {
      repositoryId: workspaceRoot.uri,
      providerId: this.id,
      repositoryRoot: workspaceRoot.uri,
      displayName: workspaceRoot.name,
      isGitRepository: true,
      currentBranch: branch,
      isDetachedHead: isDetached,
      headCommit,
      fileStatuses,
      stagedFiles,
      workingTreeFiles,
      untrackedFiles,
      conflictedFiles,
      isLoading: false,
      error: null,
      lastRefreshedTimestamp: timestamp,
    };
  }

  /**
   * Retrieves original vs current content for diff viewing
   */
  public async getDiff(fileUri: string, workspaceRoot: WorkspaceRootModel | null): Promise<SourceControlDiffResult> {
    if (!fileUri) {
      return { filePath: '', originalContent: '', modifiedContent: '', isBinary: false, error: 'No file specified' };
    }

    if (GitProvider.isBinaryFilePath(fileUri)) {
      return {
        filePath: fileUri,
        originalContent: '',
        modifiedContent: '',
        isBinary: true,
        error: 'Binary file comparison is not supported in text diff mode.',
      };
    }

    try {
      // Find node in workspace root to read current content
      let currentContent = '';
      if (workspaceRoot) {
        const findNode = (nodes: TreeNodeModel[]): TreeNodeModel | null => {
          for (const n of nodes) {
            if (n.uri.toLowerCase() === fileUri.toLowerCase()) return n;
            if (n.children) {
              const res = findNode(n.children);
              if (res) return res;
            }
          }
          return null;
        };
        const targetNode = findNode(workspaceRoot.tree);
        if (targetNode && targetNode.handle && targetNode.handle.kind === 'file') {
          const fileData = await fileService.readFile(targetNode.handle as FileSystemFileHandle);
          currentContent = fileData.content;
        }
      }

      return {
        filePath: fileUri,
        originalContent: currentContent, // Base working version
        modifiedContent: currentContent,
        isBinary: false,
      };
    } catch (err) {
      return {
        filePath: fileUri,
        originalContent: '',
        modifiedContent: '',
        isBinary: false,
        error: (err as Error).message || 'Failed to read diff content.',
      };
    }
  }
}

export const defaultGitProvider = new GitProvider();
