import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { SourceControlPanel } from './SourceControlPanel';

vi.mock('../../state/ExplorerContext', () => ({
  useExplorer: () => ({
    workspaceRoot: {
      id: 'ws-1',
      name: 'test-app',
      uri: 'file:///test-app',
      tree: [
        {
          id: 'git-node',
          name: '.git',
          kind: 'directory',
          uri: 'file:///test-app/.git',
        },
      ],
      isLoading: false,
      error: null,
    },
  }),
}));

describe('SourceControlPanel', () => {
  it('instantiates SourceControlPanel element correctly', () => {
    const element = React.createElement(SourceControlPanel);
    expect(element.type).toBe(SourceControlPanel);
  });
});
