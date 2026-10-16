/**
 * QM Editor LSP Document Synchronization Coordinator Unit Tests
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LspDocumentSync } from './LspDocumentSync';
import { LspServerManager } from './LspServerManager';
import { LspServerRegistry } from './LspServerRegistry';
import { MockLspTransport } from './transport/MockLspTransport';
import { globalDocumentEngine } from '../documents/DocumentEngine';
import { RequestMessage, NotificationMessage } from './LspTypes';

describe('LspDocumentSync', () => {
  let mockTransport: MockLspTransport;
  let serverManager: LspServerManager;
  let documentSync: LspDocumentSync;

  beforeEach(() => {
    mockTransport = new MockLspTransport();
    mockTransport.messageHandler = (msg) => {
      if ('method' in msg && msg.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: (msg as RequestMessage).id,
          result: {
            capabilities: {
              textDocumentSync: {
                openClose: true,
                change: 1, // Full sync
                save: { includeText: false },
              },
            },
          },
        };
      }
      return null;
    };

    // Instantiate isolated server manager using mock transport
    const registry = LspServerRegistry.getInstance();
    serverManager = new (LspServerManager as any)(registry, () => mockTransport);
    documentSync = new (LspDocumentSync as any)(serverManager, globalDocumentEngine);
    documentSync.setEnabled(true);
  });

  afterEach(async () => {
    documentSync.setEnabled(false);
    documentSync.dispose();
    await serverManager.dispose();
  });

  it('generates textDocument/didOpen with version 1 when document is opened', async () => {
    const { document: doc } = await globalDocumentEngine.openResource('file:///C:/test/sync-test.ts', {
      initialContent: 'const initial = 1;',
      languageId: 'typescript',
    });

    const sent = mockTransport.getSentMessages();
    const openMsg = sent.find((m) => 'method' in m && m.method === 'textDocument/didOpen') as NotificationMessage;

    expect(openMsg).toBeDefined();
    expect(openMsg.params).toMatchObject({
      textDocument: {
        uri: 'file:///C:/test/sync-test.ts',
        languageId: 'typescript',
        version: 1,
        text: 'const initial = 1;',
      },
    });

    expect(documentSync.isDocumentSynchronized(doc.id)).toBe(true);

    await globalDocumentEngine.close(doc.id, true);
  });

  it('generates textDocument/didChange with incremented monotonic version on text edit', async () => {
    const { document: doc } = await globalDocumentEngine.openResource('file:///C:/test/change-test.ts', {
      initialContent: 'let val = 1;',
      languageId: 'typescript',
    });

    await globalDocumentEngine.updateText(doc.id, 'let val = 2;');

    const sent = mockTransport.getSentMessages();
    const changeMsg = sent.find((m) => 'method' in m && m.method === 'textDocument/didChange') as NotificationMessage;

    expect(changeMsg).toBeDefined();
    expect(changeMsg.params).toMatchObject({
      textDocument: {
        uri: 'file:///C:/test/change-test.ts',
        version: 2,
      },
      contentChanges: [
        {
          text: 'let val = 2;',
        },
      ],
    });

    await globalDocumentEngine.close(doc.id, true);
  });

  it('generates textDocument/didSave when document is saved to disk', async () => {
    const { document: doc } = await globalDocumentEngine.openResource('file:///C:/test/save-test.ts', {
      initialContent: 'original',
      languageId: 'typescript',
    });

    await globalDocumentEngine.updateText(doc.id, 'updated for save');
    await globalDocumentEngine.save(doc.id);

    const sent = mockTransport.getSentMessages();
    const saveMsg = sent.find((m) => 'method' in m && m.method === 'textDocument/didSave') as NotificationMessage;

    expect(saveMsg).toBeDefined();
    expect(saveMsg.params).toMatchObject({
      textDocument: {
        uri: 'file:///C:/test/save-test.ts',
      },
    });

    await globalDocumentEngine.close(doc.id, true);
  });

  it('generates textDocument/didClose and untracks document when document is closed', async () => {
    const { document: doc } = await globalDocumentEngine.openResource('file:///C:/test/close-test.ts', {
      initialContent: 'hello',
      languageId: 'typescript',
    });

    expect(documentSync.isDocumentSynchronized(doc.id)).toBe(true);

    await globalDocumentEngine.close(doc.id, true);

    const sent = mockTransport.getSentMessages();
    const closeMsg = sent.find((m) => 'method' in m && m.method === 'textDocument/didClose') as NotificationMessage;

    expect(closeMsg).toBeDefined();
    expect(closeMsg.params).toMatchObject({
      textDocument: {
        uri: 'file:///C:/test/close-test.ts',
      },
    });

    expect(documentSync.isDocumentSynchronized(doc.id)).toBe(false);
  });
});
