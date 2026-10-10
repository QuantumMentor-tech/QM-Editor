import { TreeNodeModel, WorkspaceRootModel } from '../types';
import { normalizePath } from './FileService';
import { logger } from '../utils/logger';
import { QMEditorError, ErrorCode } from '../utils/errors';

export const EXCLUDED_DIRECTORY_NAMES = new Set(['.git', 'node_modules', '.DS_Store', 'dist', '.cache']);

export interface ReadDirectoryOptions {
  requestToken?: number;
  showHiddenFiles?: boolean;
}

export class WorkspaceService {
  private activeRequestToken: number = 0;

  public getNextToken(): number {
    this.activeRequestToken += 1;
    return this.activeRequestToken;
  }

  public isTokenStale(token: number): boolean {
    return token !== this.activeRequestToken;
  }

  /**
   * Sorts tree nodes with Folders First (case-insensitive), then Files (case-insensitive)
   */
  public sortNodes(nodes: TreeNodeModel[]): TreeNodeModel[] {
    return [...nodes].sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
    });
  }

  /**
   * Enumerates directory entries using FileSystemDirectoryHandle (FileSystemAccess API)
   */
  public async readDirectory(
    dirHandle: FileSystemDirectoryHandle,
    parentId: string | null = null,
    parentUri: string = '',
    options: ReadDirectoryOptions = {}
  ): Promise<TreeNodeModel[]> {
    const token = options.requestToken ?? this.getNextToken();

    try {
      const nodes: TreeNodeModel[] = [];

      // Iterate through directory handles via async iterator
      const entries = (dirHandle as unknown as { entries: () => AsyncIterable<[string, FileSystemHandle]> }).entries();

      for await (const [name, handle] of entries) {
        // Stale token check to prevent async race condition overwrites
        if (this.isTokenStale(token)) {
          logger.info('Directory read aborted due to stale async request token', { token });
          return [];
        }

        if (!options.showHiddenFiles && (EXCLUDED_DIRECTORY_NAMES.has(name) || (name.startsWith('.') && name !== '.env'))) {
          continue;
        }

        const isDir = handle.kind === 'directory';
        const nodeUri = normalizePath(parentUri ? `${parentUri}/${name}` : `browser-fs://${name}`);
        const nodeId = nodeUri;

        const node: TreeNodeModel = {
          id: nodeId,
          name,
          kind: isDir ? 'directory' : 'file',
          uri: nodeUri,
          parentId,
          handle,
          hasChildren: isDir,
          children: isDir ? [] : undefined,
          isLoaded: !isDir,
          isLoading: false,
          error: null,
        };

        nodes.push(node);
      }

      const sorted = this.sortNodes(nodes);
      logger.info('Directory enumerated successfully', { count: sorted.length, dir: dirHandle.name });
      return sorted;
    } catch (err: unknown) {
      const errorObj = err as Error;
      logger.error('Failed to enumerate directory', { dir: dirHandle.name, error: errorObj.message });
      throw new QMEditorError(
        `Failed to enumerate directory "${dirHandle.name}": ${errorObj.message}`,
        ErrorCode.FILE_READ_ERROR,
        'error'
      );
    }
  }

  /**
   * Prompts user for directory picker (showDirectoryPicker)
   */
  public async showDirectoryPicker(): Promise<WorkspaceRootModel | null> {
    try {
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        const pickerWindow = window as unknown as {
          showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
        };
        const handle = await pickerWindow.showDirectoryPicker();
        if (!handle) return null;

        const rootUri = normalizePath(`browser-fs://${handle.name}`);
        const token = this.getNextToken();

        const rootNodes = await this.readDirectory(handle, null, rootUri, { requestToken: token });

        return {
          id: rootUri,
          name: handle.name,
          uri: rootUri,
          handle,
          tree: rootNodes,
          isLoading: false,
          error: null,
        };
      } else {
        throw new QMEditorError(
          'File System Access Directory API is not supported in this environment.',
          ErrorCode.SERVICE_UNAVAILABLE,
          'warning'
        );
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      if (errorObj.name === 'AbortError') {
        logger.info('Directory picker cancelled by user');
        return null;
      }
      if (err instanceof QMEditorError) {
        throw err;
      }
      throw new QMEditorError(`Directory picker error: ${errorObj.message}`, ErrorCode.FILE_READ_ERROR, 'error');
    }
  }
}

export const workspaceService = new WorkspaceService();
