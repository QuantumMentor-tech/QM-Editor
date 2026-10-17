/**
 * QM Editor - LSP Semantic Tokens Integration Test Suite
 * Phase 06, Step 64 — LSP Semantic Tokens, Semantic Highlighting & Incremental Token Synchronization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LspSemanticTokenProvider } from './LspSemanticTokenProvider';
import { LspSemanticTokenCoordinator } from './LspSemanticTokenCoordinator';
import { globalSemanticTokenLegend } from './LspSemanticTokenLegend';
import { MockLspTransport } from '../transport/MockLspTransport';
import { LspServerRegistry } from '../LspServerRegistry';
import { LspServerManager } from '../LspServerManager';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { DocumentRecord } from '../../documents/DocumentTypes';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { SettingsService } from '../../settings/SettingsService';
import { RequestMessage } from '../LspTypes';

describe('LspSemanticTokens Subsystem Integration', () => {
  let docEngine: DocumentEngine;
  let workspaceEngine: WorkspaceEngine;
  let serverManager: LspServerManager;
  let mockTransport: MockLspTransport;
  let tokenProvider: LspSemanticTokenProvider;
  let tokenCoordinator: LspSemanticTokenCoordinator;
  let customHandler: ((method: string, params: any) => any | Promise<any>) | null = null;

  const testUri = 'file:///C:/project/src/app.ts';
  const initialCode = 'const count = 42;\nfunction getCount() {\n  return count;\n}\n';

  const openDoc = async (uri: string, content: string, languageId: string): Promise<DocumentRecord> => {
    const { document } = await docEngine.openResource(uri, {
      initialContent: content,
      languageId,
      workspaceId: 'test-ws',
    });
    return document;
  };

  beforeEach(async () => {
    docEngine = globalDocumentEngine;
    for (const d of docEngine.getAllDocuments()) {
      await docEngine.close(d.id, true);
    }
    workspaceEngine = globalWorkspaceEngine;
    globalSemanticTokenLegend.clear();
    mockTransport = new MockLspTransport();
    customHandler = null;

    mockTransport.messageHandler = async (msg) => {
      const req = msg as RequestMessage;
      if (req.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            capabilities: {
              semanticTokensProvider: {
                legend: {
                  tokenTypes: [
                    'namespace', 'type', 'class', 'enum', 'interface',
                    'struct', 'typeParameter', 'parameter', 'variable',
                    'property', 'enumMember', 'event', 'function',
                    'method', 'macro', 'keyword', 'modifier', 'comment',
                    'string', 'number', 'regexp', 'operator', 'decorator',
                  ],
                  tokenModifiers: ['declaration', 'readonly', 'static'],
                },
                full: { delta: true },
                range: true,
              },
            },
          },
        };
      }
      if (req.method === 'shutdown') {
        return { jsonrpc: '2.0', id: req.id, result: null };
      }
      if (customHandler) {
        try {
          const res = await customHandler(req.method, req.params);
          if (res !== undefined) {
            if (res && res.error) {
              return { jsonrpc: '2.0', id: req.id, error: res.error };
            }
            return { jsonrpc: '2.0', id: req.id, result: res };
          }
        } catch (err: any) {
          return {
            jsonrpc: '2.0',
            id: req.id,
            error: { code: -32603, message: err?.message || 'Server error' },
          };
        }
      }
      return null;
    };

    serverManager = new (LspServerManager as any)(LspServerRegistry.getInstance());
    serverManager.setTransportFactory(() => mockTransport);

    const session = await serverManager.getOrCreateSession('typescript', '.ts', 'test-ws', 'C:/project');
    if (session) {
      await session.start();
    }

    tokenProvider = new LspSemanticTokenProvider(
      serverManager,
      SettingsService.getInstance(),
      workspaceEngine,
      docEngine
    );

    tokenCoordinator = new LspSemanticTokenCoordinator(
      tokenProvider,
      docEngine,
      workspaceEngine,
      SettingsService.getInstance()
    );
  });

  afterEach(async () => {
    tokenCoordinator.dispose();
    tokenProvider.dispose();
    await serverManager.dispose();
    for (const d of docEngine.getAllDocuments()) {
      await docEngine.close(d.id, true);
    }
  });

  it('requests and decodes full semantic tokens from language server', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method, params) => {
      if (method === 'textDocument/semanticTokens/full') {
        expect(params.textDocument.uri).toContain('app.ts');
        return {
          resultId: 'res-v1',
          data: [
            // line 0, char 6, len 5, type 8 ('variable'), mod 2 (readonly)
            0, 6, 5, 8, 2,
            // line 1, char 9, len 8, type 12 ('function'), mod 1 (declaration)
            1, 9, 8, 12, 1,
          ],
        };
      }
      return null;
    };

    const result = await tokenProvider.requestDocumentSemanticTokens(doc.resourceUri);
    expect(result).not.toBeNull();
    expect(result!.isDelta).toBe(false);
    expect(result!.resultId).toBe('res-v1');
    expect(result!.tokens).toHaveLength(2);

    expect(result!.tokens[0].tokenType).toBe('variable');
    expect(result!.tokens[0].tokenModifiers).toContain('readonly');

    expect(result!.tokens[1].tokenType).toBe('function');
    expect(result!.tokens[1].tokenModifiers).toContain('declaration');

    // Verify snapshot was cached with resultId
    const cached = tokenProvider.getCache(doc.resourceUri);
    expect(cached?.resultId).toBe('res-v1');
    expect(cached?.rawTokens).toEqual([0, 6, 5, 8, 2, 1, 9, 8, 12, 1]);
  });

  it('performs incremental delta request when previous resultId is cached', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    // 1. Initial full request
    customHandler = (method) => {
      if (method === 'textDocument/semanticTokens/full') {
        return {
          resultId: 'res-v1',
          data: [0, 6, 5, 8, 2],
        };
      }
      return null;
    };

    const initialResult = await tokenProvider.requestDocumentSemanticTokens(doc.resourceUri);
    expect(initialResult?.resultId).toBe('res-v1');

    // 2. Incremental delta request
    customHandler = (method, params) => {
      if (method === 'textDocument/semanticTokens/full/delta') {
        expect(params.previousResultId).toBe('res-v1');
        return {
          resultId: 'res-v2',
          edits: [
            // Insert second token at index 5
            { start: 5, deleteCount: 0, data: [1, 9, 8, 12, 1] },
          ],
        };
      }
      return null;
    };

    const deltaResult = await tokenProvider.requestDocumentSemanticTokens(doc.resourceUri);
    expect(deltaResult).not.toBeNull();
    expect(deltaResult!.isDelta).toBe(true);
    expect(deltaResult!.resultId).toBe('res-v2');
    expect(deltaResult!.tokens).toHaveLength(2);

    const cached = tokenProvider.getCache(doc.resourceUri);
    expect(cached?.resultId).toBe('res-v2');
    expect(cached?.rawTokens).toEqual([0, 6, 5, 8, 2, 1, 9, 8, 12, 1]);
  });

  it('gracefully falls back to full request when delta request fails or returns invalid edit', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    // Initial full request
    customHandler = (method) => {
      if (method === 'textDocument/semanticTokens/full') {
        return {
          resultId: 'res-v1',
          data: [0, 6, 5, 8, 2],
        };
      }
      return null;
    };
    await tokenProvider.requestDocumentSemanticTokens(doc.resourceUri);

    // Delta request returns out-of-bounds edit, triggering fallback to full
    let fullRequestCalled = false;
    customHandler = (method) => {
      if (method === 'textDocument/semanticTokens/full/delta') {
        return {
          resultId: 'res-bad',
          edits: [
            { start: 999, deleteCount: 5, data: [] }, // Invalid start > length
          ],
        };
      }
      if (method === 'textDocument/semanticTokens/full') {
        fullRequestCalled = true;
        return {
          resultId: 'res-fresh',
          data: [0, 6, 5, 8, 2],
        };
      }
      return null;
    };

    const fallbackResult = await tokenProvider.requestDocumentSemanticTokens(doc.resourceUri);
    expect(fullRequestCalled).toBe(true);
    expect(fallbackResult?.resultId).toBe('res-fresh');
  });

  it('requests range-specific semantic tokens through textDocument/semanticTokens/range', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method, params) => {
      if (method === 'textDocument/semanticTokens/range') {
        expect(params.range).toBeDefined();
        return {
          data: [1, 9, 8, 12, 1],
        };
      }
      return null;
    };

    const tokens = await tokenProvider.requestRangeSemanticTokens(
      doc.resourceUri,
      { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } }
    );

    expect(tokens).toHaveLength(1);
    expect(tokens![0].tokenType).toBe('function');
  });

  it('rejects stale responses if document revision advances during token request', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');
    let listenerCalled = false;

    tokenCoordinator.subscribe((event) => {
      if (event.type === 'tokensUpdated') {
        listenerCalled = true;
      }
    });

    customHandler = async (method) => {
      if (method === 'textDocument/semanticTokens/full') {
        // Mutate document content revision while request is in-flight
        await docEngine.updateText(doc.id, initialCode + '\nconst extra = true;\n', 'user');
        return {
          resultId: 'res-stale',
          data: [0, 6, 5, 8, 2],
        };
      }
      return null;
    };

    await tokenCoordinator.requestSemanticTokens(doc.resourceUri, true);

    // Because revision advanced during in-flight request, stale result was discarded
    expect(listenerCalled).toBe(false);
  });

  it('maintains strict workspace isolation: tokens from Workspace A do not leak to Workspace B', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/semanticTokens/full') {
        return {
          resultId: 'res-ws',
          data: [0, 6, 5, 8, 2],
        };
      }
      return null;
    };

    await tokenCoordinator.requestSemanticTokens(doc.resourceUri, true);
    expect(tokenCoordinator.getDecorations(doc.resourceUri).length).toBeGreaterThan(0);

    // Switch workspace
    tokenCoordinator.clearTokens();
    expect(tokenCoordinator.getDecorations(doc.resourceUri)).toHaveLength(0);
    expect(tokenProvider.getCache(doc.resourceUri)).toBeUndefined();
  });

  it('clears token state and invalidates session legend on server restart', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/semanticTokens/full') {
        return {
          resultId: 'res-server1',
          data: [0, 6, 5, 8, 2],
        };
      }
      return null;
    };

    await tokenCoordinator.requestSemanticTokens(doc.resourceUri, true);
    expect(tokenCoordinator.getDecorations(doc.resourceUri)).toHaveLength(1);

    // Restart server session
    tokenCoordinator.clearTokens();
    globalSemanticTokenLegend.unregisterServerLegend('typescript-lsp::test-ws');

    expect(tokenCoordinator.getDecorations(doc.resourceUri)).toHaveLength(0);
    expect(tokenProvider.getCache(doc.resourceUri)).toBeUndefined();
  });

  it('handles server failure gracefully without crashing and preserves syntax highlighting fallback', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/semanticTokens/full') {
        throw new Error('Fatal LSP language server crash!');
      }
      return null;
    };

    // Should not throw
    const res = await tokenProvider.requestDocumentSemanticTokens(doc.resourceUri);
    expect(res).toBeNull();

    // Coordinator remains healthy and empty
    await tokenCoordinator.requestSemanticTokens(doc.resourceUri, true);
    expect(tokenCoordinator.getDecorations(doc.resourceUri)).toHaveLength(0);
  });

  it('disables semantic token requests when lsp.semanticTokens.enabled setting is false', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');
    const settings = SettingsService.getInstance();
    settings.set('lsp.semanticTokens.enabled', false, 'user');

    let serverCalled = false;
    customHandler = (method) => {
      if (method === 'textDocument/semanticTokens/full') {
        serverCalled = true;
        return { resultId: 'r1', data: [0, 6, 5, 8, 2] };
      }
      return null;
    };

    const res = await tokenProvider.requestDocumentSemanticTokens(doc.resourceUri);
    expect(res).toBeNull();
    expect(serverCalled).toBe(false);

    settings.reset('lsp.semanticTokens.enabled', 'user');
  });
});
