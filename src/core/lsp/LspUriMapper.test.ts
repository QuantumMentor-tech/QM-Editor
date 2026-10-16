/**
 * QM Editor LSP URI Mapper Unit Tests
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 */

import { describe, it, expect } from 'vitest';
import { LspUriMapper } from './LspUriMapper';

describe('LspUriMapper', () => {
  describe('pathToUri', () => {
    it('converts Windows drive paths to file:// URI', () => {
      const uri = LspUriMapper.pathToUri('C:\\projects\\app\\src\\index.ts');
      expect(uri).toBe('file:///C:/projects/app/src/index.ts');
    });

    it('converts Windows paths with forward slashes', () => {
      const uri = LspUriMapper.pathToUri('c:/projects/app/main.ts');
      expect(uri).toBe('file:///C:/projects/app/main.ts');
    });

    it('converts POSIX absolute paths to file:// URI', () => {
      const uri = LspUriMapper.pathToUri('/home/developer/workspace/file.ts');
      expect(uri).toBe('file:///home/developer/workspace/file.ts');
    });

    it('preserves untitled URI schemes', () => {
      expect(LspUriMapper.pathToUri('untitled:1')).toBe('untitled:1');
      expect(LspUriMapper.pathToUri('untitled:Untitled-2')).toBe('untitled:Untitled-2');
    });

    it('preserves already normalized file:// URIs', () => {
      const uri = 'file:///C:/workspace/test.ts';
      expect(LspUriMapper.pathToUri(uri)).toBe(uri);
    });

    it('percent-encodes spaces and special characters', () => {
      const uri = LspUriMapper.pathToUri('C:\\My Documents\\Project #1\\file?name.ts');
      expect(uri).toContain('My%20Documents');
      expect(uri).toContain('Project%20%231');
      expect(uri).toContain('file%3Fname.ts');
    });

    it('handles non-ASCII Unicode characters', () => {
      const uri = LspUriMapper.pathToUri('C:\\workspace\\проект\\main.ts');
      expect(uri).toContain('%D0%BF%D1%80%D0%BE%D0%B5%D0%BA%D1%82');
    });
  });

  describe('uriToPath', () => {
    it('converts Windows file:// URI back to native Windows backslash path', () => {
      const path = LspUriMapper.uriToPath('file:///C:/projects/app/src/index.ts');
      expect(path).toBe('C:\\projects\\app\\src\\index.ts');
    });

    it('converts POSIX file:// URI back to native POSIX path', () => {
      const path = LspUriMapper.uriToPath('file:///home/developer/workspace/file.ts');
      expect(path).toBe('/home/developer/workspace/file.ts');
    });

    it('preserves untitled URIs unchanged', () => {
      expect(LspUriMapper.uriToPath('untitled:1')).toBe('untitled:1');
    });

    it('decodes percent-encoded characters correctly', () => {
      const path = LspUriMapper.uriToPath('file:///C:/My%20Documents/Project%20%231/file%3Fname.ts');
      expect(path).toBe('C:\\My Documents\\Project #1\\file?name.ts');
    });

    it('decodes non-ASCII Unicode paths correctly', () => {
      const path = LspUriMapper.uriToPath('file:///C:/workspace/%D0%BF%D1%80%D0%BE%D0%B5%D0%BA%D1%82/main.ts');
      expect(path).toBe('C:\\workspace\\проект\\main.ts');
    });
  });

  describe('Round-Trip Fidelity', () => {
    it('maintains round-trip fidelity for Windows paths', () => {
      const original = 'C:\\dev\\qm-editor\\src\\core\\lsp\\LspClient.ts';
      const uri = LspUriMapper.pathToUri(original);
      const restored = LspUriMapper.uriToPath(uri);
      expect(restored).toBe(original);
    });

    it('maintains round-trip fidelity for POSIX paths', () => {
      const original = '/usr/local/src/project/app.py';
      const uri = LspUriMapper.pathToUri(original);
      const restored = LspUriMapper.uriToPath(uri);
      expect(restored).toBe(original);
    });

    it('maintains round-trip fidelity for paths with spaces and punctuation', () => {
      const original = 'C:\\App Winrar Files\\QM Editor (working)\\index.html';
      const uri = LspUriMapper.pathToUri(original);
      const restored = LspUriMapper.uriToPath(uri);
      expect(restored).toBe(original);
    });
  });
});
