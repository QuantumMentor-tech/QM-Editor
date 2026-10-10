import { describe, it, expect } from 'vitest';
import { QuickOpenSearchService } from './QuickOpenSearchService';
import { QuickOpenResource } from './WorkspaceIndexService';

const mockResources: QuickOpenResource[] = [
  {
    id: '1',
    name: 'userService.ts',
    relativePath: 'src/services/userService.ts',
    uri: 'file:///project/src/services/userService.ts',
    isFolder: false,
    parentPath: 'src/services',
  },
  {
    id: '2',
    name: 'userController.ts',
    relativePath: 'src/controllers/userController.ts',
    uri: 'file:///project/src/controllers/userController.ts',
    isFolder: false,
    parentPath: 'src/controllers',
  },
  {
    id: '3',
    name: 'App.tsx',
    relativePath: 'src/App.tsx',
    uri: 'file:///project/src/App.tsx',
    isFolder: false,
    parentPath: 'src',
  },
];

describe('QuickOpenSearchService', () => {
  it('returns all resources sorted when query is empty', () => {
    const results = QuickOpenSearchService.search(mockResources, '');
    expect(results).toHaveLength(mockResources.length);
  });

  it('prioritizes exact filename matches', () => {
    const results = QuickOpenSearchService.search(mockResources, 'App.tsx');
    expect(results[0].resource.name).toBe('App.tsx');
    expect(results[0].score).toBeGreaterThan(800);
  });

  it('matches partial filename and prefix queries', () => {
    const results = QuickOpenSearchService.search(mockResources, 'user');
    expect(results.length).toBe(2);
    expect(results.map((r) => r.resource.name)).toContain('userService.ts');
  });

  it('scores open documents higher on tie breaks', () => {
    const mockOpenDocs = [
      {
        id: 'doc-1',
        title: 'userService.ts',
        content: '',
        filePath: 'file:///project/src/services/userService.ts',
        isDirty: false,
        languageId: 'typescript',
        fileResource: {
          id: '1',
          name: 'userService.ts',
          uri: 'file:///project/src/services/userService.ts',
          readOnly: false,
        },
      },
    ];

    const results = QuickOpenSearchService.search(mockResources, 'user', mockOpenDocs as any);
    expect(results[0].resource.name).toBe('userService.ts');
    expect(results[0].isOpen).toBe(true);
  });

  it('handles regex characters in query string safely', () => {
    expect(() => {
      QuickOpenSearchService.search(mockResources, '[invalid(regex');
    }).not.toThrow();
  });
});
