import { describe, it, expect, beforeEach } from 'vitest';
import { SymbolService } from './SymbolService';
import { DocumentModel } from '../../types';
import { CancellationTokenSource } from './CancellationToken';

describe('SymbolService', () => {
  let service: SymbolService;

  beforeEach(() => {
    service = new SymbolService();
  });

  const createMockDoc = (id: string, content: string, revision = 0): DocumentModel => ({
    id,
    title: `${id}.ts`,
    filePath: `src/${id}.ts`,
    language: 'typescript',
    content,
    contentRevision: revision,
    savedRevision: revision,
    isDirty: false,
    lastSavedTimestamp: Date.now(),
  });

  it('extracts document symbols and caches them by revision', async () => {
    const doc = createMockDoc('doc-1', 'export function calculateTotal() {}', 1);

    const firstResult = await service.getDocumentSymbols(doc);
    expect(firstResult.length).toBe(1);
    expect(firstResult[0].name).toBe('calculateTotal');

    // Second call with same revision returns cached array reference
    const secondResult = await service.getDocumentSymbols(doc);
    expect(secondResult).toBe(firstResult);

    // Call with updated revision re-computes symbols
    const updatedDoc = createMockDoc('doc-1', 'export class InvoiceManager {}', 2);
    const thirdResult = await service.getDocumentSymbols(updatedDoc);
    expect(thirdResult.length).toBe(1);
    expect(thirdResult[0].name).toBe('InvoiceManager');
  });

  it('honors cancellation tokens during symbol extraction', async () => {
    const doc = createMockDoc('doc-cancel', 'export function runProcess() {}', 1);
    const cts = new CancellationTokenSource();
    cts.cancel();

    const symbols = await service.getDocumentSymbols(doc, cts.token);
    expect(symbols).toEqual([]);
  });

  it('clears cache per document or globally', async () => {
    const doc1 = createMockDoc('d1', 'export function fn1() {}', 1);
    const doc2 = createMockDoc('d2', 'export function fn2() {}', 1);

    await service.getDocumentSymbols(doc1);
    await service.getDocumentSymbols(doc2);

    service.clearCache('d1');
    // d1 will re-extract
    const res1 = await service.getDocumentSymbols(doc1);
    expect(res1[0].name).toBe('fn1');

    service.clearCache();
    service.dispose();
  });
});
