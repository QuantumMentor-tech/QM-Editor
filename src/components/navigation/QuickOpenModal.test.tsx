import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { QuickOpenModal } from './QuickOpenModal';
import { QuickOpenResource } from '../../services/WorkspaceIndexService';
import { QuickOpenSearchService } from '../../services/QuickOpenSearchService';

describe('QuickOpenModal Integration', () => {
  it('instantiates QuickOpenModal element correctly', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const element = React.createElement(QuickOpenModal, {
      workspaceRoot: null,
      openDocs: [],
      onSelectResource: onSelect,
      onClose: onClose,
    });

    expect(element.props.workspaceRoot).toBeNull();
    expect(element.props.openDocs).toEqual([]);
  });

  it('filters workspace resources using QuickOpenSearchService', () => {
    const resources: QuickOpenResource[] = [
      {
        id: '1',
        name: 'app.ts',
        relativePath: 'src/app.ts',
        uri: 'file:///project/src/app.ts',
        isFolder: false,
        parentPath: 'src',
      },
      {
        id: '2',
        name: 'server.ts',
        relativePath: 'src/server.ts',
        uri: 'file:///project/src/server.ts',
        isFolder: false,
        parentPath: 'src',
      },
    ];

    const searchResults = QuickOpenSearchService.search(resources, 'app');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].resource.name).toBe('app.ts');
  });
});
