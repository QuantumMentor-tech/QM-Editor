import { describe, it, expect } from 'vitest';
import {
  normalizeWorkspacePath,
  isResourceInRoot,
  resolveRelativeResource,
  getRelativeResourcePath,
  findRootForResource,
} from './WorkspaceResourceBoundary';
import { PathTraversalError } from './WorkspaceErrors';
import { WorkspaceRoot } from './WorkspaceTypes';

describe('WorkspaceResourceBoundary', () => {
  describe('normalizeWorkspacePath', () => {
    it('normalizes Windows backslashes to forward slashes', () => {
      const norm = normalizeWorkspacePath('C:\\Users\\Developer\\Project\\file.txt');
      expect(norm).toBe('C:/Users/Developer/Project/file.txt');
    });

    it('resolves relative . and .. segments', () => {
      const norm = normalizeWorkspacePath('C:/Users/Developer/Project/../OtherProject/./file.txt');
      expect(norm).toBe('C:/Users/Developer/OtherProject/file.txt');
    });

    it('preserves browser-fs and other URI schemes', () => {
      const norm = normalizeWorkspacePath('browser-fs://my-project/src/index.ts');
      expect(norm).toBe('browser-fs://my-project/src/index.ts');
    });

    it('deduplicates redundant consecutive slashes', () => {
      const norm = normalizeWorkspacePath('C:/Users//Developer///Project/file.txt');
      expect(norm).toBe('C:/Users/Developer/Project/file.txt');
    });

    it('preserves Windows drive root slash', () => {
      const norm = normalizeWorkspacePath('C:');
      expect(norm).toBe('C:/');
    });
  });

  describe('isResourceInRoot — Boundary and Membership Safety', () => {
    it('returns true for root matching itself', () => {
      expect(isResourceInRoot('C:/project', 'C:/project')).toBe(true);
    });

    it('returns true for child files within the root', () => {
      expect(isResourceInRoot('C:/project', 'C:/project/src/app.ts')).toBe(true);
      expect(isResourceInRoot('browser-fs://repo', 'browser-fs://repo/package.json')).toBe(true);
    });

    it('PREVENTS prefix collision: C:/project-other is NOT in C:/project', () => {
      expect(isResourceInRoot('C:/project', 'C:/project-other')).toBe(false);
      expect(isResourceInRoot('C:/project', 'C:/project-other/file.txt')).toBe(false);
      expect(isResourceInRoot('/home/user/app', '/home/user/app-legacy/main.rs')).toBe(false);
    });

    it('handles Windows case-insensitivity by default', () => {
      expect(isResourceInRoot('c:/project', 'C:/PROJECT/src/index.ts')).toBe(true);
    });

    it('returns false for outside files', () => {
      expect(isResourceInRoot('C:/project', 'C:/other-folder/secret.key')).toBe(false);
      expect(isResourceInRoot('browser-fs://repo1', 'browser-fs://repo2/file.txt')).toBe(false);
    });
  });

  describe('resolveRelativeResource & Traversal Protection', () => {
    it('resolves valid relative paths inside the root', () => {
      const resolved = resolveRelativeResource('C:/project', 'src/components/Button.tsx');
      expect(resolved).toBe('C:/project/src/components/Button.tsx');
    });

    it('throws PathTraversalError when relative path attempts to escape root via ..', () => {
      expect(() => {
        resolveRelativeResource('C:/project', '../outside.txt');
      }).toThrow(PathTraversalError);

      expect(() => {
        resolveRelativeResource('C:/project', 'src/../../windows/system32');
      }).toThrow(PathTraversalError);
    });
  });

  describe('getRelativeResourcePath', () => {
    it('returns empty string when resource is the root itself', () => {
      expect(getRelativeResourcePath('C:/project', 'C:/project')).toBe('');
    });

    it('returns relative subpath for nested resource', () => {
      expect(getRelativeResourcePath('C:/project', 'C:/project/src/index.ts')).toBe('src/index.ts');
    });

    it('returns null if resource is outside root', () => {
      expect(getRelativeResourcePath('C:/project', 'C:/other/index.ts')).toBeNull();
    });
  });

  describe('findRootForResource', () => {
    const roots: WorkspaceRoot[] = [
      { rootId: 'root-1', uri: 'C:/workspace', name: 'workspace', isAccessible: true },
      { rootId: 'root-2', uri: 'C:/workspace/nested-subrepo', name: 'nested', isAccessible: true },
      { rootId: 'root-inaccessible', uri: 'D:/offline', name: 'offline', isAccessible: false },
    ];

    it('finds most specific root when nested', () => {
      const match = findRootForResource(roots, 'C:/workspace/nested-subrepo/file.txt');
      expect(match).toBeDefined();
      expect(match?.rootId).toBe('root-2');
    });

    it('finds base root for standard workspace file', () => {
      const match = findRootForResource(roots, 'C:/workspace/src/app.ts');
      expect(match?.rootId).toBe('root-1');
    });

    it('ignores inaccessible roots', () => {
      const match = findRootForResource(roots, 'D:/offline/data.json');
      expect(match).toBeUndefined();
    });
  });
});
