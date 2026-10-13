import { describe, it, expect } from 'vitest';
import {
  normalizeResourceUri,
  getResourceScheme,
  extractResourceBasename,
  extractResourceExtension,
  detectLineEnding,
  areResourcesEqual,
  createUntitledUri,
  createNormalizedResource,
} from './ResourceIdentity';

describe('ResourceIdentity Subsystem', () => {
  describe('normalizeResourceUri', () => {
    it('normalizes untitled URIs cleanly', () => {
      expect(normalizeResourceUri('untitled:1')).toBe('untitled:1');
      expect(normalizeResourceUri('Untitled:2')).toBe('untitled:2');
    });

    it('normalizes browser-fs scheme', () => {
      expect(normalizeResourceUri('browser-fs://main.ts')).toBe('browser-fs://main.ts');
      expect(normalizeResourceUri('browser-fs://src\\nested\\file.ts')).toBe('browser-fs://src/nested/file.ts');
    });

    it('normalizes Windows physical paths with drive letter standardization', () => {
      expect(normalizeResourceUri('C:\\projects\\app\\src\\index.ts')).toBe(
        'file:///C:/projects/app/src/index.ts'
      );
      expect(normalizeResourceUri('c:/projects/app/src/index.ts')).toBe(
        'file:///C:/projects/app/src/index.ts'
      );
    });

    it('resolves relative traversal components safely', () => {
      expect(normalizeResourceUri('C:\\projects\\app\\dist\\..\\src\\index.ts')).toBe(
        'file:///C:/projects/app/src/index.ts'
      );
      expect(normalizeResourceUri('/home/user/code/../project/app.js')).toBe(
        'file:///home/user/project/app.js'
      );
    });

    it('handles duplicate slashes cleanly', () => {
      expect(normalizeResourceUri('C://projects///app////main.ts')).toBe(
        'file:///C:/projects/app/main.ts'
      );
    });
  });

  describe('getResourceScheme', () => {
    it('identifies schemes correctly', () => {
      expect(getResourceScheme('untitled:1')).toBe('untitled');
      expect(getResourceScheme('browser-fs://file.ts')).toBe('browser-fs');
      expect(getResourceScheme('virtual://output')).toBe('virtual');
      expect(getResourceScheme('file:///C:/path/file.ts')).toBe('file');
    });
  });

  describe('extractResourceBasename and extractResourceExtension', () => {
    it('extracts filename from various URI types', () => {
      expect(extractResourceBasename('untitled:3')).toBe('Untitled-3');
      expect(extractResourceBasename('browser-fs://component.tsx')).toBe('component.tsx');
      expect(extractResourceBasename('file:///C:/path/to/script.min.js')).toBe('script.min.js');
    });

    it('extracts lowercase extension correctly', () => {
      expect(extractResourceExtension('script.TS')).toBe('ts');
      expect(extractResourceExtension('archive.tar.gz')).toBe('gz');
      expect(extractResourceExtension('README')).toBe('');
      expect(extractResourceExtension('.gitignore')).toBe('');
    });
  });

  describe('detectLineEnding', () => {
    it('detects CRLF, LF, CR, and mixed line endings', () => {
      expect(detectLineEnding('line1\r\nline2\r\nline3')).toBe('CRLF');
      expect(detectLineEnding('line1\nline2\nline3')).toBe('LF');
      expect(detectLineEnding('line1\rline2\rline3')).toBe('CR');
      expect(detectLineEnding('line1\r\nline2\nline3')).toBe('mixed');
      expect(detectLineEnding('singleline')).toBe('LF');
    });
  });

  describe('areResourcesEqual', () => {
    it('compares normalized URIs across different formats', () => {
      expect(
        areResourcesEqual('C:\\projects\\app\\file.ts', 'file:///C:/projects/app/file.ts')
      ).toBe(true);
      expect(
        areResourcesEqual('c:/projects/app/file.ts', 'C:\\projects\\app\\file.ts')
      ).toBe(true);
      expect(
        areResourcesEqual('untitled:1', 'Untitled:1')
      ).toBe(true);
      expect(
        areResourcesEqual('file:///C:/projects/app/a.ts', 'file:///C:/projects/app/b.ts')
      ).toBe(false);
    });
  });

  describe('createNormalizedResource', () => {
    it('creates complete model with inferred properties', () => {
      const res = createNormalizedResource('C:\\code\\test.ts', { readOnly: true });
      expect(res.uri).toBe('file:///C:/code/test.ts');
      expect(res.scheme).toBe('file');
      expect(res.name).toBe('test.ts');
      expect(res.extension).toBe('ts');
      expect(res.readOnly).toBe(true);
      expect(res.exists).toBe(true);
    });
  });

  describe('createUntitledUri', () => {
    it('generates monotonic sequence', () => {
      expect(createUntitledUri(1)).toBe('untitled:1');
      expect(createUntitledUri(42)).toBe('untitled:42');
    });
  });
});
