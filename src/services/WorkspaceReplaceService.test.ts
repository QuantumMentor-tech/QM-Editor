import { describe, it, expect, vi } from 'vitest';
import { WorkspaceReplaceService } from './WorkspaceReplaceService';
import { WorkspaceFileSearchResult, WorkspaceSearchQuery } from './WorkspaceSearchService';

describe('WorkspaceReplaceService', () => {
  const dummyQuery: WorkspaceSearchQuery = {
    query: 'foo',
    caseSensitive: false,
    wholeWord: false,
    isRegex: false,
  };

  const mockSearchResults: WorkspaceFileSearchResult[] = [
    {
      resource: {
        id: '1',
        name: 'app.ts',
        relativePath: 'src/app.ts',
        uri: 'file:///project/src/app.ts',
        isFolder: false,
        parentPath: 'src',
      },
      matches: [
        {
          id: '1:0-3',
          line: 1,
          column: 1,
          from: 6,
          to: 9,
          lineText: 'const foo = 42;',
          matchText: 'foo',
        },
      ],
    },
  ];

  it('builds replacement plan for clean open document correctly', async () => {
    const mockOpenDocs = [
      {
        id: 'doc-1',
        title: 'app.ts',
        content: 'const foo = 42;',
        filePath: 'file:///project/src/app.ts',
        isDirty: false,
        languageId: 'typescript',
        fileResource: {
          id: '1',
          name: 'app.ts',
          uri: 'file:///project/src/app.ts',
          readOnly: false,
        },
      },
    ];

    const plan = await WorkspaceReplaceService.buildReplacePlan(
      mockSearchResults,
      dummyQuery,
      'bar',
      mockOpenDocs as any
    );

    expect(plan.totalFilesCount).toBe(1);
    expect(plan.readyFilesCount).toBe(1);
    expect(plan.filePlans[0].status).toBe('ready');
    expect(plan.filePlans[0].newContent).toBe('const bar = 42;');
  });

  it('marks open dirty document as dirty_open and blocks execution to protect unsaved edits', async () => {
    const mockOpenDocs = [
      {
        id: 'doc-1',
        title: 'app.ts',
        content: 'const foo = 42;',
        filePath: 'file:///project/src/app.ts',
        isDirty: true, // Dirty unsaved changes
        languageId: 'typescript',
        fileResource: {
          id: '1',
          name: 'app.ts',
          uri: 'file:///project/src/app.ts',
          readOnly: false,
        },
      },
    ];

    const plan = await WorkspaceReplaceService.buildReplacePlan(
      mockSearchResults,
      dummyQuery,
      'bar',
      mockOpenDocs as any
    );

    expect(plan.readyFilesCount).toBe(0);
    expect(plan.blockedFilesCount).toBe(1);
    expect(plan.filePlans[0].status).toBe('dirty_open');
  });

  it('executes replace plan and calls updateText on open tabs', async () => {
    const mockOpenDocs = [
      {
        id: 'doc-1',
        title: 'app.ts',
        content: 'const foo = 42;',
        filePath: 'file:///project/src/app.ts',
        isDirty: false,
        languageId: 'typescript',
        fileResource: {
          id: '1',
          name: 'app.ts',
          uri: 'file:///project/src/app.ts',
          readOnly: false,
        },
      },
    ];

    const plan = await WorkspaceReplaceService.buildReplacePlan(
      mockSearchResults,
      dummyQuery,
      'bar',
      mockOpenDocs as any
    );

    const updateTextSpy = vi.fn();
    const result = await WorkspaceReplaceService.executeReplacePlan(plan, mockOpenDocs as any, updateTextSpy);

    expect(result.replacedFilesCount).toBe(1);
    expect(updateTextSpy).toHaveBeenCalledWith('doc-1', 'const bar = 42;');
  });
});
