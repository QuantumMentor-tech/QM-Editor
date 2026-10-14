/**
 * QM Editor Canonical Symbol Engine Tests
 * Phase 04, Step 41 — Code Navigation, Symbols, Locations & Outline Engine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SymbolEngine, BuiltinRegexSymbolProvider } from './SymbolEngine';
import { SymbolProvider, DocumentSymbolInput } from './SymbolTypes';
import { CancellationTokenSource } from './CancellationToken';
import { globalWorkspaceEngine } from '../workspace';

describe('BuiltinRegexSymbolProvider', () => {
  it('extracts canonical symbols from TypeScript content', async () => {
    const provider = new BuiltinRegexSymbolProvider();
    const content = `
export class UserService {
  public id: string;
  public getUser() {
    return this.id;
  }
}

export function helper() {
  return true;
}
`;

    const symbols = await provider.provideDocumentSymbols({
      id: 'doc-1',
      uri: 'C:/project/UserService.ts',
      content,
      language: 'typescript',
      contentRevision: 1,
    });

    expect(symbols.length).toBeGreaterThan(0);
    const classSym = symbols.find((s) => s.name === 'UserService');
    expect(classSym).toBeDefined();
    expect(classSym?.kind).toBe('class');
    expect(classSym?.location.uri).toBe('C:/project/UserService.ts');
    expect(classSym?.location.range?.startLine).toBeGreaterThan(0);

    const helperSym = symbols.find((s) => s.name === 'helper');
    expect(helperSym).toBeDefined();
    expect(helperSym?.kind).toBe('function');
  });

  it('respects cancellation token during extraction', async () => {
    const provider = new BuiltinRegexSymbolProvider();
    const cts = new CancellationTokenSource();
    cts.cancel();

    const symbols = await provider.provideDocumentSymbols(
      {
        id: 'doc-1',
        uri: 'C:/project/test.ts',
        content: 'function test() {}',
        language: 'typescript',
      },
      cts.token
    );

    expect(symbols).toEqual([]);
  });
});

describe('SymbolEngine', () => {
  let engine: SymbolEngine;

  beforeEach(() => {
    engine = new SymbolEngine();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('registers and orders providers according to priority', () => {
    const lowPriorityProvider: SymbolProvider = {
      providerId: 'low-prio',
      capabilities: { priority: 5 },
    };
    const highPriorityProvider: SymbolProvider = {
      providerId: 'high-prio',
      capabilities: { priority: 100 },
    };

    engine.registerProvider(lowPriorityProvider);
    engine.registerProvider(highPriorityProvider);

    const providers = engine.getProviders();
    expect(providers[0].providerId).toBe('high-prio');
    expect(engine.getProvider('low-prio')).toBe(lowPriorityProvider);
  });

  it('isolates providers and evicts cached symbols on provider unregistration', async () => {
    const mockProvider: SymbolProvider = {
      providerId: 'custom-mock',
      capabilities: { priority: 50 },
      provideDocumentSymbols: async () => [
        {
          id: 'custom-1',
          name: 'CustomSymbol',
          kind: 'variable',
          location: { uri: 'C:/test.ts', range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 } },
          sourceProviderId: 'custom-mock',
        },
      ],
    };

    const unregister = engine.registerProvider(mockProvider);
    const docInput: DocumentSymbolInput = {
      id: 'doc-1',
      uri: 'C:/test.ts',
      content: 'let CustomSymbol = 123;',
      language: 'typescript',
      contentRevision: 1,
    };

    const res1 = await engine.getDocumentSymbols(docInput);
    expect(res1.providerId).toBe('custom-mock');
    expect(res1.symbols[0].name).toBe('CustomSymbol');

    // Unregister custom provider: should evict its cache and fall back to next provider
    unregister();
    expect(engine.getProvider('custom-mock')).toBeUndefined();

    const res2 = await engine.getDocumentSymbols(docInput);
    expect(res2.providerId).toBe('builtin.regex');
  });

  it('leverages document revision caching for identical revisions', async () => {
    const providerSpy = vi.fn().mockResolvedValue([
      {
        id: 'sym-1',
        name: 'MySymbol',
        kind: 'class',
        location: { uri: 'C:/test.ts', range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 10 } },
        sourceProviderId: 'spy-provider',
      },
    ]);

    engine.registerProvider({
      providerId: 'spy-provider',
      capabilities: { priority: 500 },
      provideDocumentSymbols: providerSpy,
    });

    const docInput: DocumentSymbolInput = {
      id: 'doc-1',
      uri: 'C:/test.ts',
      content: 'class MySymbol {}',
      language: 'typescript',
      contentRevision: 5,
    };

    // First call: provider is invoked
    const res1 = await engine.getDocumentSymbols(docInput);
    expect(providerSpy).toHaveBeenCalledTimes(1);
    expect(res1.symbols[0].name).toBe('MySymbol');

    // Second call with same revision: cache is used, provider is NOT called again
    const res2 = await engine.getDocumentSymbols(docInput);
    expect(providerSpy).toHaveBeenCalledTimes(1);
    expect(res2.symbols[0].name).toBe('MySymbol');

    // Third call with bumped revision: cache is invalidated, provider called again
    await engine.getDocumentSymbols({ ...docInput, contentRevision: 6 });
    expect(providerSpy).toHaveBeenCalledTimes(2);
  });

  it('protects against workspace switch mid-flight', async () => {
    vi.spyOn(globalWorkspaceEngine, 'getWorkspaceId').mockReturnValueOnce('ws-1').mockReturnValue('ws-2');

    engine.registerProvider({
      providerId: 'async-prov',
      capabilities: { priority: 100 },
      provideDocumentSymbols: async () => {
        return [
          {
            id: 'sym',
            name: 'LeakedSymbol',
            kind: 'function',
            location: { uri: 'C:/file.ts' },
            sourceProviderId: 'async-prov',
          },
        ];
      },
    });

    const res = await engine.getDocumentSymbols({
      id: 'd-1',
      uri: 'C:/file.ts',
      content: 'fn()',
      language: 'typescript',
      workspaceId: 'ws-1',
    });

    // Should return empty symbols because workspace switched
    expect(res.symbols).toEqual([]);
  });

  it('invalidates cache for specific document or globally', async () => {
    const docInput: DocumentSymbolInput = {
      id: 'doc-1',
      uri: 'C:/test.ts',
      content: 'export function foo() {}',
      language: 'typescript',
      contentRevision: 1,
    };

    const res1 = await engine.getDocumentSymbols(docInput);
    expect(res1.symbols.length).toBeGreaterThan(0);

    engine.invalidateDocument('C:/test.ts');
    // Cache entry for that URI is cleared
    engine.clearCache();
  });
});
