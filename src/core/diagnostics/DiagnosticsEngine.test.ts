/**
 * QM Editor Step 40 — Diagnostics, Problems, Markers & Issue Lifecycle Engine Test Suite
 * Comprehensive verification of canonical models, provider isolation, stale protection,
 * task run isolation, resource lifecycle, and navigation validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DiagnosticService,
  validateDiagnostic,
  generateDiagnosticId,
  areDiagnosticsEqual,
  areDiagnosticArraysEqual,
  sortDiagnostics,
  TaskDiagnosticProvider,
  problemToDiagnostic,
  diagnosticToProblem,
  Diagnostic,
  DiagnosticProvider,
} from './index';
import { globalDocumentEngine } from '../documents/DocumentEngine';
import { globalWorkspaceEngine } from '../workspace/WorkspaceEngine';
import { Problem } from '../tasks/TaskTypes';

describe('DiagnosticsEngine (Step 40)', () => {
  let service: DiagnosticService;

  beforeEach(() => {
    service = new DiagnosticService();
  });

  afterEach(() => {
    service.dispose();
    vi.restoreAllMocks();
  });

  describe('1. Canonical Diagnostic Model & Validation', () => {
    it('creates and normalizes a valid diagnostic with 1-based range', () => {
      const diag = validateDiagnostic({
        uri: 'src/index.ts',
        message: 'Syntax error: unexpected token',
        severity: 'error',
        source: 'compiler',
        range: {
          startLine: 12,
          startColumn: 5,
          endLine: 12,
          endColumn: 18,
        },
        code: 'TS1005',
      });

      expect(diag.uri).toBe('src/index.ts');
      expect(diag.severity).toBe('error');
      expect(diag.message).toBe('Syntax error: unexpected token');
      expect(diag.source).toBe('compiler');
      expect(diag.code).toBe('TS1005');
      expect(diag.range).toEqual({
        startLine: 12,
        startColumn: 5,
        endLine: 12,
        endColumn: 18,
      });
      expect(diag.id).toMatch(/^diag-/);
    });

    it('supports point diagnostics by normalizing single line/col into minimal range', () => {
      const diag = validateDiagnostic({
        uri: 'src/utils.ts',
        message: 'Missing semicolon',
        severity: 'warning',
        line: 42,
        column: 15,
      } as any);

      expect(diag.range).toEqual({
        startLine: 42,
        startColumn: 15,
        endLine: 42,
        endColumn: 15,
      });
    });

    it('supports resource-level diagnostics without fabricating fake line numbers', () => {
      const diag = validateDiagnostic(
        {
          uri: 'package.json',
          message: 'Missing required peer dependency "react"',
          severity: 'error',
          source: 'npm',
          range: null as any,
        },
        'npm'
      );

      expect(diag.range).toBeUndefined();
      expect(diag.uri).toBe('package.json');
      expect(diag.message).toBe('Missing required peer dependency "react"');
    });

    it('generates deterministic stable IDs when id is omitted', () => {
      const id1 = generateDiagnosticId('eslint', 'src/App.tsx', { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 }, 'Unused var', 'no-unused');
      const id2 = generateDiagnosticId('eslint', 'src/App.tsx', { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 }, 'Unused var', 'no-unused');
      const id3 = generateDiagnosticId('eslint', 'src/App.tsx', { startLine: 2, startColumn: 1, endLine: 2, endColumn: 5 }, 'Unused var', 'no-unused');

      expect(id1).toBe(id2);
      expect(id1).not.toBe(id3);
    });

    it('correctly compares diagnostics for equality', () => {
      const d1: Diagnostic = {
        id: 'diag-1',
        uri: 'src/a.ts',
        range: { startLine: 1, startColumn: 2, endLine: 1, endColumn: 5 },
        severity: 'error',
        message: 'Err',
        source: 'ts',
        createdAt: 100,
      };
      const d2: Diagnostic = { ...d1, createdAt: 200 };
      const d3: Diagnostic = { ...d1, message: 'Different err' };

      expect(areDiagnosticsEqual(d1, d2)).toBe(true);
      expect(areDiagnosticsEqual(d1, d3)).toBe(false);
      expect(areDiagnosticArraysEqual([d1], [d2])).toBe(true);
      expect(areDiagnosticArraysEqual([d1], [d3])).toBe(false);
    });

    it('sorts diagnostics logically with resource-level items first', () => {
      const diags: Diagnostic[] = [
        { id: '1', uri: 'a.ts', range: { startLine: 10, startColumn: 1, endLine: 10, endColumn: 1 }, severity: 'error', message: 'line 10', source: 't', createdAt: 0 },
        { id: '2', uri: 'a.ts', range: undefined, severity: 'warning', message: 'file warning', source: 't', createdAt: 0 },
        { id: '3', uri: 'a.ts', range: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 1 }, severity: 'info', message: 'line 2', source: 't', createdAt: 0 },
      ];

      const sorted = sortDiagnostics(diags);
      expect(sorted.map((d) => d.id)).toEqual(['2', '3', '1']);
    });
  });

  describe('2. Provider Registration & Isolation', () => {
    it('registers a diagnostic provider with declared capabilities', () => {
      const provider: DiagnosticProvider = {
        providerId: 'linter-custom',
        displayName: 'Custom Linter',
        capabilities: {
          supportsDocumentDiagnostics: true,
          supportsCodes: true,
        },
      };

      const collection = service.registerProvider(provider);
      expect(collection.name).toBe('linter-custom');
      expect(service.getProvider('linter-custom')).toBe(provider);
      expect(service.getProviders()).toContain(provider);
    });

    it('enforces provider isolation: updating Provider A does not erase Provider B diagnostics', () => {
      const colA = service.createCollection('compiler');
      const colB = service.createCollection('linter');

      const diagA1 = validateDiagnostic({ uri: 'src/app.ts', message: 'Compiler Error 1', severity: 'error' }, 'compiler');
      const diagA2 = validateDiagnostic({ uri: 'src/app.ts', message: 'Compiler Error 2', severity: 'error' }, 'compiler');
      const diagB1 = validateDiagnostic({ uri: 'src/app.ts', message: 'Linter Warning 1', severity: 'warning' }, 'linter');

      // Set initial diagnostics
      colA.set('src/app.ts', [diagA1, diagA2]);
      colB.set('src/app.ts', [diagB1]);

      let aggregated = service.getDiagnostics('src/app.ts');
      expect(aggregated).toHaveLength(3);

      // Refresh Provider A with only 1 new diagnostic
      const diagA3 = validateDiagnostic({ uri: 'src/app.ts', message: 'Compiler Error 3', severity: 'error' }, 'compiler');
      colA.set('src/app.ts', [diagA3]);

      aggregated = service.getDiagnostics('src/app.ts');
      expect(aggregated).toHaveLength(2);
      expect(aggregated.map((d) => d.message)).toEqual(['Compiler Error 3', 'Linter Warning 1']);

      // Clearing Provider B does not remove Provider A diagnostics
      colB.clear();
      aggregated = service.getDiagnostics('src/app.ts');
      expect(aggregated).toHaveLength(1);
      expect(aggregated[0].message).toBe('Compiler Error 3');
    });

    it('cleans up collection when provider is unregistered', () => {
      const provider: DiagnosticProvider = {
        providerId: 'temp-provider',
        displayName: 'Temporary',
      };
      const col = service.registerProvider(provider);
      col.set('test.ts', [validateDiagnostic({ uri: 'test.ts', message: 'Temp msg' }, 'temp-provider')]);

      expect(service.getDiagnostics('test.ts')).toHaveLength(1);

      service.unregisterProvider('temp-provider');
      expect(service.getDiagnostics('test.ts')).toHaveLength(0);
      expect(service.getProvider('temp-provider')).toBeUndefined();
    });
  });

  describe('3. Stale-Result Protection & Generation Handling', () => {
    it('rejects diagnostics with older generation than active collection generation', () => {
      const col = service.createCollection('async-analyzer');

      const diag1 = validateDiagnostic({ uri: 'src/file.ts', message: 'Gen 10 analysis' }, 'async-analyzer');
      const diag2 = validateDiagnostic({ uri: 'src/file.ts', message: 'Gen 11 analysis' }, 'async-analyzer');

      // Generation 11 completes first
      col.set('src/file.ts', [diag2], { generation: 11 });
      expect(service.getDiagnostics('src/file.ts')).toHaveLength(1);
      expect(service.getDiagnostics('src/file.ts')[0].message).toBe('Gen 11 analysis');

      // Older Generation 10 completes later -> MUST be rejected!
      col.set('src/file.ts', [diag1], { generation: 10 });
      expect(service.getDiagnostics('src/file.ts')).toHaveLength(1);
      expect(service.getDiagnostics('src/file.ts')[0].message).toBe('Gen 11 analysis');
    });

    it('rejects diagnostics if workspace generation does not match active workspace', () => {
      const col = service.createCollection('workspace-scanner');
      vi.spyOn(globalWorkspaceEngine, 'getGeneration').mockReturnValue(5);

      const diag = validateDiagnostic({ uri: 'src/config.ts', message: 'Old workspace config err' }, 'workspace-scanner');

      // Supplied with obsolete workspace generation 4
      col.set('src/config.ts', [diag], { workspaceGeneration: 4 });
      expect(service.getDiagnostics('src/config.ts')).toHaveLength(0);

      // Supplied with matching workspace generation 5
      col.set('src/config.ts', [diag], { workspaceGeneration: 5 });
      expect(service.getDiagnostics('src/config.ts')).toHaveLength(1);
    });

    it('rejects diagnostics if expected document revision has advanced', () => {
      const col = service.createCollection('ts-server');

      // Mock open document in DocumentEngine with revision 43
      vi.spyOn(globalDocumentEngine, 'getByResource').mockReturnValue({
        id: 'doc-1',
        contentRevision: 43,
      } as any);

      const diag = validateDiagnostic({ uri: 'src/index.ts', message: 'Stale type error' }, 'ts-server');

      // Diagnostic produced against revision 42
      col.set('src/index.ts', [diag], { documentRevision: 42 });
      expect(service.getDiagnostics('src/index.ts')).toHaveLength(0);

      // Diagnostic produced against current revision 43
      col.set('src/index.ts', [diag], { documentRevision: 43 });
      expect(service.getDiagnostics('src/index.ts')).toHaveLength(1);
    });
  });

  describe('4. Task & Problem Matcher Run Isolation', () => {
    it('ensures newer task runs reject delayed results from older runs', () => {
      const provider = new TaskDiagnosticProvider();

      const runA = 'session-101';
      const runB = 'session-102';

      const genA = provider.startTaskRun('task-build', runA);
      const genB = provider.startTaskRun('task-build', runB);

      expect(genB).toBeGreaterThan(genA);

      const probA: Problem = {
        id: 'p-1',
        file: 'src/main.ts',
        line: 10,
        column: 5,
        message: 'Older build error',
        severity: 'error',
        source: 'tsc',
        taskId: 'task-build',
      };

      const probB: Problem = {
        id: 'p-2',
        file: 'src/main.ts',
        line: 25,
        column: 1,
        message: 'Newer build error',
        severity: 'error',
        source: 'tsc',
        taskId: 'task-build',
      };

      // Run B completes first
      const publishedB = provider.publishTaskProblems('task-build', runB, [probB]);
      expect(publishedB).toBe(true);

      // Slower Run A completes later -> must be rejected
      const publishedA = provider.publishTaskProblems('task-build', runA, [probA]);
      expect(publishedA).toBe(false);

      provider.dispose();
    });

    it('correctly maps legacy Problems to canonical Diagnostics and back', () => {
      const prob: Problem = {
        id: 'prob-99',
        file: 'src/components/Btn.tsx',
        line: 5,
        column: 2,
        endLine: 5,
        endColumn: 12,
        message: 'JSX attribute expected',
        severity: 'warning',
        source: 'eslint',
        code: 'jsx-attr',
        taskId: 'task-lint',
        workspaceId: 'ws-1',
      };

      const diag = problemToDiagnostic(prob, 3);
      expect(diag.id).toBe('prob-99');
      expect(diag.uri).toBe('src/components/Btn.tsx');
      expect(diag.range?.startLine).toBe(5);
      expect(diag.generation).toBe(3);
      expect(diag.severity).toBe('warning');

      const convertedBack = diagnosticToProblem(diag);
      expect(convertedBack.id).toBe(prob.id);
      expect(convertedBack.file).toBe(prob.file);
      expect(convertedBack.line).toBe(5);
      expect(convertedBack.code).toBe('jsx-attr');
    });
  });

  describe('5. Resource Lifecycle Coordination', () => {
    it('reassigns diagnostics when a resource is renamed across collections', () => {
      const colA = service.createCollection('ts');
      const colB = service.createCollection('eslint');

      colA.set('src/OldName.ts', [validateDiagnostic({ uri: 'src/OldName.ts', message: 'TS Err' }, 'ts')]);
      colB.set('src/OldName.ts', [validateDiagnostic({ uri: 'src/OldName.ts', message: 'Lint Err' }, 'eslint')]);

      expect(service.getDiagnostics('src/OldName.ts')).toHaveLength(2);
      expect(service.getDiagnostics('src/NewName.ts')).toHaveLength(0);

      service.handleResourceRenamed('src/OldName.ts', 'src/NewName.ts');

      expect(service.getDiagnostics('src/OldName.ts')).toHaveLength(0);
      const newDiags = service.getDiagnostics('src/NewName.ts');
      expect(newDiags).toHaveLength(2);
      expect(newDiags.every((d) => d.uri === 'src/NewName.ts')).toBe(true);
    });

    it('cleans up diagnostics across all collections when a resource is deleted', () => {
      const colA = service.createCollection('ts');
      const colB = service.createCollection('eslint');

      colA.set('src/temp.ts', [validateDiagnostic({ uri: 'src/temp.ts', message: 'TS Err' }, 'ts')]);
      colB.set('src/temp.ts', [validateDiagnostic({ uri: 'src/temp.ts', message: 'Lint Err' }, 'eslint')]);

      expect(service.getDiagnostics('src/temp.ts')).toHaveLength(2);

      service.handleResourceDeleted('src/temp.ts');

      expect(service.getDiagnostics('src/temp.ts')).toHaveLength(0);
    });

    it('clears all diagnostics on workspace change to prevent cross-workspace leakage', () => {
      const col = service.createCollection('tasks');
      col.set('file1.ts', [validateDiagnostic({ uri: 'file1.ts', message: 'Err' }, 'tasks')]);
      col.set('file2.ts', [validateDiagnostic({ uri: 'file2.ts', message: 'Err' }, 'tasks')]);

      expect(service.getDiagnostics()).toHaveLength(2);

      service.handleWorkspaceChanged('new-workspace', 2);
      expect(service.getDiagnostics()).toHaveLength(0);
    });
  });

  describe('6. Summaries, Directory Aggregation & Explorer Badges', () => {
    it('computes accurate resource and directory summaries', () => {
      const col = service.createCollection('build');
      col.set('src/components/Header.tsx', [
        validateDiagnostic({ uri: 'src/components/Header.tsx', message: 'Err 1', severity: 'error' }, 'build'),
        validateDiagnostic({ uri: 'src/components/Header.tsx', message: 'Warn 1', severity: 'warning' }, 'build'),
      ]);
      col.set('src/components/Footer.tsx', [
        validateDiagnostic({ uri: 'src/components/Footer.tsx', message: 'Err 2', severity: 'error' }, 'build'),
      ]);
      col.set('src/utils/math.ts', [
        validateDiagnostic({ uri: 'src/utils/math.ts', message: 'Warn 2', severity: 'warning' }, 'build'),
      ]);

      // Resource summary
      const headerSum = service.getResourceSummary('src/components/Header.tsx');
      expect(headerSum.total).toBe(2);
      expect(headerSum.errorCount).toBe(1);
      expect(headerSum.warningCount).toBe(1);

      // Directory summary for src/components
      const compDirSum = service.getDirectorySummary('src/components');
      expect(compDirSum.total).toBe(3);
      expect(compDirSum.errorCount).toBe(2);
      expect(compDirSum.warningCount).toBe(1);

      // Directory summary for entire src
      const srcDirSum = service.getDirectorySummary('src');
      expect(srcDirSum.total).toBe(4);
      expect(srcDirSum.errorCount).toBe(2);
      expect(srcDirSum.warningCount).toBe(2);
    });
  });

  describe('7. Navigation Target Validation & Bounds Clamping', () => {
    it('clamps line coordinate safely when document buffer has fewer lines', () => {
      vi.spyOn(globalDocumentEngine, 'getByResource').mockReturnValue({
        id: 'doc-small',
        content: 'line 1\nline 2\nline 3', // 3 lines
      } as any);

      const diag: Diagnostic = {
        id: 'd-1',
        uri: 'src/small.ts',
        range: { startLine: 100, startColumn: 5, endLine: 100, endColumn: 10 },
        severity: 'error',
        message: 'Out of bounds line',
        source: 'ts',
        createdAt: 0,
      };

      const result = service.validateNavigationTarget(diag);
      expect(result.valid).toBe(true);
      expect(result.line).toBe(3); // Clamped to line count 3!
      expect(result.column).toBe(5);
      expect(result.isResourceLevel).toBe(false);
    });

    it('identifies resource-level diagnostics for safe file opening without jumping', () => {
      const diag: Diagnostic = {
        id: 'd-res',
        uri: 'tsconfig.json',
        range: undefined,
        severity: 'error',
        message: 'Invalid compilerOptions',
        source: 'tsconfig',
        createdAt: 0,
      };

      const result = service.validateNavigationTarget(diag);
      expect(result.valid).toBe(true);
      expect(result.isResourceLevel).toBe(true);
      expect(result.line).toBe(1);
    });
  });

  describe('8. Performance & High Volume Management', () => {
    it('efficiently handles 1,000 diagnostics across multiple collections without degradation', () => {
      const colA = service.createCollection('perf-linter');
      const colB = service.createCollection('perf-compiler');

      const batchA: Diagnostic[] = [];
      const batchB: Diagnostic[] = [];

      for (let i = 1; i <= 500; i++) {
        batchA.push(
          validateDiagnostic(
            {
              uri: `src/file_${i % 50}.ts`,
              message: `Lint rule violation ${i}`,
              severity: 'warning',
              range: { startLine: i, startColumn: 1, endLine: i, endColumn: 10 },
            },
            'perf-linter'
          )
        );
        batchB.push(
          validateDiagnostic(
            {
              uri: `src/file_${i % 50}.ts`,
              message: `Type check error ${i}`,
              severity: 'error',
              range: { startLine: i, startColumn: 5, endLine: i, endColumn: 15 },
            },
            'perf-compiler'
          )
        );
      }

      const t0 = performance.now();
      for (let f = 0; f < 50; f++) {
        const fileUri = `src/file_${f}.ts`;
        colA.set(fileUri, batchA.filter((d) => d.uri === fileUri));
        colB.set(fileUri, batchB.filter((d) => d.uri === fileUri));
      }
      const t1 = performance.now();

      expect(t1 - t0).toBeLessThan(1500); // Fast population under 1.5s
      const all = service.getDiagnostics();
      expect(all).toHaveLength(1000);

      const summary = service.getSummary();
      expect(summary.total).toBe(1000);
      expect(summary.errorCount).toBe(500);
      expect(summary.warningCount).toBe(500);
    });
  });
});
