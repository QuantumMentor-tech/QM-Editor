import { TreeNodeModel, WorkspaceRootModel } from '../types';
import { normalizePath } from './FileService';
import { EXCLUDED_DIRECTORY_NAMES } from './WorkspaceService';
import { logger } from '../utils/logger';
import { WorkspaceIndexDTO, ResourceIndexEntryDTO, IndexStatus, computeResourceFingerprint } from '../core/indexing/IndexTypes';

export interface QuickOpenResource {
  id: string;
  name: string;
  relativePath: string;
  uri: string;
  handle?: FileSystemHandle;
  isFolder: boolean;
  parentPath: string;
  size?: number;
  modifiedAt?: number;
  fingerprint?: string;
  isBinary?: boolean;
}

export class WorkspaceIndexService {
  private resources: QuickOpenResource[] = [];
  private currentGenerationId: number = 0;
  private isIndexingActive: boolean = false;
  private status: IndexStatus = 'uninitialized';

  public getGenerationId(): number {
    return this.currentGenerationId;
  }

  public getResources(): QuickOpenResource[] {
    return [...this.resources];
  }

  public isIndexing(): boolean {
    return this.isIndexingActive;
  }

  public getStatus(): IndexStatus {
    return this.status;
  }

  public setStatus(status: IndexStatus): void {
    this.status = status;
  }

  public clearIndex(): void {
    this.currentGenerationId += 1;
    this.resources = [];
    this.isIndexingActive = false;
    this.status = 'uninitialized';
    logger.info('Workspace resource index cleared', { generationId: this.currentGenerationId });
  }

  public resetForTesting(): void {
    this.resources = [];
    this.currentGenerationId = 0;
    this.isIndexingActive = false;
    this.status = 'uninitialized';
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

  /**
   * Removes a resource by its URI or ID (e.g. on external delete)
   */
  public removeResource(uriOrId: string): boolean {
    const norm = normalizePath(uriOrId);
    const initialLen = this.resources.length;
    this.resources = this.resources.filter(
      (r) => r.id !== uriOrId && r.uri !== uriOrId && normalizePath(r.uri) !== norm
    );
    return this.resources.length < initialLen;
  }

  /**
   * Updates a resource's URI, path, and name when renamed
   */
  public renameResource(oldUri: string, newUri: string): boolean {
    const normOld = normalizePath(oldUri);
    const normNew = normalizePath(newUri);
    const newName = normNew.split('/').pop() || normNew;

    let updated = false;
    this.resources = this.resources.map((r) => {
      if (r.uri === oldUri || normalizePath(r.uri) === normOld) {
        updated = true;
        const parentParts = normNew.split('/');
        parentParts.pop();
        const parentPath = parentParts.join('/');
        return {
          ...r,
          id: newUri,
          uri: newUri,
          name: newName,
          relativePath: r.relativePath.includes('/')
            ? `${r.relativePath.substring(0, r.relativePath.lastIndexOf('/'))}/${newName}`
            : newName,
          parentPath,
        };
      }
      return r;
    });

    return updated;
  }

  /**
   * Hydrates in-memory cache from a validated persistent index DTO
   */
  public loadFromDTO(dto: WorkspaceIndexDTO): void {
    this.currentGenerationId = dto.indexGeneration;
    this.resources = dto.entries.map((e) => ({
      id: e.resourceId,
      name: e.name,
      relativePath: e.relativePath,
      uri: e.uri,
      isFolder: e.kind === 'directory',
      parentPath: e.parentPath,
      size: e.size,
      modifiedAt: e.modifiedAt,
      fingerprint: e.fingerprint || computeResourceFingerprint(e.size, e.modifiedAt),
      isBinary: e.isBinary,
    }));
    this.status = dto.status || 'ready';
    this.isIndexingActive = false;
    logger.info('WorkspaceIndexService hydrated from persistent index DTO', {
      count: this.resources.length,
      generationId: this.currentGenerationId,
      status: this.status,
    });
  }

  /**
   * Serializes current in-memory resource index into a persistent DTO
   */
  public toDTO(
    workspaceId: string,
    rootUri: string,
    workspaceGeneration: number
  ): WorkspaceIndexDTO {
    const now = Date.now();
    const entries: ResourceIndexEntryDTO[] = this.resources.map((r) => ({
      resourceId: r.id || r.uri,
      workspaceId,
      uri: r.uri,
      relativePath: r.relativePath,
      name: r.name,
      kind: r.isFolder ? 'directory' : 'file',
      parentPath: r.parentPath,
      size: r.size,
      modifiedAt: r.modifiedAt,
      fingerprint: r.fingerprint || computeResourceFingerprint(r.size, r.modifiedAt),
      isBinary: r.isBinary,
      indexedAt: now,
    }));

    return {
      version: 1,
      formatVersion: 1,
      workspaceId,
      rootUri,
      indexGeneration: this.currentGenerationId,
      workspaceGeneration,
      entries,
      totalFiles: entries.filter((e) => e.kind === 'file').length,
      status:
        this.status === 'ready' || this.status === 'fresh' || this.status === 'uninitialized'
          ? 'fresh'
          : this.status === 'rebuilding'
            ? 'rebuilding'
            : this.status === 'partial'
              ? 'partial'
              : 'stale',
      indexedAt: now,
    };
  }
}

export const workspaceIndexService = new WorkspaceIndexService();

