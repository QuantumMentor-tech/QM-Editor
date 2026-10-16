/**
 * QM Editor LSP Workspace Symbols Test Suite
 * Phase 06, Step 61 — LSP Workspace Symbols, Cross-File Symbol Search & Symbol Navigation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LspWorkspaceSymbolValidator } from './LspWorkspaceSymbolValidator';
import { LspWorkspaceSymbolMapper } from './LspWorkspaceSymbolMapper';
import { LspWorkspaceSymbolProvider } from './LspWorkspaceSymbolProvider';
import { SanitizedWorkspaceSymbolItem } from './LspWorkspaceSymbolTypes';
import { LspSymbolKind, LspSymbolTag, RequestMessage } from '../LspTypes';
import { MockLspTransport } from '../transport/MockLspTransport';
import { LspServerRegistry } from '../LspServerRegistry';
import { LspServerManager } from '../LspServerManager';
import { globalWorkspaceEngine } from '../../workspace';
import { SettingsService } from '../../settings/SettingsService';
import { SymbolEngine } from '../../symbols/SymbolEngine';

describe('LspWorkspaceSymbolValidator', () => {
  it('validates and normalizes queries', () => {
    const res = LspWorkspaceSymbolValidator.validateQuery('  UserService  ');
    expect(res.valid).toBe(true);
    expect(res.value).toBe('UserService');

    // Strips control characters
    const ctrlRes = LspWorkspaceSymbolValidator.validateQuery('User\x00\x08Service\x1F');
    expect(ctrlRes.valid).toBe(true);
    expect(ctrlRes.value).toBe('UserService');

    // Clamps long queries to 256
    const longQuery = 'A'.repeat(300);
    const clamped = LspWorkspaceSymbolValidator.validateQuery(longQuery);
    expect(clamped.valid).toBe(true);
    expect(clamped.value?.length).toBe(256);

    // Rejects non-string
    expect(LspWorkspaceSymbolValidator.validateQuery(123).valid).toBe(false);
    expect(LspWorkspaceSymbolValidator.validateQuery(null).valid).toBe(false);
  });

  it('sanitizes display strings to prevent XSS and control characters', () => {
    const raw = '<script>alert("xss")</script> & \'test\'\x00';
    const clean = LspWorkspaceSymbolValidator.sanitizeDisplayString(raw, 100);
    expect(clean).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;test&#39;');
    expect(clean.includes('<')).toBe(false);
    expect(clean.includes('>')).toBe(false);
  });

  it('validates raw symbol items and discards malformed candidates', () => {
    // Valid item
    const validRaw = {
      name: 'UserService',
      kind: 5, // Class
      location: {
        uri: 'file:///C:/project/src/UserService.ts',
        range: {
          start: { line: 10, character: 0 },
          end: { line: 50, character: 1 },
        },
      },
      containerName: 'Services',
    };
    const validRes = LspWorkspaceSymbolValidator.validateRawItem(validRaw);
    expect(validRes.valid).toBe(true);
    expect(validRes.value?.name).toBe('UserService');
    expect(validRes.value?.kind).toBe(5);
    expect(validRes.value?.containerName).toBe('Services');

    // Missing name
    expect(LspWorkspaceSymbolValidator.validateRawItem({ ...validRaw, name: '' }).valid).toBe(false);
    expect(LspWorkspaceSymbolValidator.validateRawItem({ ...validRaw, name: '   ' }).valid).toBe(false);

    // Invalid kind
    expect(LspWorkspaceSymbolValidator.validateRawItem({ ...validRaw, kind: 0 }).valid).toBe(false);
    expect(LspWorkspaceSymbolValidator.validateRawItem({ ...validRaw, kind: 27 }).valid).toBe(false);
    expect(LspWorkspaceSymbolValidator.validateRawItem({ ...validRaw, kind: '5' }).valid).toBe(false);

    // Insecure URI schemes
    expect(
      LspWorkspaceSymbolValidator.validateRawItem({
        ...validRaw,
        location: { uri: 'javascript:alert(1)' },
      }).valid
    ).toBe(false);
    expect(
      LspWorkspaceSymbolValidator.validateRawItem({
        ...validRaw,
        location: { uri: 'shell:cmd.exe' },
      }).valid
    ).toBe(false);

    // Non-object item
    expect(LspWorkspaceSymbolValidator.validateRawItem(null).valid).toBe(false);
    expect(LspWorkspaceSymbolValidator.validateRawItem('string').valid).toBe(false);
  });

  it('defensively clamps payload count and filters out invalid symbols', () => {
    const rawList = [
      {
        name: 'Valid1',
        kind: 12, // Function
        location: { uri: 'file:///C:/project/src/fn.ts', range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } } },
      },
      { name: 'Invalid_NoLoc' },
      {
        name: 'Valid2',
        kind: 13, // Variable
        location: { uri: 'file:///C:/project/src/var.ts', range: { start: { line: 5, character: 0 }, end: { line: 5, character: 10 } } },
      },
    ];

    const sanitized = LspWorkspaceSymbolValidator.validateAndSanitizeSymbolList(rawList, 10);
    expect(sanitized.length).toBe(2);
    expect(sanitized[0].name).toBe('Valid1');
    expect(sanitized[1].name).toBe('Valid2');

    // Clamps to max limit
    const clamped = LspWorkspaceSymbolValidator.validateAndSanitizeSymbolList(rawList, 1);
    expect(clamped.length).toBe(1);
    expect(clamped[0].name).toBe('Valid1');
  });
});

describe('LspWorkspaceSymbolMapper', () => {
  it('maps all 26 LSP symbol kinds correctly to canonical SymbolKinds', () => {
    const kindsExpected: [number, string][] = [
      [1, 'file'],
      [2, 'module'],
      [3, 'namespace'],
      [4, 'package'],
      [5, 'class'],
      [6, 'method'],
      [7, 'property'],
      [8, 'field'],
      [9, 'constructor'],
      [10, 'enum'],
      [11, 'interface'],
      [12, 'function'],
      [13, 'variable'],
      [14, 'constant'],
      [15, 'string'],
      [16, 'number'],
      [17, 'boolean'],
      [18, 'array'],
      [19, 'object'],
      [20, 'key'],
      [21, 'null'],
      [22, 'enumMember'],
      [23, 'struct'],
      [24, 'event'],
      [25, 'operator'],
      [26, 'typeParameter'],
    ];

    for (const [lspKind, expected] of kindsExpected) {
      expect(LspWorkspaceSymbolMapper.mapKind(lspKind)).toBe(expected);
    }

    // Safely defaults unknown kinds to 'variable'
    expect(LspWorkspaceSymbolMapper.mapKind(999)).toBe('variable');
  });

  it('maps tags and legacy deprecation to canonical SymbolTag', () => {
    expect(LspWorkspaceSymbolMapper.mapTags([LspSymbolTag.Deprecated], false)).toEqual(['deprecated']);
    expect(LspWorkspaceSymbolMapper.mapTags([], true)).toEqual(['deprecated']);
    expect(LspWorkspaceSymbolMapper.mapTags(undefined, false)).toBeUndefined();
  });

  it('maps sanitized item to canonical Symbol with 1-based coordinates and canonical URI', () => {
    const item: SanitizedWorkspaceSymbolItem = {
      name: 'calculateTotal',
      kind: LspSymbolKind.Function,
      containerName: 'Billing',
      tags: [LspSymbolTag.Deprecated],
      location: {
        uri: 'file:///C:/project/src/billing.ts',
        range: {
          start: { line: 19, character: 4 }, // 0-based line 19, char 4
          end: { line: 25, character: 1 },
        },
      },
    };

    const sym = LspWorkspaceSymbolMapper.mapItemToSymbol(item, 'test-ws');
    expect(sym.name).toBe('calculateTotal');
    expect(sym.kind).toBe('function');
    expect(sym.containerName).toBe('Billing');
    expect(sym.tags).toEqual(['deprecated']);
    expect(sym.workspaceId).toBe('test-ws');
    expect(sym.sourceProviderId).toBe('lsp.workspaceSymbols');

    // Verify 1-based canonical Range
    expect(sym.location.range!.startLine).toBe(20);
    expect(sym.location.range!.startColumn).toBe(5);
    expect(sym.location.range!.endLine).toBe(26);
    expect(sym.location.range!.endColumn).toBe(2);
  });

  it('deduplicates exact matching symbols and ranks by query match relevance', () => {
    const items: SanitizedWorkspaceSymbolItem[] = [
      {
        name: 'UserServiceHelper',
        kind: LspSymbolKind.Class,
        location: { uri: 'file:///C:/project/src/helper.ts', range: { start: { line: 0, character: 0 }, end: { line: 5, character: 0 } } },
      },
      {
        name: 'UserService',
        kind: LspSymbolKind.Class,
        location: { uri: 'file:///C:/project/src/user.ts', range: { start: { line: 10, character: 0 }, end: { line: 20, character: 0 } } },
      },
      // Exact duplicate of UserService
      {
        name: 'UserService',
        kind: LspSymbolKind.Class,
        location: { uri: 'file:///C:/project/src/user.ts', range: { start: { line: 10, character: 0 }, end: { line: 20, character: 0 } } },
      },
      {
        name: 'AppUserService',
        kind: LspSymbolKind.Class,
        location: { uri: 'file:///C:/project/src/app.ts', range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } } },
      },
    ];

    const results = LspWorkspaceSymbolMapper.mapToCanonicalSymbols(items, 'ws-1', 'UserService');
    // Deduplicated: 3 items remain
    expect(results.length).toBe(3);

    // Exact match comes first ('UserService')
    expect(results[0].name).toBe('UserService');
    // Prefix match comes second ('UserServiceHelper')
    expect(results[1].name).toBe('UserServiceHelper');
    // Non-prefix alphabetical comes third ('AppUserService')
    expect(results[2].name).toBe('AppUserService');
  });
});

describe('LspWorkspaceSymbolProvider', () => {
  let transport: MockLspTransport;
  let registry: LspServerRegistry;
  let manager: LspServerManager;
  let provider: LspWorkspaceSymbolProvider;
  let customSymbolHandler: ((query: string) => any) | null = null;

  beforeEach(async () => {
    transport = new MockLspTransport();
    registry = LspServerRegistry.getInstance();
    manager = new (LspServerManager as any)(registry, () => transport);
    customSymbolHandler = null;

    if (!registry.getServer('test-ts-symbols')) {
      registry.registerServer({
        serverDefinitionId: 'test-ts-symbols',
        displayName: 'Test TS Symbols Server',
        languageIds: ['typescript'],
        fileExtensions: ['.ts'],
        command: 'typescript-language-server',
        transportType: 'mock',
      });
    }

    transport.messageHandler = async (msg) => {
      if ('method' in msg && msg.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: (msg as RequestMessage).id,
          result: {
            capabilities: {
              workspaceSymbolProvider: true,
            },
            serverInfo: { name: 'Test Server', version: '1.0.0' },
          },
        };
      }
      if ('method' in msg && msg.method === 'shutdown') {
        return { jsonrpc: '2.0', id: (msg as RequestMessage).id, result: null };
      }
      if ('method' in msg && msg.method === 'workspace/symbol') {
        const query = ((msg as RequestMessage).params as any)?.query || '';
        const res = customSymbolHandler ? customSymbolHandler(query) : [];
        return { jsonrpc: '2.0', id: (msg as RequestMessage).id, result: res };
      }
      return null;
    };

    manager.setTransportFactory(() => transport);
    const session = await manager.getOrCreateSession('typescript', '.ts', 'ws-test', 'C:/test-ws');
    if (session) {
      await session.start();
    }

    vi.spyOn(globalWorkspaceEngine, 'getWorkspaceId').mockReturnValue('ws-test');

    provider = new LspWorkspaceSymbolProvider(manager);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    provider.dispose();
    await manager.dispose();
  });

  it('returns empty array when query is empty and allowEmptyQueries is false', async () => {
    const results = await provider.provideWorkspaceSymbols('   ');
    expect(results).toEqual([]);
  });

  it('queries language server on workspace/symbol and maps canonical symbols', async () => {
    customSymbolHandler = (query) => {
      if (query === 'Auth') {
        return [
          {
            name: 'AuthService',
            kind: 5, // Class
            location: {
              uri: 'file:///C:/test-ws/src/auth.ts',
              range: { start: { line: 5, character: 0 }, end: { line: 25, character: 1 } },
            },
            containerName: 'AuthModule',
          },
          {
            name: 'AuthenticateUser',
            kind: 12, // Function
            location: {
              uri: 'file:///C:/test-ws/src/auth.ts',
              range: { start: { line: 30, character: 2 }, end: { line: 40, character: 3 } },
            },
          },
        ];
      }
      return [];
    };

    const results = await provider.provideWorkspaceSymbols('Auth');
    expect(results.length).toBe(2);

    const authService = results.find((s) => s.name === 'AuthService');
    const authUser = results.find((s) => s.name === 'AuthenticateUser');

    expect(authService).toBeDefined();
    expect(authService?.kind).toBe('class');
    expect(authService?.containerName).toBe('AuthModule');
    expect(authService?.location.range?.startLine).toBe(6);
    expect(authService?.sourceProviderId).toBe('lsp.workspaceSymbols');

    expect(authUser).toBeDefined();
    expect(authUser?.kind).toBe('function');
    expect(authUser?.location.range?.startLine).toBe(31);
  });

  it('respects cancellation token and returns empty list promptly', async () => {
    let cancelRequested = false;
    const token = {
      get isCancellationRequested() {
        return cancelRequested;
      },
      onCancellationRequested: vi.fn(),
    };

    cancelRequested = true;
    const results = await provider.provideWorkspaceSymbols('User', token as any);
    expect(results).toEqual([]);
  });

  it('respects lsp.workspaceSymbols.enabled setting', async () => {
    const settings = SettingsService.getInstance();
    settings.set('lsp.workspaceSymbols.enabled', false);

    const results = await provider.provideWorkspaceSymbols('User');
    expect(results).toEqual([]);

    settings.set('lsp.workspaceSymbols.enabled', true);
  });

  it('integrates seamlessly with canonical SymbolEngine', async () => {
    customSymbolHandler = () => [
      {
        name: 'DatabaseConnection',
        kind: 5,
        location: {
          uri: 'file:///C:/test-ws/db.ts',
          range: { start: { line: 0, character: 0 }, end: { line: 10, character: 0 } },
        },
      },
    ];

    const engine = SymbolEngine.getInstance();
    const unregister = engine.registerProvider(provider);

    try {
      const symbols = await engine.getWorkspaceSymbols('Database');
      const lspSym = symbols.find((s) => s.name === 'DatabaseConnection');
      expect(lspSym).toBeDefined();
      expect(lspSym?.kind).toBe('class');
      expect(lspSym?.sourceProviderId).toBe('lsp.workspaceSymbols');
    } finally {
      unregister();
    }
  });
});
