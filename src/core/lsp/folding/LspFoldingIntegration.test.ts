/**
 * QM Editor — LSP Folding Integration Test Suite
 * Phase 06, Step 68 — LSP Folding Ranges, Smart Code Folding & Safe Document Structure Navigation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LspFoldingProvider } from './LspFoldingProvider';
import { LspFoldingCoordinator } from './LspFoldingCoordinator';
import { MockLspTransport } from '../transport/MockLspTransport';
import { LspServerRegistry } from '../LspServerRegistry';
import { LspServerManager } from '../LspServerManager';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { DocumentRecord } from '../../documents/DocumentTypes';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { SettingsService } from '../../settings/SettingsService';
import { RequestMessage, LspFoldingRange } from '../LspTypes';

describe('LspFolding Subsystem Integration', () => {
  let docEngine: DocumentEngine;
  let workspaceEngine: WorkspaceEngine;
  let serverManager: LspServerManager;
  let mockTransport: MockLspTransport;
  let foldingProvider: LspFoldingProvider;
  let foldingCoordinator: LspFoldingCoordinator;
  let customHandler: ((method: string, params: any) => any | Promise<any>) | null = null;

  const testUri = 'file:///C:/project/src/index.ts';
  const initialCode = [
    'import { a } from "./a";', // 0
    'import { b } from "./b";', // 1
    '// Block comment',        // 2
    '// Block comment end',    // 3
    'class Example {',         // 4
    '  method() {',            // 5
    '    if (true) {',         // 6
    '      return 42;',        // 7
    '    }',                   // 8
    '  }',                     // 9
    '}',                       // 10
  ].join('\n');

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
              foldingRangeProvider: true,
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

    foldingProvider = new LspFoldingProvider(
      serverManager,
      SettingsService.getInstance(),
      workspaceEngine,
      docEngine
    );

    foldingCoordinator = new LspFoldingCoordinator(
      foldingProvider,
      docEngine,
      SettingsService.getInstance()
    );
  });

  afterEach(async () => {
    foldingCoordinator.dispose();
    foldingProvider.dispose();
    await serverManager.dispose();
    for (const d of docEngine.getAllDocuments()) {
      await docEngine.close(d.id, true);
    }
  });

  it('detects foldingRangeProvider capability and successfully requests folding ranges', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    const expectedRanges: LspFoldingRange[] = [
      { startLine: 0, endLine: 1, kind: 'imports' },
      { startLine: 2, endLine: 3, kind: 'comment', collapsedText: '/* comment */' },
      { startLine: 4, endLine: 10, kind: 'region' },
      { startLine: 5, endLine: 9, kind: 'region' },
      { startLine: 6, endLine: 8, kind: 'region' },
    ];

    customHandler = (method, _params) => {
      if (method === 'textDocument/foldingRange') {
        return expectedRanges;
      }
      return null;
    };

    const result = await foldingProvider.requestFoldingRanges(doc.resourceUri!);
    expect(result).not.toBeNull();
    expect(result!.ranges).toHaveLength(5);
    expect(result!.editorRanges).toHaveLength(5);

    // Verify nested hierarchy
    expect(result!.tree).toHaveLength(3); // imports, comment, class Example
    const classNode = result!.tree[2];
    expect(classNode.range.startLine).toBe(4);
    expect(classNode.children).toHaveLength(1); // method
    const methodNode = classNode.children[0];
    expect(methodNode.range.startLine).toBe(5);
    expect(methodNode.children).toHaveLength(1); // if statement
  });

  it('handles empty server response cleanly', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/foldingRange') {
        return [];
      }
      return null;
    };

    const result = await foldingProvider.requestFoldingRanges(doc.resourceUri!);
    expect(result).not.toBeNull();
    expect(result!.ranges).toHaveLength(0);
    expect(result!.editorRanges).toHaveLength(0);
    expect(result!.tree).toHaveLength(0);
  });

  it('rejects stale response when document is edited while request is in flight', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = async (method) => {
      if (method === 'textDocument/foldingRange') {
        // Simulate document edit while request is processing
        await docEngine.updateText(doc.id, initialCode + '\nconst modified = true;');
        return [
          { startLine: 0, endLine: 1, kind: 'imports' },
        ];
      }
      return null;
    };

    const result = await foldingProvider.requestFoldingRanges(doc.resourceUri!);
    // Stale check discards response because revision advanced
    expect(result).toBeNull();
  });

  it('respects lsp.folding.enabled setting when disabled', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');
    const settings = SettingsService.getInstance();
    await settings.set('lsp.folding.enabled', false, 'user');

    customHandler = (method) => {
      if (method === 'textDocument/foldingRange') {
        return [{ startLine: 0, endLine: 1 }];
      }
      return null;
    };

    const result = await foldingProvider.requestFoldingRanges(doc.resourceUri!);
    expect(result).toBeNull();

    await settings.reset('lsp.folding.enabled', 'user');
  });

  it('clears folding ranges and coordinator state on document close', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/foldingRange') {
        return [{ startLine: 0, endLine: 1, kind: 'imports' }];
      }
      return null;
    };

    const listener = vi.fn();
    foldingCoordinator.subscribe(listener);

    foldingCoordinator.requestFoldingRanges(doc.resourceUri!, true);
    await new Promise((r) => setTimeout(r, 50));

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'rangesUpdated',
        uri: doc.resourceUri,
      })
    );

    // Close document
    await docEngine.close(doc.id, true);

    expect(foldingCoordinator.getEditorRanges(doc.resourceUri!)).toHaveLength(0);
  });
});
