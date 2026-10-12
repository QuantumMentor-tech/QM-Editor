import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagnosticCollection, DiagnosticCollectionDelegate } from './DiagnosticCollection';
import { Diagnostic } from './DiagnosticTypes';

describe('DiagnosticCollection', () => {
  let delegate: DiagnosticCollectionDelegate;

  beforeEach(() => {
    delegate = {
      onCollectionUpdated: vi.fn(),
      onCollectionDisposed: vi.fn(),
    };
  });

  it('instantiates with name and empty store', () => {
    const col = new DiagnosticCollection('typescript', delegate);
    expect(col.name).toBe('typescript');
    expect(col.has('src/App.tsx')).toBe(false);
    expect(col.get('src/App.tsx')).toEqual([]);
  });

  it('sets diagnostics for a URI and notifies delegate', () => {
    const col = new DiagnosticCollection('typescript', delegate);
    const diags: Diagnostic[] = [
      {
        id: 'd1',
        uri: 'src/App.tsx',
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
        severity: 'error',
        message: 'Syntax error',
        source: 'typescript',
        createdAt: 1000,
      },
    ];

    col.set('src/App.tsx', diags);

    expect(col.has('src/App.tsx')).toBe(true);
    expect(col.get('src/App.tsx').length).toBe(1);
    expect(delegate.onCollectionUpdated).toHaveBeenCalledWith(
      col,
      'set',
      ['src/App.tsx']
    );
  });

  it('deletes diagnostics for a single URI', () => {
    const col = new DiagnosticCollection('eslint', delegate);
    col.set('src/App.tsx', [
      {
        id: 'e1',
        uri: 'src/App.tsx',
        range: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 5 },
        severity: 'warning',
        message: 'Unused variable',
        source: 'eslint',
        createdAt: 1000,
      },
    ]);

    col.delete('src/App.tsx');
    expect(col.has('src/App.tsx')).toBe(false);
    expect(delegate.onCollectionUpdated).toHaveBeenCalledWith(
      col,
      'deleted',
      ['src/App.tsx']
    );
  });

  it('clears all diagnostics and notifies delegate', () => {
    const col = new DiagnosticCollection('eslint', delegate);
    col.set('a.ts', [
      {
        id: '1',
        uri: 'a.ts',
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
        severity: 'info',
        message: 'msg',
        source: 'eslint',
        createdAt: 0,
      },
    ]);
    col.set('b.ts', [
      {
        id: '2',
        uri: 'b.ts',
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
        severity: 'info',
        message: 'msg',
        source: 'eslint',
        createdAt: 0,
      },
    ]);

    col.clear();
    expect(col.has('a.ts')).toBe(false);
    expect(col.has('b.ts')).toBe(false);
    expect(delegate.onCollectionUpdated).toHaveBeenCalledWith(
      col,
      'cleared',
      expect.arrayContaining(['a.ts', 'b.ts'])
    );
  });

  it('disposes and notifies delegate of disposal', () => {
    const col = new DiagnosticCollection('test', delegate);
    col.set('f.ts', [
      {
        id: '1',
        uri: 'f.ts',
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
        severity: 'info',
        message: 'msg',
        source: 'test',
        createdAt: 0,
      },
    ]);

    col.dispose();
    expect(delegate.onCollectionDisposed).toHaveBeenCalledWith(col);
    expect(col.get('f.ts')).toEqual([]);

    // Further calls on disposed collection are no-ops
    col.set('f.ts', []);
    expect(col.has('f.ts')).toBe(false);
  });
});
