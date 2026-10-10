import { TreeNodeModel, WorkspaceRootModel } from '../types';
import { normalizePath } from './FileService';
import { EXCLUDED_DIRECTORY_NAMES } from './WorkspaceService';
import { logger } from '../utils/logger';

export interface QuickOpenResource {
  id: string;
  name: string;
  relativePath: string;
  uri: string;
  handle?: FileSystemHandle;
  isFolder: boolean;
  parentPath: string;
}

export class WorkspaceIndexService {
  private resources: QuickOpenResource[] = [];
  private currentGenerationId: number = 0;
  private isIndexingActive: boolean = false;

  public getGenerationId(): number {
    return this.currentGenerationId;
  }

  public getResources(): QuickOpenResource[] {
    return [...this.resources];
  }

  public isIndexing(): boolean {
    return this.isIndexingActive;
  }

  public clearIndex(): void {
    this.currentGenerationId += 1;
    this.resources = [];
    this.isIndexingActive = false;
    logger.info('Workspace resource index cleared', { generationId: this.currentGenerationId });
  }

  /**
   * Builds resource index from tree nodes (e.g. loaded explorer tree)
   */
  public indexFromTree(rootModel: WorkspaceRootModel | null): QuickOpenResource[] {
    if (!rootModel) {
      this.clearIndex();
      return [];
    }

    const generationId = ++this.currentGenerationId;
    const items: QuickOpenResource[] = [];

    const traverse = (nodes: TreeNodeModel[], relativeParent: string) => {
      for (const node of nodes) {
        if (generationId !== this.currentGenerationId) return;

        if (EXCLUDED_DIRECTORY_NAMES.has(node.name) || (node.name.startsWith('.') && node.name !== '.env')) {
          continue;
        }

        const relPath = relativeParent ? `${relativeParent}/${node.name}` : node.name;

        if (node.kind === 'file') {
          items.push({
            id: node.uri || node.id,
            name: node.name,
            relativePath: relPath,
            uri: node.uri,
            handle: node.handle,
            isFolder: false,
            parentPath: relativeParent,
          });
        }

        if (node.children && node.children.length > 0) {
          traverse(node.children, relPath);
        }
      }
    };

    traverse(rootModel.tree, rootModel.name);

    if (generationId === this.currentGenerationId) {
      this.resources = items;
      logger.info('Workspace resources indexed from tree', { count: items.length, generationId });
    }

    return this.resources;
  }

  /**
   * Asynchronously enumerates directory handle recursively for workspace indexing without reading text content
   */
  public async indexDirectoryHandle(
    dirHandle: FileSystemDirectoryHandle,
    rootName: string = dirHandle.name,
    maxFiles: number = 5000
  ): Promise<QuickOpenResource[]> {
    const generationId = ++this.currentGenerationId;
    this.isIndexingActive = true;
    const items: QuickOpenResource[] = [];

    try {
      const scanDir = async (handle: FileSystemDirectoryHandle, relativeParent: string, depth: number) => {
        if (depth > 12 || items.length >= maxFiles || generationId !== this.currentGenerationId) {
          return;
        }

        const entries = (handle as unknown as { entries: () => AsyncIterable<[string, FileSystemHandle]> }).entries();

        for await (const [name, childHandle] of entries) {
          if (generationId !== this.currentGenerationId || items.length >= maxFiles) break;

          if (EXCLUDED_DIRECTORY_NAMES.has(name) || (name.startsWith('.') && name !== '.env')) {
            continue;
          }

          const relPath = relativeParent ? `${relativeParent}/${name}` : name;
          const nodeUri = normalizePath(`browser-fs://${relPath}`);

          if (childHandle.kind === 'file') {
            items.push({
              id: nodeUri,
              name,
              relativePath: relPath,
              uri: nodeUri,
              handle: childHandle,
              isFolder: false,
              parentPath: relativeParent,
            });
          } else if (childHandle.kind === 'directory') {
            await scanDir(childHandle as FileSystemDirectoryHandle, relPath, depth + 1);
          }
        }
      };

      await scanDir(dirHandle, rootName, 0);

      if (generationId === this.currentGenerationId) {
        this.resources = items;
        this.isIndexingActive = false;
        logger.info('Asynchronous workspace directory indexing completed', { count: items.length, generationId });
      }
    } catch (err) {
      if (generationId === this.currentGenerationId) {
        this.isIndexingActive = false;
      }
      logger.error('Workspace directory indexing error', { error: (err as Error).message });
    }

    return this.resources;
  }

  /**
   * Adds or updates a single resource entry (e.g. on Save As)
   */
  public addOrUpdateResource(resource: QuickOpenResource): void {
    const idx = this.resources.findIndex((r) => r.id === resource.id || r.uri === resource.uri);
    if (idx !== -1) {
      this.resources[idx] = resource;
    } else {
      this.resources.push(resource);
    }
  }
}

export const workspaceIndexService = new WorkspaceIndexService();
