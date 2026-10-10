import { describe, it, expect, vi } from 'vitest';
import { SourceControlService } from './SourceControlService';
import { WorkspaceRootModel } from '../../types';

describe('SourceControlService', () => {
  it('initializes with default clean state', () => {
    const service = new SourceControlService();
    const state = service.getState();
    expect(state.isGitRepository).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.currentBranch).toBeNull();
  });

  it('notifies subscribers when repository state is refreshed', async () => {
    const service = new SourceControlService();
    const listener = vi.fn();

    const unsubscribe = service.subscribe(listener);

    const workspace: WorkspaceRootModel = {
      id: 'ws-1',
      name: 'test-app',
      uri: 'file:///test-app',
      tree: [
        {
          id: 'n-git',
          name: '.git',
          kind: 'directory',
          uri: 'file:///test-app/.git',
          parentId: null,
        },
      ],
      isLoading: false,
      error: null,
    };

    await service.refresh(workspace);

    expect(listener).toHaveBeenCalled();
    const finalState = service.getState();
    expect(finalState.isGitRepository).toBe(true);

    unsubscribe();
  });

  it('allows updating file status in working tree', () => {
    const service = new SourceControlService();
    // Simulate git repo active
    (service as any).currentState.isGitRepository = true;

    service.updateFileStatus('file:///test-app/src/index.ts', 'modified');

    const state = service.getState();
    const status = state.fileStatuses.get('file:///test-app/src/index.ts'.toLowerCase());
    expect(status?.displayStatus).toBe('modified');
    expect(state.workingTreeFiles.length).toBe(1);
  });
});
