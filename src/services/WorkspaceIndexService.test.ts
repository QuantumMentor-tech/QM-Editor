import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceIndexService, QuickOpenResource } from './WorkspaceIndexService';
import { WorkspaceRootModel, TreeNodeModel } from '../types';

describe('WorkspaceIndexService', () => {
  let indexService: WorkspaceIndexService;

  beforeEach(() => {
    indexService = new WorkspaceIndexService();
  });

  it('starts with empty resources and indexing state false', () => {
    expect(indexService.getResources()).toEqual([]);
    expect(indexService.isIndexing()).toBe(false);
  });

  it('indexes tree nodes recursively skipping excluded directories', () => {
    const mockTree: TreeNodeModel[] = [
      {
        id: 'node_modules',
        name: 'node_modules',
        kind: 'directory',
        uri: 'browser-fs://root/node_modules',
        parentId: null,
        children: [
          {
            id: 'mod.js',
            name: 'mod.js',
            kind: 'file',
            uri: 'browser-fs://root/node_modules/mod.js',
            parentId: 'node_modules',
          },
        ],
      },
      {
        id: 'src',
        name: 'src',
        kind: 'directory',
        uri: 'browser-fs://root/src',
        parentId: null,
        children: [
          {
            id: 'app.ts',
            name: 'app.ts',
            kind: 'file',
            uri: 'browser-fs://root/src/app.ts',
            parentId: 'src',
          },
        ],
      },
      {
        id: 'README.md',
        name: 'README.md',
        kind: 'file',
        uri: 'browser-fs://root/README.md',
        parentId: null,
      },
    ];

    const mockRoot: WorkspaceRootModel = {
      id: 'root',
      name: 'MyProject',
      uri: 'browser-fs://root',
      tree: mockTree,
      isLoading: false,
      error: null,
    };

    const indexed = indexService.indexFromTree(mockRoot);
    expect(indexed).toHaveLength(2); // app.ts and README.md (node_modules skipped)
    expect(indexed.map((r) => r.name)).toContain('app.ts');
    expect(indexed.map((r) => r.name)).toContain('README.md');
  });

  it('clears index and increments generation id', () => {
    const initialGen = indexService.getGenerationId();
    indexService.clearIndex();
    expect(indexService.getGenerationId()).toBeGreaterThan(initialGen);
    expect(indexService.getResources()).toEqual([]);
  });

  it('adds or updates a resource entry cleanly', () => {
    const resource: QuickOpenResource = {
      id: 'test.ts',
      name: 'test.ts',
      relativePath: 'src/test.ts',
      uri: 'file:///d:/src/test.ts',
      isFolder: false,
      parentPath: 'src',
    };

    indexService.addOrUpdateResource(resource);
    expect(indexService.getResources()).toHaveLength(1);
    expect(indexService.getResources()[0].name).toBe('test.ts');
  });
});
