/**
 * QM Editor - LSP Inlay Hints Integration Test Suite
 * Phase 06, Step 65 — LSP Inlay Hints, Parameter Names, Type Information & Inline Semantic Annotations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LspInlayHintProvider } from './LspInlayHintProvider';
import { LspInlayHintCoordinator } from './LspInlayHintCoordinator';
import { MockLspTransport } from '../transport/MockLspTransport';
import { LspServerRegistry } from '../LspServerRegistry';
import { LspServerManager } from '../LspServerManager';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { DocumentRecord } from '../../documents/DocumentTypes';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { SettingsService } from '../../settings/SettingsService';
import { RequestMessage, LspInlayHint, LspInlayHintKind } from '../LspTypes';

describe('LspInlayHints Subsystem Integration', () => {
  let docEngine: DocumentEngine;
  let workspaceEngine: WorkspaceEngine;
  let serverManager: LspServerManager;
  let mockTransport: MockLspTransport;
  let hintProvider: LspInlayHintProvider;
  let hintCoordinator: LspInlayHintCoordinator;
  let customHandler: ((method: string, params: any) => any | Promise<any>) | null = null;

  const testUri = 'file:///C:/project/src/app.ts';
  const initialCode = 'const count = 42;\nfunction getCount(multiplier) {\n  return count * multiplier;\n}\n';

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
              inlayHintProvider: {
                resolveProvider: true,
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

    hintProvider = new LspInlayHintProvider(
      serverManager,
      SettingsService.getInstance(),
      workspaceEngine,
      docEngine
    );

    hintCoordinator = new LspInlayHintCoordinator(
      hintProvider,
      docEngine,
      workspaceEngine,
      SettingsService.getInstance()
    );
  });

  afterEach(async () => {
    hintCoordinator.dispose();
    hintProvider.dispose();
    await serverManager.dispose();
    for (const d of docEngine.getAllDocuments()) {
      await docEngine.close(d.id, true);
    }
  });

  it('requests and maps parameter and type inlay hints from language server', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    const sampleHints: LspInlayHint[] = [
      {
        position: { line: 0, character: 11 },
        label: ': number',
        kind: LspInlayHintKind.Type,
        paddingLeft: true,
      },
      {
        position: { line: 1, character: 19 },
        label: 'factor:',
        kind: LspInlayHintKind.Parameter,
        paddingRight: true,
      },
    ];

    customHandler = (method, params) => {
      if (method === 'textDocument/inlayHint') {
        expect(params.textDocument.uri).toContain('app.ts');
        return sampleHints;
      }
      return null;
    };

    const result = await hintProvider.requestInlayHints(testUri);
    expect(result).not.toBeNull();
    expect(result?.hints).toHaveLength(2);

    const typeHint = result!.hints[0];
    expect(typeHint.kind).toBe('type');
    expect(typeHint.from).toBe(11); // line 0 offset 0 + char 11
    expect(typeHint.label).toBe(' : number');
    expect(typeHint.className).toContain('cm-inlay-hint-type');

    const paramHint = result!.hints[1];
    expect(paramHint.kind).toBe('parameter');
    expect(paramHint.from).toBe(18 + 19); // line 1 starts at 18
    expect(paramHint.label).toBe('factor: ');
    expect(paramHint.className).toContain('cm-inlay-hint-parameter');
  });

  it('protects against stale responses when document revision advances mid-flight', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = async (method) => {
      if (method === 'textDocument/inlayHint') {
        // Simulate in-flight delay where user types during the request
        await new Promise((r) => setTimeout(r, 60));
        return [
          {
            position: { line: 0, character: 11 },
            label: ': number',
            kind: LspInlayHintKind.Type,
          },
        ];
      }
      return null;
    };

    const requestPromise = hintProvider.requestInlayHints(testUri);

    // Rapid edit occurs while request is in flight
    docEngine.updateText(doc.id, 'const count = "forty-two";\n', 'user');

    const result = await requestPromise;
    // Must be rejected as stale because document revision advanced
    expect(result).toBeNull();
  });

  it('notifies subscribers via LspInlayHintCoordinator on hintsUpdated and hintsCleared', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/inlayHint') {
        return [
          {
            position: { line: 0, character: 11 },
            label: ': number',
            kind: LspInlayHintKind.Type,
          },
        ];
      }
      return null;
    };

    const receivedEvents: string[] = [];
    hintCoordinator.subscribe((e) => {
      receivedEvents.push(e.type);
    });

    hintCoordinator.requestInlayHints(testUri, true);

    // Wait briefly for coordinator async execution
    await new Promise((r) => setTimeout(r, 50));

    expect(receivedEvents).toContain('hintsUpdated');
    expect(hintCoordinator.getDecorations(testUri)).toHaveLength(1);

    // Clear hints
    hintCoordinator.clearHints(testUri);
    expect(receivedEvents).toContain('hintsCleared');
    expect(hintCoordinator.getDecorations(testUri)).toHaveLength(0);
  });

  it('respects lsp.inlayHints.enabled setting when disabled', async () => {
    const settings = SettingsService.getInstance();
    settings.set('lsp.inlayHints.enabled', false);

    await openDoc(testUri, initialCode, 'typescript');

    let requestCount = 0;
    customHandler = (method) => {
      if (method === 'textDocument/inlayHint') {
        requestCount++;
        return [];
      }
      return null;
    };

    const result = await hintProvider.requestInlayHints(testUri);
    expect(result).toBeNull();
    expect(requestCount).toBe(0);

    // Reset setting
    settings.reset('lsp.inlayHints.enabled');
  });

  it('cleans up hints and cache when document is closed', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/inlayHint') {
        return [
          {
            position: { line: 0, character: 11 },
            label: ': number',
            kind: LspInlayHintKind.Type,
          },
        ];
      }
      return null;
    };

    hintCoordinator.requestInlayHints(testUri, true);
    await new Promise((r) => setTimeout(r, 50));
    expect(hintCoordinator.getDecorations(testUri).length).toBeGreaterThan(0);

    // Close document
    await docEngine.close(doc.id, true);

    expect(hintCoordinator.getDecorations(testUri)).toHaveLength(0);
    expect(hintProvider.getCache(testUri)).toBeUndefined();
  });
});
