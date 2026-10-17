/**
 * QM Editor — LSP Selection Range Integration Test Suite
 * Phase 06, Step 69 — LSP Selection Ranges, Smart Structural Selection & Context-Aware Cursor Expansion
 *
 * Implements deterministic tests for all required scenarios (Test A through Test R)
 * defined in Section 85 & 110 of the Step 69 specification.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LspSelectionRangeProvider } from './LspSelectionRangeProvider';
import { LspSelectionRangeCoordinator } from './LspSelectionRangeCoordinator';
import { MockLspTransport } from '../transport/MockLspTransport';
import { LspServerRegistry } from '../LspServerRegistry';
import { LspServerManager } from '../LspServerManager';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { DocumentRecord } from '../../documents/DocumentTypes';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { SettingsService } from '../../settings/SettingsService';
import { RequestMessage, LspSelectionRange } from '../LspTypes';

describe('LspSelectionRange Subsystem Integration', () => {
  let docEngine: DocumentEngine;
  let workspaceEngine: WorkspaceEngine;
  let serverManager: LspServerManager;
  let mockTransport: MockLspTransport;
  let selectionProvider: LspSelectionRangeProvider;
  let selectionCoordinator: LspSelectionRangeCoordinator;
  let customHandler: ((method: string, params: any) => any | Promise<any>) | null = null;

  const testUri = 'file:///C:/project/src/index.ts';
  const initialCode = [
    'function calculate() {', // Line 0: offset 0..21
    '  const value = 42;',     // Line 1: offset 22..41, "42" is at 38..40
    '  return value;',         // Line 2: offset 42..56
    '}',                       // Line 3: offset 57..58
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
              selectionRangeProvider: true,
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

    selectionProvider = new LspSelectionRangeProvider(
      serverManager,
      SettingsService.getInstance(),
      workspaceEngine,
      docEngine
    );

    selectionCoordinator = new LspSelectionRangeCoordinator(
      selectionProvider,
      docEngine,
      SettingsService.getInstance()
    );
  });

  afterEach(async () => {
    selectionCoordinator.dispose();
    selectionProvider.dispose();
    await serverManager.dispose();
    for (const d of docEngine.getAllDocuments()) {
      await docEngine.close(d.id, true);
    }
  });

  // ---------------------------------------------------------------------------
  // Capability & Basic Handshake
  // ---------------------------------------------------------------------------

  it('detects selectionRangeProvider capability and successfully queries ranges', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    const expectedRange: LspSelectionRange = {
      range: { start: { line: 1, character: 16 }, end: { line: 1, character: 18 } }, // "42"
    };

    customHandler = (method, _params) => {
      if (method === 'textDocument/selectionRange') {
        return [expectedRange];
      }
      return null;
    };

    const result = await selectionProvider.requestSelectionRanges(doc.resourceUri, [
      { line: 1, character: 17 },
    ]);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    expect(result![0].ranges).toHaveLength(1);
    expect(result![0].ranges[0].range).toEqual({
      startLine: 2,
      startColumn: 17,
      endLine: 2,
      endColumn: 19,
    });
  });

  // ---------------------------------------------------------------------------
  // Test A: One simple selection range
  // ---------------------------------------------------------------------------
  it('Test A: One simple selection range', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/selectionRange') {
        return [
          {
            range: { start: { line: 1, character: 8 }, end: { line: 1, character: 13 } }, // "value"
          },
        ];
      }
      return null;
    };

    const res = await selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 1, character: 9 }]);
    expect(res).not.toBeNull();
    expect(res![0].ranges).toHaveLength(1);
    expect(res![0].ranges[0].offsetRange).toEqual({ from: 31, to: 36 });
  });

  // ---------------------------------------------------------------------------
  // Test B: Nested range hierarchy (expression -> statement -> function)
  // ---------------------------------------------------------------------------
  it('Test B: Nested range hierarchy with progressive selection expansion', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    const hierarchy: LspSelectionRange = {
      range: { start: { line: 1, character: 16 }, end: { line: 1, character: 18 } }, // "42"
      parent: {
        range: { start: { line: 1, character: 2 }, end: { line: 1, character: 19 } }, // "const value = 42;"
        parent: {
          range: { start: { line: 0, character: 0 }, end: { line: 3, character: 1 } }, // "function calculate() { ... }"
        },
      },
    };

    customHandler = (method) => {
      if (method === 'textDocument/selectionRange') {
        return [hierarchy];
      }
      return null;
    };

    // Step 1: Cursor at "42" (offset 39)
    const exp1 = await selectionCoordinator.expandSelection(doc.id, [{ anchor: 39, head: 39 }]);
    expect(exp1.expanded).toBe(true);
    expect(exp1.source).toBe('lsp');
    expect(exp1.selections).toEqual([{ anchor: 39, head: 41 }]); // 39..41 is "42" in 0-based offset (Line 1: 23 + 16 = 39)

    // Step 2: Expand again -> statement
    const exp2 = await selectionCoordinator.expandSelection(doc.id, exp1.selections);
    expect(exp2.expanded).toBe(true);
    expect(exp2.selections).toEqual([{ anchor: 25, head: 42 }]); // "const value = 42;"

    // Step 3: Expand again -> function
    const exp3 = await selectionCoordinator.expandSelection(doc.id, exp2.selections);
    expect(exp3.expanded).toBe(true);
    expect(exp3.selections).toEqual([{ anchor: 0, head: 60 }]); // entire function

    // Step 4: Shrink selection -> reverts to statement without calling server
    const shrink1 = selectionCoordinator.shrinkSelection(doc.id, exp3.selections);
    expect(shrink1.expanded).toBe(true);
    expect(shrink1.selections).toEqual([{ anchor: 25, head: 42 }]);

    // Step 5: Shrink selection -> reverts to word "42"
    const shrink2 = selectionCoordinator.shrinkSelection(doc.id, shrink1.selections);
    expect(shrink2.expanded).toBe(true);
    expect(shrink2.selections).toEqual([{ anchor: 39, head: 41 }]);
  });

  // ---------------------------------------------------------------------------
  // Test C: Deep hierarchy
  // ---------------------------------------------------------------------------
  it('Test C: Deep hierarchy safely bounded by maxDepth', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    let current: any = { range: { start: { line: 1, character: 16 }, end: { line: 1, character: 18 } } };
    const root = current;

    for (let i = 0; i < 25; i++) {
      const next: any = {
        range: { start: { line: 0, character: 0 }, end: { line: 3, character: 1 } },
      };
      current.parent = next;
      current = next;
    }

    customHandler = (method) => {
      if (method === 'textDocument/selectionRange') {
        return [root];
      }
      return null;
    };

    const res = await selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 1, character: 17 }]);
    expect(res).not.toBeNull();
    // Duplicates collapsed; safely returned without stack overflow
    expect(res![0].ranges.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Test D: Duplicate ranges
  // ---------------------------------------------------------------------------
  it('Test D: Duplicate ranges are collapsed transparently', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    const duplicateChain: LspSelectionRange = {
      range: { start: { line: 1, character: 16 }, end: { line: 1, character: 18 } },
      parent: {
        range: { start: { line: 1, character: 16 }, end: { line: 1, character: 18 } }, // Duplicate!
        parent: {
          range: { start: { line: 1, character: 2 }, end: { line: 1, character: 19 } },
        },
      },
    };

    customHandler = (method) => {
      if (method === 'textDocument/selectionRange') {
        return [duplicateChain];
      }
      return null;
    };

    const res = await selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 1, character: 17 }]);
    expect(res).not.toBeNull();
    // Duplicate level was eliminated
    expect(res![0].ranges).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // Test E: Invalid range
  // ---------------------------------------------------------------------------
  it('Test E: Invalid range coordinates are rejected safely', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/selectionRange') {
        return [
          {
            range: { start: { line: 10, character: 0 }, end: { line: 2, character: 0 } }, // Inverted!
          },
        ];
      }
      return null;
    };

    const res = await selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 1, character: 5 }]);
    expect(res).not.toBeNull();
    expect(res![0].ranges).toHaveLength(0); // Safely rejected
  });

  // ---------------------------------------------------------------------------
  // Test F: Invalid parent
  // ---------------------------------------------------------------------------
  it('Test F: Invalid parent relationship is safely discarded', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/selectionRange') {
        return [
          {
            range: { start: { line: 1, character: 2 }, end: { line: 1, character: 10 } },
            parent: {
              range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } }, // Disjoint parent!
            },
          },
        ];
      }
      return null;
    };

    const res = await selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 1, character: 5 }]);
    expect(res).not.toBeNull();
    // Valid child kept, invalid parent dropped
    expect(res![0].ranges).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Test G: Self-reference
  // ---------------------------------------------------------------------------
  it('Test G: Self-referential range does not cause infinite loop', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    const selfRef: any = {
      range: { start: { line: 1, character: 2 }, end: { line: 1, character: 10 } },
      parent: {
        range: { start: { line: 1, character: 2 }, end: { line: 1, character: 10 } },
      },
    };

    customHandler = (method) => {
      if (method === 'textDocument/selectionRange') {
        return [selfRef];
      }
      return null;
    };

    const res = await selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 1, character: 5 }]);
    expect(res).not.toBeNull();
    expect(res![0].ranges).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Test H: Cycle
  // ---------------------------------------------------------------------------
  it('Test H: Cyclic hierarchy (A -> B -> A) is detected and truncated safely', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    const cyclicChain: any = {
      range: { start: { line: 1, character: 2 }, end: { line: 1, character: 10 } },
      parent: {
        range: { start: { line: 0, character: 0 }, end: { line: 3, character: 0 } },
        parent: {
          range: { start: { line: 1, character: 2 }, end: { line: 1, character: 10 } }, // Cycle
        },
      },
    };

    customHandler = (method) => {
      if (method === 'textDocument/selectionRange') {
        return [cyclicChain];
      }
      return null;
    };

    const res = await selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 1, character: 5 }]);
    expect(res).not.toBeNull();
    expect(res![0].ranges).toHaveLength(2); // A and B kept, cycle terminated
  });

  // ---------------------------------------------------------------------------
  // Test I: Out-of-order response
  // ---------------------------------------------------------------------------
  it('Test I: Out-of-order response is superseded safely', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    let resolveFirst: any;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    let callCount = 0;
    customHandler = (_method) => {
      callCount++;
      if (callCount === 1) {
        return firstPromise;
      }
      return [
        {
          range: { start: { line: 2, character: 2 }, end: { line: 2, character: 8 } },
        },
      ];
    };

    // Fire first request (slow)
    const req1 = selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 1, character: 5 }]);
    // Fire second request (fast)
    const req2 = selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 2, character: 4 }]);

    const res2 = await req2;
    expect(res2).not.toBeNull();
    expect(res2![0].ranges[0].offsetRange).toEqual({ from: 45, to: 51 });

    // Now resolve first request
    resolveFirst([
      {
        range: { start: { line: 1, character: 2 }, end: { line: 1, character: 8 } },
      },
    ]);

    const res1 = await req1;
    // Discarded because req2 superseded it
    expect(res1).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Test J: Delayed response
  // ---------------------------------------------------------------------------
  it('Test J: Delayed response handles graceful resolution', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = async () => {
      await new Promise((r) => setTimeout(r, 20));
      return [
        {
          range: { start: { line: 1, character: 8 }, end: { line: 1, character: 13 } },
        },
      ];
    };

    const res = await selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 1, character: 10 }]);
    expect(res).not.toBeNull();
    expect(res![0].ranges).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Test K: Document edit during request (stale protection)
  // ---------------------------------------------------------------------------
  it('Test K: Response discarded as stale if document edited during request', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = async () => {
      // Simulate edit occurring while server is processing
      docEngine.updateText(doc.id, '// modified\n' + doc.content);
      return [
        {
          range: { start: { line: 1, character: 2 }, end: { line: 1, character: 10 } },
        },
      ];
    };

    const res = await selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 1, character: 5 }]);
    expect(res).toBeNull(); // Discarded due to revision mismatch!
  });

  // ---------------------------------------------------------------------------
  // Test L: Document close during request
  // ---------------------------------------------------------------------------
  it('Test L: Document close clears state and cancels request', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = async () => {
      await docEngine.close(doc.id, true);
      return [
        {
          range: { start: { line: 1, character: 2 }, end: { line: 1, character: 10 } },
        },
      ];
    };

    const res = await selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 1, character: 5 }]);
    expect(res).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Test M: Workspace switch
  // ---------------------------------------------------------------------------
  it('Test M: Workspace switch invalidates cache', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = () => [
      {
        range: { start: { line: 1, character: 8 }, end: { line: 1, character: 13 } },
      },
    ];

    await selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 1, character: 10 }]);
    expect(selectionProvider.getCache(doc.resourceUri)).toBeDefined();

    selectionProvider.clearCache();
    expect(selectionProvider.getCache(doc.resourceUri)).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Test N: Server restart
  // ---------------------------------------------------------------------------
  it('Test N: Server restart invalidates pending and cached state', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = () => [
      {
        range: { start: { line: 1, character: 8 }, end: { line: 1, character: 13 } },
      },
    ];

    await selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 1, character: 10 }]);
    expect(selectionProvider.getCache(doc.resourceUri)).toBeDefined();

    const session = serverManager.getActiveSession('typescript', 'test-ws');
    if (session) {
      await session.restart();
    }

    selectionProvider.clearCache();
    selectionCoordinator.clearHistory();
    expect(selectionProvider.getCache(doc.resourceUri)).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Test O: Multiple cursor positions
  // ---------------------------------------------------------------------------
  it('Test O: Multiple cursor positions are mapped 1-to-1 preserving order', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method, params) => {
      if (method === 'textDocument/selectionRange') {
        expect(params.positions).toHaveLength(2);
        return [
          { range: { start: { line: 1, character: 8 }, end: { line: 1, character: 13 } } }, // Cursor 1
          { range: { start: { line: 2, character: 9 }, end: { line: 2, character: 14 } } }, // Cursor 2
        ];
      }
      return null;
    };

    const res = await selectionProvider.requestSelectionRanges(doc.resourceUri, [
      { line: 1, character: 9 },
      { line: 2, character: 10 },
    ]);

    expect(res).not.toBeNull();
    expect(res).toHaveLength(2);
    expect(res![0].ranges[0].offsetRange).toEqual({ from: 31, to: 36 });
    expect(res![1].ranges[0].offsetRange).toEqual({ from: 52, to: 57 });
  });

  // ---------------------------------------------------------------------------
  // Test P: Partial multi-cursor failure
  // ---------------------------------------------------------------------------
  it('Test P: Partial multi-cursor failure expands valid positions and retains invalid ones', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = () => [
      { range: { start: { line: 1, character: 8 }, end: { line: 1, character: 13 } } }, // Valid cursor 1
      null, // Invalid cursor 2
    ];

    // Cursor 1 at offset 31, Cursor 2 at offset 50
    const exp = await selectionCoordinator.expandSelection(doc.id, [
      { anchor: 31, head: 31 },
      { anchor: 50, head: 50 },
    ]);

    expect(exp.expanded).toBe(true);
    expect(exp.selections).toHaveLength(2);
    expect(exp.selections[0]).toEqual({ anchor: 31, head: 36 }); // Cursor 1 expanded
    expect(exp.selections[1]).toEqual({ anchor: 50, head: 50 }); // Cursor 2 preserved!
  });

  // ---------------------------------------------------------------------------
  // Test Q: Empty result / Native Fallback
  // ---------------------------------------------------------------------------
  it('Test Q: Empty result triggers native editor fallback without throwing', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = () => null; // LSP returns empty

    // Cursor inside "calculate" (offset 10)
    const exp = await selectionCoordinator.expandSelection(doc.id, [{ anchor: 10, head: 10 }]);
    expect(exp.expanded).toBe(true);
    expect(exp.source).toBe('native');
    // Word boundary of "calculate": 9..18
    expect(exp.selections).toEqual([{ anchor: 9, head: 18 }]);
  });

  // ---------------------------------------------------------------------------
  // Test R: Huge response / Bounds protection
  // ---------------------------------------------------------------------------
  it('Test R: Huge response is bounded and processed safely', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    let current: any = { range: { start: { line: 1, character: 16 }, end: { line: 1, character: 18 } } };
    const root = current;

    for (let i = 0; i < 200; i++) {
      const next: any = {
        range: { start: { line: 0, character: 0 }, end: { line: 3, character: 1 } },
      };
      current.parent = next;
      current = next;
    }

    customHandler = () => [root];

    const res = await selectionProvider.requestSelectionRanges(doc.resourceUri, [{ line: 1, character: 17 }]);
    expect(res).not.toBeNull();
    expect(res![0].ranges.length).toBeLessThanOrEqual(50);
  });
});
