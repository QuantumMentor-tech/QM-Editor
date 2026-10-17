/**
 * QM Editor - LSP Code Lens Integration Test Suite
 * Phase 06, Step 66 — LSP Code Lens, Inline Actions & Safe Command Integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LspCodeLensProvider } from './LspCodeLensProvider';
import { LspCodeLensCoordinator } from './LspCodeLensCoordinator';
import { MockLspTransport } from '../transport/MockLspTransport';
import { LspServerRegistry } from '../LspServerRegistry';
import { LspServerManager } from '../LspServerManager';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { DocumentRecord } from '../../documents/DocumentTypes';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { SettingsService } from '../../settings/SettingsService';
import { RequestMessage, LspCodeLens } from '../LspTypes';
import { CommandRegistry } from '../../commands/CommandRegistry';
import { FeedbackService } from '../../feedback/FeedbackService';

describe('LspCodeLens Subsystem Integration', () => {
  let docEngine: DocumentEngine;
  let workspaceEngine: WorkspaceEngine;
  let serverManager: LspServerManager;
  let mockTransport: MockLspTransport;
  let lensProvider: LspCodeLensProvider;
  let lensCoordinator: LspCodeLensCoordinator;
  let commandRegistry: CommandRegistry;
  let feedbackService: FeedbackService;
  let customHandler: ((method: string, params: any) => any | Promise<any>) | null = null;

  const testUri = 'file:///C:/project/src/service.ts';
  const initialCode = 'class UserService {\n  findUser(id: string) {\n    return { id };\n  }\n}\n';

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
              codeLensProvider: {
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

    commandRegistry = new CommandRegistry();
    feedbackService = new FeedbackService();

    lensProvider = new LspCodeLensProvider(
      serverManager,
      SettingsService.getInstance(),
      workspaceEngine,
      docEngine,
      commandRegistry
    );

    lensCoordinator = new LspCodeLensCoordinator(
      lensProvider,
      docEngine,
      workspaceEngine,
      SettingsService.getInstance(),
      commandRegistry,
      undefined,
      feedbackService
    );
  });

  afterEach(async () => {
    lensCoordinator.dispose();
    lensProvider.dispose();
    await serverManager.dispose();
    for (const d of docEngine.getAllDocuments()) {
      await docEngine.close(d.id, true);
    }
  });

  it('requests and maps code lenses from language server', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    const sampleLenses: LspCodeLens[] = [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 18 },
        },
        command: {
          title: '3 references',
          command: 'editor.showReferences',
          arguments: ['file:///C:/project/src/service.ts', { line: 0, character: 0 }],
        },
      },
      {
        range: {
          start: { line: 1, character: 2 },
          end: { line: 1, character: 10 },
        },
        command: {
          title: 'Run Test',
          command: 'tasks.runTest',
          arguments: ['UserService.findUser'],
        },
      },
    ];

    customHandler = (method, params) => {
      if (method === 'textDocument/codeLens') {
        expect(params.textDocument.uri).toContain('service.ts');
        return sampleLenses;
      }
      return null;
    };

    const result = await lensProvider.requestCodeLenses(testUri);
    expect(result).not.toBeNull();
    expect(result?.lines).toHaveLength(2);

    // Line 0
    const line0 = result!.lines[0];
    expect(line0.line).toBe(0);
    expect(line0.lenses).toHaveLength(1);
    expect(line0.lenses[0].command?.title).toBe('3 references');
    expect(line0.lenses[0].command?.command).toBe('editor.showReferences');

    // Line 1
    const line1 = result!.lines[1];
    expect(line1.line).toBe(1);
    expect(line1.lenses).toHaveLength(1);
    expect(line1.lenses[0].command?.title).toBe('Run Test');
    expect(line1.lenses[0].command?.command).toBe('tasks.runTest');
  });

  it('resolves unresolved code lenses lazily via codeLens/resolve', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    const unresolvedLenses: LspCodeLens[] = [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 18 },
        },
        data: { symbolId: 'UserService', kind: 'references' },
      },
    ];

    customHandler = (method, params) => {
      if (method === 'textDocument/codeLens') {
        return unresolvedLenses;
      }
      if (method === 'codeLens/resolve') {
        expect(params.data).toEqual({ symbolId: 'UserService', kind: 'references' });
        return {
          ...params,
          command: {
            title: '5 references',
            command: 'editor.showReferences',
            arguments: [testUri, { line: 0, character: 0 }],
          },
        };
      }
      return null;
    };

    const result = await lensProvider.requestCodeLenses(testUri);
    expect(result).not.toBeNull();
    const lens = result!.lines[0].lenses[0];
    expect(lens.isResolved).toBe(false);
    expect(lens.command).toBeUndefined();

    // Now resolve it
    const resolved = await lensProvider.resolveCodeLens(testUri, lens);
    expect(resolved.isResolved).toBe(true);
    expect(resolved.command?.title).toBe('5 references');
    expect(resolved.command?.command).toBe('editor.showReferences');
  });

  it('safely executes registered trusted commands on click', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    let executed = false;
    let receivedArgs: any = null;

    commandRegistry.register({
      id: 'tasks.runTest',
      label: 'Run Test',
      category: 'tasks',
      execute: async (ctx) => {
        executed = true;
        receivedArgs = ctx.contextualTarget;
      },
    });

    customHandler = (method) => {
      if (method === 'textDocument/codeLens') {
        return [
          {
            range: {
              start: { line: 1, character: 2 },
              end: { line: 1, character: 10 },
            },
            command: {
              title: 'Run Test',
              command: 'tasks.runTest',
              arguments: ['UserService.findUser'],
            },
          },
        ];
      }
      return null;
    };

    lensCoordinator.requestCodeLenses(testUri, true);
    await new Promise((r) => setTimeout(r, 60));

    const lines = lensCoordinator.getLines(testUri);
    expect(lines).toHaveLength(1);
    const lensId = lines[0].lenses[0].id;

    // Simulate clicking the lens
    const success = await lensCoordinator.executeLens(lensId);
    expect(success).toBe(true);
    expect(executed).toBe(true);
    expect(receivedArgs).toEqual(['UserService.findUser']);
  });

  it('blocks untrusted and hostile commands without crashing', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    const feedbackSpy = vi.spyOn(feedbackService, 'show');

    customHandler = (method) => {
      if (method === 'textDocument/codeLens') {
        return [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 10 },
            },
            command: {
              title: 'Exploit Terminal',
              command: 'terminal.runCommand',
              arguments: ['rm -rf /'],
            },
          },
        ];
      }
      return null;
    };

    lensCoordinator.requestCodeLenses(testUri, true);
    await new Promise((r) => setTimeout(r, 60));

    const lines = lensCoordinator.getLines(testUri);
    expect(lines).toHaveLength(1);
    const lensId = lines[0].lenses[0].id;

    const success = await lensCoordinator.executeLens(lensId);
    expect(success).toBe(false);
    expect(feedbackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warning',
        message: expect.stringContaining('Blocked untrusted Code Lens command'),
      })
    );
  });

  it('rejects stale responses when document revision changes during request', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = async (method) => {
      if (method === 'textDocument/codeLens') {
        await new Promise((r) => setTimeout(r, 60));
        return [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 5 },
            },
            command: {
              title: '1 reference',
              command: 'editor.showReferences',
            },
          },
        ];
      }
      return null;
    };

    const requestPromise = lensProvider.requestCodeLenses(testUri);

    // Rapid edit occurs while request is in-flight
    docEngine.updateText(doc.id, 'class ModifiedService {}\n', 'user');

    const result = await requestPromise;
    expect(result).toBeNull();
  });

  it('cleans up lenses when document is closed', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/codeLens') {
        return [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 5 },
            },
            command: {
              title: '1 reference',
              command: 'editor.showReferences',
            },
          },
        ];
      }
      return null;
    };

    lensCoordinator.requestCodeLenses(testUri, true);
    await new Promise((r) => setTimeout(r, 60));
    expect(lensCoordinator.getLines(testUri).length).toBeGreaterThan(0);

    // Close document
    await docEngine.close(doc.id, true);

    expect(lensCoordinator.getLines(testUri)).toHaveLength(0);
    expect(lensProvider.getCache(testUri)).toBeUndefined();
  });

  it('respects lsp.codeLens.enabled setting when disabled', async () => {
    const settings = SettingsService.getInstance();
    settings.set('lsp.codeLens.enabled', false);

    await openDoc(testUri, initialCode, 'typescript');

    let requestCount = 0;
    customHandler = (method) => {
      if (method === 'textDocument/codeLens') {
        requestCount++;
        return [];
      }
      return null;
    };

    const result = await lensProvider.requestCodeLenses(testUri);
    expect(result).toBeNull();
    expect(requestCount).toBe(0);

    // Reset setting
    settings.reset('lsp.codeLens.enabled');
  });

  it('handles empty server response cleanly without errors', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/codeLens') {
        return [];
      }
      return null;
    };

    const result = await lensProvider.requestCodeLenses(testUri);
    expect(result).not.toBeNull();
    expect(result?.lines).toEqual([]);
  });

  it('omits malformed lenses while keeping valid lenses on the same line', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/codeLens') {
        return [
          // Malformed range (line out of bounds)
          {
            range: {
              start: { line: 9999, character: 0 },
              end: { line: 9999, character: 5 },
            },
            command: { title: 'Ghost', command: 'editor.showReferences' },
          },
          // Valid lens
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 10 },
            },
            command: { title: 'Valid 1', command: 'editor.showReferences' },
          },
        ];
      }
      return null;
    };

    const result = await lensProvider.requestCodeLenses(testUri);
    expect(result).not.toBeNull();
    expect(result?.lines).toHaveLength(1);
    expect(result?.lines[0].lenses).toHaveLength(1);
    expect(result?.lines[0].lenses[0].command?.title).toBe('Valid 1');
  });
});
