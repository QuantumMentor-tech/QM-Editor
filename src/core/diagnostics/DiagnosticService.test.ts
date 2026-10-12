import { describe, it, expect, beforeEach } from 'vitest';
import { DiagnosticService } from './DiagnosticService';
import { Diagnostic } from './DiagnosticTypes';
import { problemToDiagnostic, diagnosticToProblem } from './DiagnosticAdapter';
import { Problem } from '../tasks/TaskTypes';

describe('DiagnosticService', () => {
  let service: DiagnosticService;

  beforeEach(() => {
    service = new DiagnosticService();
  });

  it('creates and retrieves named collections', () => {
    const col1 = service.createCollection('typescript');
    expect(col1.name).toBe('typescript');

    const col2 = service.getCollection('typescript');
    expect(col2).toBe(col1);
  });

  it('aggregates diagnostics across multiple producers on the same document', () => {
    const tsCol = service.createCollection('typescript');
    const eslintCol = service.createCollection('eslint');

    const tsDiag: Diagnostic = {
      id: 'ts-1',
      uri: 'src/App.tsx',
      range: { startLine: 10, startColumn: 5, endLine: 10, endColumn: 12 },
      severity: 'error',
      message: 'Type string is not assignable to type number',
      source: 'typescript',
      createdAt: 100,
    };

    const eslintDiag: Diagnostic = {
      id: 'eslint-1',
      uri: 'src/App.tsx',
      range: { startLine: 5, startColumn: 1, endLine: 5, endColumn: 10 },
      severity: 'warning',
      message: 'Unexpected console.log',
      source: 'eslint',
      createdAt: 200,
    };

    tsCol.set('src/App.tsx', [tsDiag]);
    eslintCol.set('src/App.tsx', [eslintDiag]);

    const aggregated = service.getDiagnostics('src/App.tsx');
    expect(aggregated.length).toBe(2);
    // Should be sorted by line: line 5 first, then line 10
    expect(aggregated[0].id).toBe('eslint-1');
    expect(aggregated[1].id).toBe('ts-1');
  });

  it('updates one owner without overwriting other owners diagnostics on same document', () => {
    const colA = service.createCollection('ownerA');
    const colB = service.createCollection('ownerB');

    colA.set('file.ts', [
      {
        id: 'a1',
        uri: 'file.ts',
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
        severity: 'error',
        message: 'A',
        source: 'ownerA',
        createdAt: 0,
      },
    ]);

    colB.set('file.ts', [
      {
        id: 'b1',
        uri: 'file.ts',
        range: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 2 },
        severity: 'warning',
        message: 'B',
        source: 'ownerB',
        createdAt: 0,
      },
    ]);

    expect(service.getDiagnostics('file.ts').length).toBe(2);

    // Update colA
    colA.set('file.ts', []);
    expect(service.getDiagnostics('file.ts').length).toBe(1);
    expect(service.getDiagnostics('file.ts')[0].id).toBe('b1');
  });

  it('computes workspace summaries accurately', () => {
    const col = service.createCollection('compiler');
    col.set('file.ts', [
      {
        id: '1',
        uri: 'file.ts',
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
        severity: 'error',
        message: 'e1',
        source: 'compiler',
        createdAt: 0,
      },
      {
        id: '2',
        uri: 'file.ts',
        range: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 2 },
        severity: 'error',
        message: 'e2',
        source: 'compiler',
        createdAt: 0,
      },
      {
        id: '3',
        uri: 'file.ts',
        range: { startLine: 3, startColumn: 1, endLine: 3, endColumn: 2 },
        severity: 'warning',
        message: 'w1',
        source: 'compiler',
        createdAt: 0,
      },
      {
        id: '4',
        uri: 'file.ts',
        range: { startLine: 4, startColumn: 1, endLine: 4, endColumn: 2 },
        severity: 'info',
        message: 'i1',
        source: 'compiler',
        createdAt: 0,
      },
    ]);

    const summary = service.getSummary();
    expect(summary).toEqual({
      total: 4,
      errorCount: 2,
      warningCount: 1,
      infoCount: 1,
      hintCount: 0,
    });
  });

  it('filters diagnostics by severity, source, and search query', () => {
    const col = service.createCollection('test');
    col.set('file.ts', [
      {
        id: '1',
        uri: 'file.ts',
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
        severity: 'error',
        message: 'Critical DB failure',
        source: 'backend',
        createdAt: 0,
      },
      {
        id: '2',
        uri: 'file.ts',
        range: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 2 },
        severity: 'warning',
        message: 'Deprecated API use',
        source: 'linter',
        code: 'DEP001',
        createdAt: 0,
      },
    ]);

    const errorsOnly = service.query({ severity: 'error' });
    expect(errorsOnly.length).toBe(1);
    expect(errorsOnly[0].id).toBe('1');

    const bySource = service.query({ source: 'linter' });
    expect(bySource.length).toBe(1);
    expect(bySource[0].id).toBe('2');

    const bySearch = service.query({ search: 'DEP001' });
    expect(bySearch.length).toBe(1);
    expect(bySearch[0].id).toBe('2');
  });

  it('fires listeners on collection update', () => {
    const events: any[] = [];
    service.subscribe((evt) => events.push(evt));

    const col = service.createCollection('test');
    col.set('doc.ts', [
      {
        id: 'd1',
        uri: 'doc.ts',
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
        severity: 'warning',
        message: 'warn',
        source: 'test',
        createdAt: 0,
      },
    ]);

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('set');
    expect(events[0].owner).toBe('test');
    expect(events[0].summary.warningCount).toBe(1);
  });

  it('converts between Problem and Diagnostic bidirectionally', () => {
    const problem: Problem = {
      id: 'prob-1',
      file: 'src/main.ts',
      line: 42,
      column: 15,
      endLine: 42,
      endColumn: 25,
      severity: 'error',
      message: 'Identifier expected',
      source: 'tsc',
      code: 'TS1003',
      taskId: 'build-task',
    };

    const diag = problemToDiagnostic(problem);
    expect(diag.id).toBe('prob-1');
    expect(diag.uri).toBe('src/main.ts');
    expect(diag.range).toEqual({
      startLine: 42,
      startColumn: 15,
      endLine: 42,
      endColumn: 25,
    });
    expect(diag.message).toBe('Identifier expected');
    expect(diag.code).toBe('TS1003');

    const backToProblem = diagnosticToProblem(diag);
    expect(backToProblem.id).toBe('prob-1');
    expect(backToProblem.file).toBe('src/main.ts');
    expect(backToProblem.line).toBe(42);
    expect(backToProblem.column).toBe(15);
    expect(backToProblem.code).toBe('TS1003');
  });
});
