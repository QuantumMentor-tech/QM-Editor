import { describe, it, expect } from 'vitest';
import { WorkspaceService, EXCLUDED_DIRECTORY_NAMES } from './WorkspaceService';
import { TreeNodeModel } from '../types';

describe('WorkspaceService Directory Enumeration & Tree Logic', () => {
  const service = new WorkspaceService();

  describe('Folders First Deterministic Sorting', () => {
    it('sorts folders before files and orders alphabetically case-insensitive', () => {
      const nodes: TreeNodeModel[] = [
        { id: '1', name: 'zebra.txt', kind: 'file', uri: 'file://zebra.txt', parentId: null },
        { id: '2', name: 'src', kind: 'directory', uri: 'file://src', parentId: null },
        { id: '3', name: 'alpha.txt', kind: 'file', uri: 'file://alpha.txt', parentId: null },
        { id: '4', name: 'assets', kind: 'directory', uri: 'file://assets', parentId: null },
        { id: '5', name: 'README.md', kind: 'file', uri: 'file://README.md', parentId: null },
      ];

      const sorted = service.sortNodes(nodes);

      expect(sorted.map((n) => n.name)).toEqual([
        'assets',
        'src',
        'alpha.txt',
        'README.md',
        'zebra.txt',
      ]);
    });
  });

  describe('Async Race Condition Protection', () => {
    it('generates incrementing tokens and invalidates stale tokens', () => {
      const token1 = service.getNextToken();
      const token2 = service.getNextToken();

      expect(token2).toBeGreaterThan(token1);
      expect(service.isTokenStale(token1)).toBe(true);
      expect(service.isTokenStale(token2)).toBe(false);
    });
  });

  describe('Excluded File Strategy', () => {
    it('contains default system exclusions', () => {
      expect(EXCLUDED_DIRECTORY_NAMES.has('.git')).toBe(true);
      expect(EXCLUDED_DIRECTORY_NAMES.has('node_modules')).toBe(true);
      expect(EXCLUDED_DIRECTORY_NAMES.has('.DS_Store')).toBe(true);
    });
  });
});
