import { describe, it, expect } from 'vitest';
import {
  normalizeDiagnosticUri,
  validateAndNormalizeRange,
  validateDiagnostic,
  rangeToCharacterOffsets,
  sortDiagnostics,
} from './DiagnosticValidation';
import { Diagnostic } from './DiagnosticTypes';

describe('DiagnosticValidation', () => {
  describe('normalizeDiagnosticUri', () => {
    it('normalizes backslashes to forward slashes', () => {
      expect(normalizeDiagnosticUri('src\\components\\Editor.tsx')).toBe('src/components/Editor.tsx');
    });

    it('capitalizes Windows drive letters consistently', () => {
      expect(normalizeDiagnosticUri('c:/project/main.ts')).toBe('C:/project/main.ts');
      expect(normalizeDiagnosticUri('d:\\app\\index.js')).toBe('D:/app/index.js');
    });

    it('returns empty string for nullish or invalid values', () => {
      expect(normalizeDiagnosticUri('')).toBe('');
      expect(normalizeDiagnosticUri(null as any)).toBe('');
    });
  });

  describe('validateAndNormalizeRange', () => {
    it('preserves valid 1-based ranges', () => {
      const range = validateAndNormalizeRange({
        startLine: 5,
        startColumn: 10,
        endLine: 5,
        endColumn: 20,
      });
      expect(range).toEqual({
        startLine: 5,
        startColumn: 10,
        endLine: 5,
        endColumn: 20,
      });
    });

    it('clamps negative or zero numbers to 1', () => {
      const range = validateAndNormalizeRange({
        startLine: 0,
        startColumn: -5,
        endLine: -1,
        endColumn: 0,
      });
      expect(range.startLine).toBe(1);
      expect(range.startColumn).toBe(1);
      expect(range.endLine).toBe(1);
      expect(range.endColumn).toBe(1);
    });

    it('ensures endLine is not before startLine and endColumn is not before startColumn on same line', () => {
      const range = validateAndNormalizeRange({
        startLine: 10,
        startColumn: 15,
        endLine: 8,
        endColumn: 5,
      });
      expect(range.startLine).toBe(10);
      expect(range.endLine).toBe(10);
      expect(range.startColumn).toBe(15);
      expect(range.endColumn).toBe(15);
    });
  });

  describe('validateDiagnostic', () => {
    it('validates and auto-populates required fields', () => {
      const diag = validateDiagnostic({
        uri: 'src/main.ts',
        message: 'Cannot find name x',
        severity: 'error',
      });

      expect(diag.id).toMatch(/^diag-/);
      expect(diag.uri).toBe('src/main.ts');
      expect(diag.severity).toBe('error');
      expect(diag.message).toBe('Cannot find name x');
      expect(diag.source).toBe('editor');
      expect(diag.range).toEqual({
        startLine: 1,
        startColumn: 1,
        endLine: 1,
        endColumn: 1,
      });
    });

    it('throws when message or uri is missing', () => {
      expect(() => validateDiagnostic({ uri: 'test.ts', message: '' })).toThrow();
      expect(() => validateDiagnostic({ uri: '', message: 'Error' })).toThrow();
    });
  });

  describe('rangeToCharacterOffsets', () => {
    const content = 'hello world\nsecond line\nthird line';

    it('converts single line range to character offsets', () => {
      const offsets = rangeToCharacterOffsets(
        { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
        content
      );
      expect(offsets).toEqual({ from: 0, to: 5 });
      expect(content.slice(offsets.from, offsets.to)).toBe('hello');
    });

    it('converts second line range correctly accounting for newlines', () => {
      // line 1 is 11 chars + 1 newline = 12
      const offsets = rangeToCharacterOffsets(
        { startLine: 2, startColumn: 1, endLine: 2, endColumn: 7 },
        content
      );
      expect(offsets).toEqual({ from: 12, to: 18 });
      expect(content.slice(offsets.from, offsets.to)).toBe('second');
    });

    it('expands empty ranges to at least 1 character for visual squiggle', () => {
      const offsets = rangeToCharacterOffsets(
        { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
        content
      );
      expect(offsets).toEqual({ from: 0, to: 1 });
    });
  });

  describe('sortDiagnostics', () => {
    it('sorts diagnostics by line, column, and severity', () => {
      const diags: Diagnostic[] = [
        {
          id: '1',
          uri: 'f.ts',
          range: { startLine: 10, startColumn: 1, endLine: 10, endColumn: 5 },
          severity: 'info',
          message: 'b',
          source: 'test',
          createdAt: 0,
        },
        {
          id: '2',
          uri: 'f.ts',
          range: { startLine: 2, startColumn: 5, endLine: 2, endColumn: 10 },
          severity: 'warning',
          message: 'warn',
          source: 'test',
          createdAt: 0,
        },
        {
          id: '3',
          uri: 'f.ts',
          range: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 4 },
          severity: 'error',
          message: 'err',
          source: 'test',
          createdAt: 0,
        },
        {
          id: '4',
          uri: 'f.ts',
          range: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 4 },
          severity: 'hint',
          message: 'hint',
          source: 'test',
          createdAt: 0,
        },
      ];

      const sorted = sortDiagnostics(diags);
      expect(sorted.map((d) => d.id)).toEqual(['3', '4', '2', '1']);
    });
  });
});
