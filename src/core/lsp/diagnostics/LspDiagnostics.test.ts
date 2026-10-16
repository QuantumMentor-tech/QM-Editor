/**
 * QM Editor LSP Diagnostics Integration, Validation & Lifecycle Tests
 * Phase 06, Step 57 — LSP Diagnostics Integration, Problems Synchronization & Diagnostic Lifecycle
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LspDiagnosticValidator } from './LspDiagnosticValidator';
import { LspDiagnosticMapper } from './LspDiagnosticMapper';
import { LspDiagnosticsBridge } from '../LspDiagnosticsBridge';
import { globalDiagnosticService } from '../../diagnostics/DiagnosticService';
import { PublishDiagnosticsParams, LspDiagnostic } from '../LspTypes';

describe('LSP Diagnostics Validation & Sanitization', () => {
  it('validates a well-formed publishDiagnostics payload', () => {
    const payload: PublishDiagnosticsParams = {
      uri: 'file:///C:/project/src/index.ts',
      version: 2,
      diagnostics: [
        {
          range: {
            start: { line: 0, character: 4 },
            end: { line: 0, character: 10 },
          },
          severity: 1,
          code: 2304,
          source: 'typescript',
          message: 'Cannot find name "myVar".',
        },
      ],
    };

    const result = LspDiagnosticValidator.validatePayload(payload);
    expect(result.valid).toBe(true);
    expect(result.sanitizedParams?.diagnostics).toHaveLength(1);
    expect(result.quarantinedCount).toBe(0);
  });

  it('rejects invalid payloads with missing URI or non-array diagnostics', () => {
    const invalid1 = LspDiagnosticValidator.validatePayload(null);
    expect(invalid1.valid).toBe(false);
    expect(invalid1.error).toContain('null or not an object');

    const invalid2 = LspDiagnosticValidator.validatePayload({ uri: '', diagnostics: [] });
    expect(invalid2.valid).toBe(false);
    expect(invalid2.error).toContain('missing or empty');

    const invalid3 = LspDiagnosticValidator.validatePayload({ uri: 'file:///a.ts', diagnostics: 'not-array' });
    expect(invalid3.valid).toBe(false);
    expect(invalid3.error).toContain('must be an array');
  });

  it('quarantines malformed diagnostic items with invalid or negative ranges', () => {
    const payload = {
      uri: 'file:///C:/project/test.ts',
      diagnostics: [
        {
          range: { start: { line: -1, character: 0 }, end: { line: 0, character: 5 } },
          message: 'Negative line',
        },
        {
          range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } },
          message: 'Valid item',
        },
        {
          range: null,
          message: 'Missing range',
        },
      ],
    };

    const result = LspDiagnosticValidator.validatePayload(payload);
    expect(result.valid).toBe(true);
    expect(result.sanitizedParams?.diagnostics).toHaveLength(1);
    expect(result.sanitizedParams?.diagnostics[0].message).toBe('Valid item');
    expect(result.quarantinedCount).toBe(2);
  });

  it('normalizes inverted ranges by swapping start and end coordinates', () => {
    const invertedRange = {
      start: { line: 10, character: 5 },
      end: { line: 5, character: 2 },
    };

    const normalized = LspDiagnosticValidator.validateRange(invertedRange);
    expect(normalized).not.toBeNull();
    expect(normalized?.start.line).toBe(5);
    expect(normalized?.start.character).toBe(2);
    expect(normalized?.end.line).toBe(10);
    expect(normalized?.end.character).toBe(5);
  });

  it('sanitizes malicious URLs in codeDescription and rejects javascript: and data: schemes', () => {
    expect(LspDiagnosticValidator.sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(LspDiagnosticValidator.sanitizeUrl('data:text/html,<h1>XSS</h1>')).toBeNull();
    expect(LspDiagnosticValidator.sanitizeUrl('file:///etc/passwd')).toBeNull();
    expect(LspDiagnosticValidator.sanitizeUrl('https://typescriptlang.org/docs/errors#2304')).toBe(
      'https://typescriptlang.org/docs/errors#2304'
    );
    expect(LspDiagnosticValidator.sanitizeUrl('http://example.com/rule')).toBe('http://example.com/rule');
  });

  it('truncates oversized messages to prevent UI denial of service', () => {
    const hugeMessage = 'A'.repeat(5000);
    const item = LspDiagnosticValidator.validateDiagnosticItem(
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        message: hugeMessage,
      },
      0
    );

    expect(item).not.toBeNull();
    expect(item!.message.length).toBeLessThan(4100);
    expect(item!.message).toContain('(truncated)');
  });

  it('caps diagnostics to maxPerDocument setting to protect editor performance', () => {
    const diagnostics: LspDiagnostic[] = [];
    for (let i = 0; i < 50; i++) {
      diagnostics.push({
        range: { start: { line: i, character: 0 }, end: { line: i, character: 1 } },
        message: `Error ${i}`,
      });
    }

    const result = LspDiagnosticValidator.validatePayload(
      { uri: 'file:///test.ts', diagnostics },
      20 // Max per document = 20
    );

    expect(result.sanitizedParams?.diagnostics).toHaveLength(20);
    expect(result.quarantinedCount).toBe(30);
  });
});

describe('LSP Diagnostic Mapper', () => {
  it('translates 0-based LSP coordinates to 1-based canonical coordinates', () => {
    const lspDiag: LspDiagnostic = {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 2, character: 15 },
      },
      severity: 1,
      message: 'Syntax error',
      source: 'tsc',
    };

    const canonical = LspDiagnosticMapper.toCanonicalDiagnostic(
      lspDiag,
      'C:\\project\\file.ts',
      0,
      {
        sessionId: 'typescript-lsp::ws-1',
        serverDefinitionId: 'typescript-lsp',
        displayName: 'TypeScript',
        workspaceId: 'ws-1',
        generation: 1,
        sessionState: 'running',
      }
    );

    expect(canonical.range?.startLine).toBe(1);
    expect(canonical.range?.startColumn).toBe(1);
    expect(canonical.range?.endLine).toBe(3);
    expect(canonical.range?.endColumn).toBe(16);
    expect(canonical.providerId).toBe('lsp:typescript-lsp');
    expect(canonical.source).toBe('tsc');
    expect(canonical.severity).toBe('error');
  });

  it('maps severities correctly', () => {
    expect(LspDiagnosticMapper.mapSeverity(1)).toBe('error');
    expect(LspDiagnosticMapper.mapSeverity(2)).toBe('warning');
    expect(LspDiagnosticMapper.mapSeverity(3)).toBe('info');
    expect(LspDiagnosticMapper.mapSeverity(4)).toBe('hint');
    expect(LspDiagnosticMapper.mapSeverity(undefined)).toBe('error');
  });

  it('maps tags (unnecessary, deprecated) correctly', () => {
    expect(LspDiagnosticMapper.mapTags([1])).toEqual(['unnecessary']);
    expect(LspDiagnosticMapper.mapTags([2])).toEqual(['deprecated']);
    expect(LspDiagnosticMapper.mapTags([1, 2])).toEqual(['unnecessary', 'deprecated']);
    expect(LspDiagnosticMapper.mapTags(undefined)).toBeUndefined();
    expect(LspDiagnosticMapper.mapTags([])).toBeUndefined();
  });

  it('maps related information with 1-based coordinates and canonical paths', () => {
    const lspDiag: LspDiagnostic = {
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      message: 'Original error',
      relatedInformation: [
        {
          location: {
            uri: 'file:///C:/project/other.ts',
            range: { start: { line: 9, character: 4 }, end: { line: 9, character: 10 } },
          },
          message: 'Referenced here',
        },
      ],
    };

    const canonical = LspDiagnosticMapper.toCanonicalDiagnostic(lspDiag, 'C:\\project\\file.ts', 0);
    expect(canonical.relatedInformation).toHaveLength(1);
    expect(canonical.relatedInformation![0].message).toBe('Referenced here');
    expect(canonical.relatedInformation![0].location.range.startLine).toBe(10);
    expect(canonical.relatedInformation![0].location.range.startColumn).toBe(5);
    expect(canonical.relatedInformation![0].location.uri).toBe('C:\\project\\other.ts');
  });
});

describe('LSP Diagnostics Bridge & Diagnostics Engine Integration', () => {
  let bridge: LspDiagnosticsBridge;

  beforeEach(() => {
    bridge = LspDiagnosticsBridge.getInstance();
    bridge.clearAll();
  });

  afterEach(() => {
    bridge.clearAll();
  });

  it('publishes diagnostics into DiagnosticService under server-specific provider ID', () => {
    const context = {
      sessionId: 'typescript-lsp::ws-test',
      serverDefinitionId: 'typescript-lsp',
      displayName: 'TypeScript Language Server',
      workspaceId: 'ws-test',
      generation: 1,
      sessionState: 'running' as const,
    };

    bridge.registerSession(context.sessionId, 1);

    bridge.handlePublishDiagnostics(
      {
        uri: 'file:///C:/test/app.ts',
        diagnostics: [
          {
            range: { start: { line: 4, character: 2 }, end: { line: 4, character: 8 } },
            severity: 1,
            message: 'Variable not declared',
            source: 'typescript',
          },
        ],
      },
      context
    );

    const diags = globalDiagnosticService.getDiagnostics('C:\\test\\app.ts');
    expect(diags).toHaveLength(1);
    expect(diags[0].message).toBe('Variable not declared');
    expect(diags[0].providerId).toBe('lsp:typescript-lsp');
    expect(diags[0].range?.startLine).toBe(5);
    expect(diags[0].range?.startColumn).toBe(3);
  });

  it('clears previous diagnostics when an empty publication arrives for a resource', () => {
    const context = {
      sessionId: 'typescript-lsp::ws-test',
      serverDefinitionId: 'typescript-lsp',
      displayName: 'TypeScript Language Server',
      workspaceId: 'ws-test',
      generation: 1,
      sessionState: 'running' as const,
    };
    bridge.registerSession(context.sessionId, 1);

    // Initial publication with 1 error
    bridge.handlePublishDiagnostics(
      {
        uri: 'file:///C:/test/clear-me.ts',
        diagnostics: [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
            message: 'Error before fix',
          },
        ],
      },
      context
    );
    expect(globalDiagnosticService.getDiagnostics('C:\\test\\clear-me.ts')).toHaveLength(1);

    // Empty publication arriving after user fixes code
    bridge.handlePublishDiagnostics(
      {
        uri: 'file:///C:/test/clear-me.ts',
        diagnostics: [],
      },
      context
    );
    expect(globalDiagnosticService.getDiagnostics('C:\\test\\clear-me.ts')).toHaveLength(0);
  });

  it('preserves multi-provider isolation (LSP does not overwrite task or other provider diagnostics)', () => {
    const resource = 'C:\\test\\multi-provider.ts';

    // 1. Task Runner publishes a diagnostic
    const taskCol = globalDiagnosticService.createCollection('tasks');
    taskCol.set(resource, [
      {
        id: 'task-err-1',
        uri: resource,
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 },
        severity: 'error',
        message: 'Build task failure',
        source: 'tasks',
        createdAt: Date.now(),
      },
    ]);

    // 2. LSP publishes diagnostics
    const context = {
      sessionId: 'typescript-lsp::ws-test',
      serverDefinitionId: 'typescript-lsp',
      displayName: 'TypeScript',
      workspaceId: 'ws-test',
      generation: 1,
      sessionState: 'running' as const,
    };
    bridge.registerSession(context.sessionId, 1);

    bridge.handlePublishDiagnostics(
      {
        uri: 'file:///C:/test/multi-provider.ts',
        diagnostics: [
          {
            range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } },
            message: 'LSP Type mismatch',
          },
        ],
      },
      context
    );

    // Both diagnostics must coexist in the unified diagnostic store
    const aggregated = globalDiagnosticService.getDiagnostics(resource);
    expect(aggregated).toHaveLength(2);
    expect(aggregated.some((d) => d.source === 'tasks')).toBe(true);
    expect(aggregated.some((d) => d.providerId === 'lsp:typescript-lsp')).toBe(true);

    // 3. LSP clears its diagnostics; task diagnostic must survive untouched
    bridge.handlePublishDiagnostics(
      {
        uri: 'file:///C:/test/multi-provider.ts',
        diagnostics: [],
      },
      context
    );

    const afterLspClear = globalDiagnosticService.getDiagnostics(resource);
    expect(afterLspClear).toHaveLength(1);
    expect(afterLspClear[0].message).toBe('Build task failure');

    // Clean up task collection
    taskCol.clear();
  });

  it('rejects stale diagnostics arriving from an older session generation', () => {
    const resource = 'C:\\test\\stale-gen.ts';
    const sessionId = 'typescript-lsp::ws-test';

    // Session restarts and generation advances to 2
    bridge.registerSession(sessionId, 2);

    // Stale diagnostic from generation 1 arrives
    bridge.handlePublishDiagnostics(
      {
        uri: 'file:///C:/test/stale-gen.ts',
        diagnostics: [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
            message: 'Stale error from old server run',
          },
        ],
      },
      {
        sessionId,
        serverDefinitionId: 'typescript-lsp',
        displayName: 'TypeScript',
        workspaceId: 'ws-test',
        generation: 1, // Stale!
        sessionState: 'running',
      }
    );

    expect(globalDiagnosticService.getDiagnostics(resource)).toHaveLength(0);
  });

  it('clears server diagnostics on clearForServer', () => {
    const resource = 'C:\\test\\server-restart.ts';
    const context = {
      sessionId: 'typescript-lsp::ws-test',
      serverDefinitionId: 'typescript-lsp',
      displayName: 'TypeScript',
      workspaceId: 'ws-test',
      generation: 1,
      sessionState: 'running' as const,
    };
    bridge.registerSession(context.sessionId, 1);

    bridge.handlePublishDiagnostics(
      {
        uri: 'file:///C:/test/server-restart.ts',
        diagnostics: [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
            message: 'Active error',
          },
        ],
      },
      context
    );
    expect(globalDiagnosticService.getDiagnostics(resource)).toHaveLength(1);

    // Server session stops or crashes -> clearForServer is invoked
    bridge.clearForServer('typescript-lsp');
    expect(globalDiagnosticService.getDiagnostics(resource)).toHaveLength(0);
  });
});
