/**
 * QM Editor — LSP Call Hierarchy Mapper Tests
 * Phase 06, Step 70 — LSP Call Hierarchy, Callers, Callees & Safe Cross-File Code Relationship Navigation
 */

import { describe, it, expect } from 'vitest';
import { LspCallHierarchyMapper } from './LspCallHierarchyMapper';
import { LspCallHierarchyItem, LspRange, LspSymbolKind, LspSymbolTag } from '../LspTypes';
import { LspUriMapper } from '../LspUriMapper';

describe('LspCallHierarchyMapper', () => {
  const lspRange: LspRange = {
    start: { line: 4, character: 2 },
    end: { line: 10, character: 15 },
  };

  it('maps 0-based LSP range to 1-based canonical Range', () => {
    const canonical = LspCallHierarchyMapper.mapRange(lspRange);
    expect(canonical.startLine).toBe(5);
    expect(canonical.startColumn).toBe(3);
    expect(canonical.endLine).toBe(11);
    expect(canonical.endColumn).toBe(16);
  });

  it('maps numeric LSP symbol kind to canonical SymbolKind string', () => {
    expect(LspCallHierarchyMapper.mapKind(LspSymbolKind.Function)).toBe('function');
    expect(LspCallHierarchyMapper.mapKind(LspSymbolKind.Method)).toBe('method');
    expect(LspCallHierarchyMapper.mapKind(LspSymbolKind.Class)).toBe('class');
    expect(LspCallHierarchyMapper.mapKind(LspSymbolKind.Constructor)).toBe('constructor');
  });

  it('maps symbol tags including deprecated', () => {
    expect(LspCallHierarchyMapper.mapTags([LspSymbolTag.Deprecated])).toEqual(['deprecated']);
    expect(LspCallHierarchyMapper.mapTags(undefined)).toBeUndefined();
  });

  it('maps LspCallHierarchyItem to QmCallHierarchyItem', () => {
    const raw: LspCallHierarchyItem = {
      name: 'processPayment',
      kind: LspSymbolKind.Method,
      detail: '(amount: number) => Promise<boolean>',
      uri: 'file:///workspace/src/payment.ts',
      range: lspRange,
      selectionRange: {
        start: { line: 4, character: 9 },
        end: { line: 4, character: 23 },
      },
      tags: [LspSymbolTag.Deprecated],
    };

    const mapped = LspCallHierarchyMapper.mapCallHierarchyItem(raw, {
      workspaceId: 'test-ws',
      providerId: 'sess-1',
      providerGeneration: 1,
      documentRevision: 3,
    });

    expect(mapped.name).toBe('processPayment');
    expect(mapped.kind).toBe('method');
    expect(mapped.uri).toBe(LspUriMapper.uriToPath('file:///workspace/src/payment.ts'));
    expect(mapped.range.startLine).toBe(5);
    expect(mapped.selectionRange.startLine).toBe(5);
    expect(mapped.selectionRange.startColumn).toBe(10);
    expect(mapped.tags).toEqual(['deprecated']);
    expect(mapped.providerId).toBe('sess-1');
  });

  it('maps QmCallHierarchyItem to Location (using selectionRange)', () => {
    const item = LspCallHierarchyMapper.mapCallHierarchyItem(
      {
        name: 'testFn',
        kind: LspSymbolKind.Function,
        uri: 'file:///workspace/src/test.ts',
        range: lspRange,
        selectionRange: lspRange,
      },
      {
        workspaceId: 'test-ws',
        providerId: 'sess-1',
        providerGeneration: 1,
        documentRevision: 1,
      }
    );

    const location = LspCallHierarchyMapper.itemToLocation(item);
    expect(location.uri).toBe(LspUriMapper.uriToPath('file:///workspace/src/test.ts'));
    expect(location.range).toEqual(item.selectionRange);
    expect(location.selectionRange).toEqual(item.selectionRange);
  });

  it('maps call site range to Location', () => {
    const item = LspCallHierarchyMapper.mapCallHierarchyItem(
      {
        name: 'callerFn',
        kind: LspSymbolKind.Function,
        uri: 'file:///workspace/src/caller.ts',
        range: lspRange,
        selectionRange: lspRange,
      },
      {
        workspaceId: 'test-ws',
        providerId: 'sess-1',
        providerGeneration: 1,
        documentRevision: 1,
      }
    );

    const siteRange = { startLine: 15, startColumn: 4, endLine: 15, endColumn: 20 };
    const location = LspCallHierarchyMapper.callSiteToLocation(item, siteRange);
    expect(location.uri).toBe(LspUriMapper.uriToPath('file:///workspace/src/caller.ts'));
    expect(location.range).toEqual(siteRange);
  });
});
