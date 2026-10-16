/**
 * QM Editor LSP Subsystem Comprehensive Integration & Real Server Smoke Tests
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LspCoordinator } from './LspCoordinator';
import { LspServerManager } from './LspServerManager';
import { LspServerRegistry } from './LspServerRegistry';
import { LspDocumentSync } from './LspDocumentSync';
import { LspDiagnosticsBridge } from './LspDiagnosticsBridge';
import { LspProviderAdapter } from './LspProviderAdapter';
import { MockLspTransport } from './transport/MockLspTransport';
import { StdioProcessTransport } from './transport/StdioProcessTransport';
import { RequestMessage, PublishDiagnosticsParams } from './LspTypes';
import { globalDocumentEngine } from '../documents/DocumentEngine';
import { globalDiagnosticService } from '../diagnostics/DiagnosticService';

describe('LSP Subsystem Integration & Lifecycle', () => {
  let mockTransport: MockLspTransport;
  let serverManager: LspServerManager;
  let documentSync: LspDocumentSync;
  let diagnosticsBridge: LspDiagnosticsBridge;
  let providerAdapter: LspProviderAdapter;
  let coordinator: LspCoordinator;

  beforeEach(() => {
    mockTransport = new MockLspTransport();
    mockTransport.messageHandler = (msg) => {
      if ('method' in msg && msg.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: (msg as RequestMessage).id,
          result: {
            capabilities: {
              textDocumentSync: 1,
              completionProvider: {
                triggerCharacters: ['.'],
                resolveProvider: false,
              },
              hoverProvider: true,
              signatureHelpProvider: {
                triggerCharacters: ['('],
              },
            },
            serverInfo: {
              name: 'Mock Test Language Server',
              version: '1.0.0',
            },
          },
        };
      }

      if ('method' in msg && msg.method === 'textDocument/completion') {
        return {
          jsonrpc: '2.0',
          id: (msg as RequestMessage).id,
          result: [
            { label: 'lspFunction', kind: 3, detail: '() => void' },
            { label: 'lspVariable', kind: 6, detail: 'string' },
          ],
        };
      }

      if ('method' in msg && msg.method === 'textDocument/hover') {
        return {
          jsonrpc: '2.0',
          id: (msg as RequestMessage).id,
          result: {
            contents: { kind: 'markdown', value: '### LSP Type Definition\n`const x: number`' },
          },
        };
      }

      return null;
    };

    const registry = LspServerRegistry.getInstance();
    serverManager = new (LspServerManager as any)(registry, () => mockTransport);
    documentSync = new (LspDocumentSync as any)(serverManager, globalDocumentEngine);
    diagnosticsBridge = new (LspDiagnosticsBridge as any)(globalDiagnosticService);
    providerAdapter = new LspProviderAdapter(serverManager, diagnosticsBridge);
    coordinator = new (LspCoordinator as any)(
      serverManager,
      registry,
      documentSync,
      diagnosticsBridge,
      providerAdapter
    );
  });

  afterEach(async () => {
    for (const doc of globalDocumentEngine.getAllDocuments()) {
      try {
        await globalDocumentEngine.close(doc.id, true);
      } catch {
        // Ignore
      }
    }
    await coordinator.dispose();
  });

  it('completes the full initialize & initialized handshake upon session activation', async () => {
    await coordinator.initialize();

    const session = await serverManager.getOrCreateSession('typescript', 'ts', 'ws-test-1');
    expect(session).toBeDefined();
    expect(session?.getState()).toBe('running');
    expect(session?.getHealth()).toBe('ready');

    const sent = mockTransport.getSentMessages();
    const initReq = sent.find((m) => 'method' in m && m.method === 'initialize');
    const initNotif = sent.find((m) => 'method' in m && m.method === 'initialized');

    expect(initReq).toBeDefined();
    expect(initNotif).toBeDefined();
    expect(session?.getCapabilities()?.hoverProvider).toBe(true);
  });

  it('shares one server session across multiple open documents in the same workspace', async () => {
    await coordinator.initialize();

    const { document: doc1 } = await globalDocumentEngine.openResource('file:///C:/test/doc1.ts', {
      initialContent: 'const a = 1;',
      languageId: 'typescript',
      workspaceId: 'ws-shared',
    });

    const { document: doc2 } = await globalDocumentEngine.openResource('file:///C:/test/doc2.ts', {
      initialContent: 'const b = 2;',
      languageId: 'typescript',
      workspaceId: 'ws-shared',
    });

    const activeSession = serverManager.getActiveSession('typescript', 'ws-shared');
    expect(activeSession).toBeDefined();
    expect(activeSession?.getTrackedDocumentCount()).toBe(2);

    // Closing doc1 leaves doc2 still active and server running
    await globalDocumentEngine.close(doc1.id, true);
    expect(activeSession?.getTrackedDocumentCount()).toBe(1);
    expect(activeSession?.getState()).toBe('running');

    await globalDocumentEngine.close(doc2.id, true);
    expect(activeSession?.getTrackedDocumentCount()).toBe(0);
  });

  it('routes published diagnostics into DiagnosticService with 1-based coordinates', async () => {
    await coordinator.initialize();

    const session = await serverManager.getOrCreateSession('typescript', 'ts', 'ws-diag');
    expect(session).toBeDefined();

    const sampleDiagnostics: PublishDiagnosticsParams = {
      uri: 'file:///C:/test/diag-file.ts',
      version: 1,
      diagnostics: [
        {
          range: {
            start: { line: 0, character: 4 }, // 0-based
            end: { line: 0, character: 10 },
          },
          severity: 1, // Error
          message: 'Cannot find name "myVar".',
          source: 'typescript',
          code: 2304,
        },
      ],
    };

    // Simulate incoming diagnostics notification from server
    mockTransport.simulateIncomingMessage({
      jsonrpc: '2.0',
      method: 'textDocument/publishDiagnostics',
      params: sampleDiagnostics,
    });

    // Query DiagnosticService
    const diags = globalDiagnosticService.getDiagnostics('C:\\test\\diag-file.ts');

    expect(diags).toHaveLength(1);
    expect(diags[0].message).toBe('Cannot find name "myVar".');
    expect(diags[0].severity).toBe('error');
    // Coordinates must be converted to 1-based lines and columns
    expect(diags[0].range?.startLine).toBe(1);
    expect(diags[0].range?.startColumn).toBe(5);
    expect(diags[0].range?.endLine).toBe(1);
    expect(diags[0].range?.endColumn).toBe(11);
  });

  it('delegates completions through LspProviderAdapter to LSP server', async () => {
    await coordinator.initialize();

    const session = await serverManager.getOrCreateSession('typescript', 'ts', 'ws-comp');
    expect(session).toBeDefined();

    const items = await providerAdapter.provideCompletions({
      requestId: 'comp-1',
      documentId: 'doc-comp',
      uri: 'file:///C:/test/comp.ts',
      languageId: 'typescript',
      revision: 1,
      position: { line: 1, column: 5 },
      offset: 4,
      triggerKind: 'invoked',
      workspaceId: 'ws-comp',
    });

    expect(items).toHaveLength(2);
    expect(items[0].label).toBe('lspFunction');
    expect(items[0].kind).toBe('function');
    expect(items[1].label).toBe('lspVariable');
  });

  it('delegates hover requests through LspProviderAdapter to LSP server', async () => {
    await coordinator.initialize();

    const session = await serverManager.getOrCreateSession('typescript', 'ts', 'ws-hover');
    expect(session).toBeDefined();

    const hoverResult = await providerAdapter.provideHover({
      requestId: 'hover-1',
      documentId: 'doc-hover',
      uri: 'file:///C:/test/hover.ts',
      languageId: 'typescript',
      revision: 1,
      position: { line: 1, column: 5 },
      offset: 4,
      workspaceId: 'ws-hover',
    });

    expect(hoverResult).toBeDefined();
    expect(hoverResult?.contents[0]).toContain('LSP Type Definition');
  });

  it('closes and disposes sessions when workspace is closed', async () => {
    await coordinator.initialize();

    const session = await serverManager.getOrCreateSession('typescript', 'ts', 'ws-to-close');
    expect(session).toBeDefined();
    expect(session?.getState()).toBe('running');

    await serverManager.closeWorkspaceSessions('ws-to-close');

    expect(session?.getState()).toBe('disposed');
    expect(serverManager.getActiveSession('typescript', 'ws-to-close')).toBeUndefined();
  });
});

describe('Real Server Process Smoke Test (Node stdio subprocess)', () => {
  it('spawns real process over stdio, performs LSP handshake, synchronizes document, and shuts down cleanly', async () => {
    // Check if running in Node environment
    if (typeof process === 'undefined' || !process.versions?.node) {
      console.log('Skipping real process test in non-Node environment');
      return;
    }

    // Create an inline Node.js script that acts as a real LSP stdio server
    const serverScript = `
      const readline = require('readline');
      let buffer = '';

      process.stdin.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        while (buffer.includes('\\r\\n\\r\\n')) {
          const headerEnd = buffer.indexOf('\\r\\n\\r\\n');
          const header = buffer.slice(0, headerEnd);
          const match = header.match(/content-length:\\s*(\\d+)/i);
          if (!match) {
            buffer = buffer.slice(headerEnd + 4);
            continue;
          }
          const len = parseInt(match[1], 10);
          const bodyStart = headerEnd + 4;
          if (Buffer.byteLength(buffer.slice(bodyStart)) < len) break;

          const body = buffer.slice(bodyStart, bodyStart + len);
          buffer = buffer.slice(bodyStart + len);

          try {
            const msg = JSON.parse(body);
            if (msg.method === 'initialize') {
              const res = {
                jsonrpc: '2.0',
                id: msg.id,
                result: {
                  capabilities: {
                    hoverProvider: true,
                    textDocumentSync: 1
                  },
                  serverInfo: {
                    name: 'Real Process Node Smoke LSP',
                    version: '0.1.0'
                  }
                }
              };
              const json = JSON.stringify(res);
              process.stdout.write('Content-Length: ' + Buffer.byteLength(json) + '\\r\\n\\r\\n' + json);
            } else if (msg.method === 'shutdown') {
              const res = { jsonrpc: '2.0', id: msg.id, result: null };
              const json = JSON.stringify(res);
              process.stdout.write('Content-Length: ' + Buffer.byteLength(json) + '\\r\\n\\r\\n' + json);
            } else if (msg.method === 'exit') {
              process.exit(0);
            }
          } catch (e) {
            process.stderr.write('Server parse error: ' + e.message + '\\n');
          }
        }
      });
    `;

    const b64 = Buffer.from(serverScript).toString('base64');
    const transport = new StdioProcessTransport({
      command: process.execPath,
      args: ['-e', `eval(Buffer.from("${b64}","base64").toString("utf-8"))`],
    });

    const session = new (await import('./LspServerSession')).LspServerSession({
      serverDefinition: {
        serverDefinitionId: 'real-smoke-lsp',
        displayName: 'Real Node Smoke LSP Server',
        languageIds: ['smoke'],
        fileExtensions: ['smoke'],
        command: process.execPath,
        transportType: 'stdio',
      },
      workspaceId: 'ws-smoke',
      transport,
    });

    // 1. Startup & Handshake over real stdio process
    await session.start();
    expect(session.getState()).toBe('running');
    expect(session.getHealth()).toBe('ready');
    expect(session.getCapabilities()?.hoverProvider).toBe(true);

    // 2. Document tracking
    session.trackDocument('file:///C:/test/smoke.ts');
    expect(session.getTrackedDocumentCount()).toBe(1);

    // 3. Graceful shutdown and process termination
    await session.stop();
    expect(session.getState()).toBe('stopped');
    expect(transport.isAlive()).toBe(false);
  });
});
