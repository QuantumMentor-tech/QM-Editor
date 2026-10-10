import { describe, it, expect } from 'vitest';
import { GitProvider } from './GitProvider';
import { WorkspaceRootModel } from '../../types';

describe('GitProvider', () => {
  const gitProvider = new GitProvider();

  it('correctly parses branch name from .git/HEAD content', () => {
    const mainHead = GitProvider.parseHeadContent('ref: refs/heads/main\n');
    expect(mainHead.branch).toBe('main');
    expect(mainHead.isDetached).toBe(false);

    const featureHead = GitProvider.parseHeadContent('ref: refs/heads/feature/scm-integration\n');
    expect(featureHead.branch).toBe('feature/scm-integration');
    expect(featureHead.isDetached).toBe(false);

    const detachedHead = GitProvider.parseHeadContent('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0\n');
    expect(detachedHead.branch).toBe('HEAD at a1b2c3d');
    expect(detachedHead.isDetached).toBe(true);
    expect(detachedHead.commit).toBe('a1b2c3d');
  });

  it('correctly identifies binary files by extension', () => {
    expect(GitProvider.isBinaryFilePath('image.png')).toBe(true);
    expect(GitProvider.isBinaryFilePath('archive.zip')).toBe(true);
    expect(GitProvider.isBinaryFilePath('app.exe')).toBe(true);
    expect(GitProvider.isBinaryFilePath('source.ts')).toBe(false);
    expect(GitProvider.isBinaryFilePath('styles.css')).toBe(false);
  });

  it('detects repository presence cleanly without throwing', async () => {
    const emptyWorkspace: WorkspaceRootModel = {
      id: 'ws-1',
      name: 'my-project',
      uri: 'file:///project',
      tree: [],
      isLoading: false,
      error: null,
    };

    const isGitEmpty = await gitProvider.detectRepository(emptyWorkspace);
    expect(isGitEmpty).toBe(false);

    const gitWorkspace: WorkspaceRootModel = {
      id: 'ws-2',
      name: 'git-project',
      uri: 'file:///git-project',
      tree: [
        {
          id: 'node-git',
          name: '.git',
          kind: 'directory',
          uri: 'file:///git-project/.git',
          parentId: null,
        },
      ],
      isLoading: false,
      error: null,
    };

    const isGitPresent = await gitProvider.detectRepository(gitWorkspace);
    expect(isGitPresent).toBe(true);
  });

  it('returns non-destructive binary diff warning for binary files', async () => {
    const result = await gitProvider.getDiff('file:///project/logo.png', null);
    expect(result.isBinary).toBe(true);
    expect(result.error).toContain('Binary file comparison is not supported');
  });
});
