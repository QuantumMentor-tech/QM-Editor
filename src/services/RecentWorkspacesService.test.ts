import { describe, it, expect, beforeEach } from 'vitest';
import { RecentWorkspacesService } from './RecentWorkspacesService';

describe('RecentWorkspacesService', () => {
  beforeEach(() => {
    RecentWorkspacesService.clearRecentWorkspaces();
  });

  it('adds recent workspaces and orders by most recently used', () => {
    RecentWorkspacesService.addRecentWorkspace('/projects/app1', 'App One');
    RecentWorkspacesService.addRecentWorkspace('/projects/app2', 'App Two');
    RecentWorkspacesService.addRecentWorkspace('/projects/app1', 'App One');

    const recent = RecentWorkspacesService.getRecentWorkspaces();
    expect(recent.length).toBe(2);
    expect(recent[0].path).toBe('/projects/app1');
    expect(recent[1].path).toBe('/projects/app2');
  });

  it('bounds list to maximum limit of 10 items', () => {
    for (let i = 1; i <= 15; i++) {
      RecentWorkspacesService.addRecentWorkspace(`/workspace/project-${i}`);
    }

    const recent = RecentWorkspacesService.getRecentWorkspaces();
    expect(recent.length).toBe(10);
    expect(recent[0].path).toBe('/workspace/project-15');
    expect(recent[9].path).toBe('/workspace/project-6');
  });

  it('removes workspace from history without throwing', () => {
    RecentWorkspacesService.addRecentWorkspace('/workspace/alpha', 'Alpha');
    RecentWorkspacesService.addRecentWorkspace('/workspace/beta', 'Beta');

    const afterRemoval = RecentWorkspacesService.removeRecentWorkspace('/workspace/alpha');
    expect(afterRemoval.length).toBe(1);
    expect(afterRemoval[0].path).toBe('/workspace/beta');
  });

  it('validates corrupted storage data gracefully', () => {
    const validated = RecentWorkspacesService.validateRecentWorkspaces([
      null,
      123,
      { path: '' },
      { path: '/valid/workspace', name: 'workspace' },
    ]);
    expect(validated.length).toBe(1);
    expect(validated[0].path).toBe('/valid/workspace');
  });

  it('extracts workspace name from raw paths', () => {
    expect(RecentWorkspacesService.extractWorkspaceName('browser-fs://my-project')).toBe('my-project');
    expect(RecentWorkspacesService.extractWorkspaceName('C:\\Users\\dev\\qm-editor')).toBe('qm-editor');
  });
});
