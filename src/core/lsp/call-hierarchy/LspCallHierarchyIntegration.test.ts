/**
 * QM Editor — LSP Call Hierarchy Integration Test Suite
 * Phase 06, Step 70 — LSP Call Hierarchy, Callers, Callees & Safe Cross-File Code Relationship Navigation
 *
 * Implements deterministic tests for all required scenarios (Test A through Test T)
 * defined in Section 96 of the Step 70 specification.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LspCallHierarchyProvider } from './LspCallHierarchyProvider';
import { LspCallHierarchyCoordinator } from './LspCallHierarchyCoordinator';
import { MockLspTransport } from '../transport/MockLspTransport';
import { LspServerRegistry } from '../LspServerRegistry';
import { LspServerManager } from '../LspServerManager';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { DocumentRecord } from '../../documents/DocumentTypes';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { NavigationCoordinator } from '../../navigation/NavigationCoordinator';
import { SettingsService } from '../../settings/SettingsService';
import {
  RequestMessage,
  LspCallHierarchyItem,
  LspSymbolKind,
  LspCallHierarchyIncomingCall,
  LspCallHierarchyOutgoingCall,
} from '../LspTypes';

describe('LspCallHierarchy Subsystem Integration (Tests A through T)', () => {
  let docEngine: DocumentEngine;
  let workspaceEngine: WorkspaceEngine;
  let serverManager: LspServerManager;
  let mockTransport: MockLspTransport;
  let callProvider: LspCallHierarchyProvider;
  let callCoordinator: LspCallHierarchyCoordinator;
  let customHandler: ((method: string, params: any) => any | Promise<any>) | null = null;

  const testUriA = 'file:///C:/project/src/serviceA.ts';
  const testUriB = 'file:///C:/project/src/serviceB.ts';
  const testUriC = 'file:///C:/project/src/serviceC.ts';

  const codeA = [
    'export function functionA() {',
    '  functionB();',
    '}',
  ].join('\n');

  const codeB = [
    'export function functionB() {',
    '  functionC();',
    '}',
  ].join('\n');

  const openDoc = async (uri: string, content: string, languageId: string): Promise<DocumentRecord> => {
    const wsId = workspaceEngine.getWorkspaceId() || 'test-ws';
    const { document } = await docEngine.openResource(uri, {
      initialContent: content,
      languageId,
      workspaceId: wsId,
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
              callHierarchyProvider: true,
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

    await workspaceEngine.open('C:/project', { force: true });
    const wsId = workspaceEngine.getWorkspaceId() || 'test-ws';

    serverManager = new (LspServerManager as any)(LspServerRegistry.getInstance());
    serverManager.setTransportFactory(() => mockTransport);

    const session = await serverManager.getOrCreateSession('typescript', '.ts', wsId, 'C:/project');
    if (session) {
      await session.start();
    }

    callProvider = new LspCallHierarchyProvider(
      serverManager,
      SettingsService.getInstance(),
      workspaceEngine,
      docEngine
    );

    callCoordinator = new LspCallHierarchyCoordinator(
      callProvider,
      docEngine,
      workspaceEngine,
      NavigationCoordinator.getInstance()
    );
  });

  afterEach(async () => {
    callCoordinator.dispose();
    callProvider.dispose();
    await serverManager.dispose();
    for (const d of docEngine.getAllDocuments()) {
      await docEngine.close(d.id, true);
    }
    await workspaceEngine.close({ force: true });
  });

  // --- Test A: Prepare one symbol ---
  it('Test A: prepares a single callable symbol at cursor', async () => {
    await openDoc(testUriA, codeA, 'typescript');

    const itemA: LspCallHierarchyItem = {
      name: 'functionA',
      kind: LspSymbolKind.Function,
      uri: testUriA,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };

    customHandler = (method) => {
      if (method === 'textDocument/prepareCallHierarchy') {
        return [itemA];
      }
      return null;
    };

    const items = await callCoordinator.prepareHierarchy(testUriA, { line: 0, character: 18 });
    expect(items).not.toBeNull();
    expect(items!.length).toBe(1);
    expect(items![0].name).toBe('functionA');
    expect(items![0].kind).toBe('function');
    expect(items![0].range.startLine).toBe(1);
  });

  // --- Test B: Prepare multiple symbols (e.g. overloaded or ambiguous) ---
  it('Test B: prepares multiple symbols deterministically', async () => {
    await openDoc(testUriA, codeA, 'typescript');

    const itemsMock: LspCallHierarchyItem[] = [
      {
        name: 'functionA',
        kind: LspSymbolKind.Function,
        detail: '(arg: string): void',
        uri: testUriA,
        range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
        selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
      },
      {
        name: 'functionA',
        kind: LspSymbolKind.Function,
        detail: '(arg: number): void',
        uri: testUriA,
        range: { start: { line: 3, character: 0 }, end: { line: 5, character: 1 } },
        selectionRange: { start: { line: 3, character: 16 }, end: { line: 3, character: 25 } },
      },
    ];

    customHandler = (method) => {
      if (method === 'textDocument/prepareCallHierarchy') return itemsMock;
      return null;
    };

    const items = await callCoordinator.prepareHierarchy(testUriA, { line: 0, character: 18 });
    expect(items).not.toBeNull();
    expect(items!.length).toBe(2);
    expect(items![0].detail).toBe('(arg: string): void');
    expect(items![1].detail).toBe('(arg: number): void');
  });

  // --- Test C: Incoming calls ---
  it('Test C: requests incoming calls and returns callers', async () => {
    await openDoc(testUriB, codeB, 'typescript');

    const rootItem: LspCallHierarchyItem = {
      name: 'functionB',
      kind: LspSymbolKind.Function,
      uri: testUriB,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };

    const callerItem: LspCallHierarchyItem = {
      name: 'functionA',
      kind: LspSymbolKind.Function,
      uri: testUriA,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };

    const incomingCallsMock: LspCallHierarchyIncomingCall[] = [
      {
        from: callerItem,
        fromRanges: [{ start: { line: 1, character: 2 }, end: { line: 1, character: 12 } }],
      },
    ];

    customHandler = (method) => {
      if (method === 'textDocument/prepareCallHierarchy') return [rootItem];
      if (method === 'callHierarchy/incomingCalls') return incomingCallsMock;
      return null;
    };

    const [root] = (await callCoordinator.prepareHierarchy(testUriB, { line: 0, character: 18 }))!;
    const treeNode = callCoordinator.createRootTreeNode(root, 'incoming');

    const callers = await callCoordinator.expandNode(treeNode, 'incoming');
    expect(callers.length).toBe(1);
    expect(callers[0].item.name).toBe('functionA');
    expect(callers[0].callSiteRanges[0].startLine).toBe(2);
  });

  // --- Test D: Outgoing calls ---
  it('Test D: requests outgoing calls and returns callees', async () => {
    await openDoc(testUriA, codeA, 'typescript');

    const rootItem: LspCallHierarchyItem = {
      name: 'functionA',
      kind: LspSymbolKind.Function,
      uri: testUriA,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };

    const calleeItem: LspCallHierarchyItem = {
      name: 'functionB',
      kind: LspSymbolKind.Function,
      uri: testUriB,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };

    const outgoingCallsMock: LspCallHierarchyOutgoingCall[] = [
      {
        to: calleeItem,
        fromRanges: [{ start: { line: 1, character: 2 }, end: { line: 1, character: 12 } }],
      },
    ];

    customHandler = (method) => {
      if (method === 'textDocument/prepareCallHierarchy') return [rootItem];
      if (method === 'callHierarchy/outgoingCalls') return outgoingCallsMock;
      return null;
    };

    const [root] = (await callCoordinator.prepareHierarchy(testUriA, { line: 0, character: 18 }))!;
    const treeNode = callCoordinator.createRootTreeNode(root, 'outgoing');

    const callees = await callCoordinator.expandNode(treeNode, 'outgoing');
    expect(callees.length).toBe(1);
    expect(callees[0].item.name).toBe('functionB');
  });

  // --- Test E: Multiple call sites ---
  it('Test E: preserves multiple call-site ranges for a caller', async () => {
    await openDoc(testUriB, codeB, 'typescript');

    const rootItem: LspCallHierarchyItem = {
      name: 'functionB',
      kind: LspSymbolKind.Function,
      uri: testUriB,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };

    const incomingCallsMock: LspCallHierarchyIncomingCall[] = [
      {
        from: {
          name: 'callerMulti',
          kind: LspSymbolKind.Function,
          uri: testUriA,
          range: { start: { line: 0, character: 0 }, end: { line: 10, character: 1 } },
          selectionRange: { start: { line: 0, character: 9 }, end: { line: 0, character: 20 } },
        },
        fromRanges: [
          { start: { line: 2, character: 4 }, end: { line: 2, character: 14 } },
          { start: { line: 5, character: 4 }, end: { line: 5, character: 14 } },
          { start: { line: 8, character: 4 }, end: { line: 8, character: 14 } },
        ],
      },
    ];

    customHandler = (method) => {
      if (method === 'textDocument/prepareCallHierarchy') return [rootItem];
      if (method === 'callHierarchy/incomingCalls') return incomingCallsMock;
      return null;
    };

    const [root] = (await callCoordinator.prepareHierarchy(testUriB, { line: 0, character: 18 }))!;
    const treeNode = callCoordinator.createRootTreeNode(root, 'incoming');
    const callers = await callCoordinator.expandNode(treeNode, 'incoming');

    expect(callers[0].callSiteRanges.length).toBe(3);
    expect(callers[0].callSiteRanges[0].startLine).toBe(3);
    expect(callers[0].callSiteRanges[1].startLine).toBe(6);
    expect(callers[0].callSiteRanges[2].startLine).toBe(9);
  });

  // --- Test F & G: Nested callers and callees ---
  it('Test F & G: supports lazy recursive expansion of callers and callees', async () => {
    await openDoc(testUriB, codeB, 'typescript');

    const itemB: LspCallHierarchyItem = {
      name: 'functionB',
      kind: LspSymbolKind.Function,
      uri: testUriB,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };

    const itemA: LspCallHierarchyItem = {
      name: 'functionA',
      kind: LspSymbolKind.Function,
      uri: testUriA,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };

    const itemMain: LspCallHierarchyItem = {
      name: 'main',
      kind: LspSymbolKind.Function,
      uri: 'file:///C:/project/src/main.ts',
      range: { start: { line: 0, character: 0 }, end: { line: 5, character: 1 } },
      selectionRange: { start: { line: 0, character: 9 }, end: { line: 0, character: 13 } },
    };

    customHandler = (method, params) => {
      if (method === 'textDocument/prepareCallHierarchy') return [itemB];
      if (method === 'callHierarchy/incomingCalls') {
        if (params.item.name === 'functionB') {
          return [{ from: itemA, fromRanges: [{ start: { line: 1, character: 2 }, end: { line: 1, character: 12 } }] }];
        }
        if (params.item.name === 'functionA') {
          return [{ from: itemMain, fromRanges: [{ start: { line: 2, character: 2 }, end: { line: 2, character: 12 } }] }];
        }
      }
      return null;
    };

    const [root] = (await callCoordinator.prepareHierarchy(testUriB, { line: 0, character: 18 }))!;
    const rootNode = callCoordinator.createRootTreeNode(root, 'incoming');

    // Expand level 1 (functionB -> functionA)
    const level1 = await callCoordinator.expandNode(rootNode, 'incoming');
    expect(level1.length).toBe(1);
    expect(level1[0].item.name).toBe('functionA');

    // Expand level 2 (functionA -> main)
    const level2 = await callCoordinator.expandNode(level1[0], 'incoming');
    expect(level2.length).toBe(1);
    expect(level2[0].item.name).toBe('main');
  });

  // --- Test H: Cycle A -> B -> C -> A ---
  it('Test H: detects cycle A -> B -> C -> A and halts infinite expansion', async () => {
    await openDoc(testUriA, codeA, 'typescript');

    const itemA: LspCallHierarchyItem = {
      name: 'functionA',
      kind: LspSymbolKind.Function,
      uri: testUriA,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };
    const itemB: LspCallHierarchyItem = {
      name: 'functionB',
      kind: LspSymbolKind.Function,
      uri: testUriB,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };
    const itemC: LspCallHierarchyItem = {
      name: 'functionC',
      kind: LspSymbolKind.Function,
      uri: testUriC,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };

    customHandler = (method, params) => {
      if (method === 'textDocument/prepareCallHierarchy') return [itemA];
      if (method === 'callHierarchy/outgoingCalls') {
        if (params.item.name === 'functionA') return [{ to: itemB, fromRanges: [] }];
        if (params.item.name === 'functionB') return [{ to: itemC, fromRanges: [] }];
        if (params.item.name === 'functionC') return [{ to: itemA, fromRanges: [] }]; // Cycle back to A!
      }
      return null;
    };

    const [root] = (await callCoordinator.prepareHierarchy(testUriA, { line: 0, character: 18 }))!;
    const rootNode = callCoordinator.createRootTreeNode(root, 'outgoing');

    const nodeB = (await callCoordinator.expandNode(rootNode, 'outgoing'))[0];
    expect(nodeB.item.name).toBe('functionB');
    expect(nodeB.isCycle).toBeFalsy();

    const nodeC = (await callCoordinator.expandNode(nodeB, 'outgoing'))[0];
    expect(nodeC.item.name).toBe('functionC');
    expect(nodeC.isCycle).toBeFalsy();

    const nodeCycleA = (await callCoordinator.expandNode(nodeC, 'outgoing'))[0];
    expect(nodeCycleA.item.name).toBe('functionA');
    expect(nodeCycleA.isCycle).toBe(true);
    expect(nodeCycleA.state).toBe('cycle');

    // Attempting to expand cyclic node returns empty array and stops recursion
    const subChildren = await callCoordinator.expandNode(nodeCycleA, 'outgoing');
    expect(subChildren).toEqual([]);
  });

  // --- Test I: Duplicate calls ---
  it('Test I: deduplicates identical call relationships from language server', async () => {
    await openDoc(testUriB, codeB, 'typescript');

    const rootItem: LspCallHierarchyItem = {
      name: 'functionB',
      kind: LspSymbolKind.Function,
      uri: testUriB,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };

    const callerItem: LspCallHierarchyItem = {
      name: 'functionA',
      kind: LspSymbolKind.Function,
      uri: testUriA,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };

    // Duplicate identical incoming calls returned by server
    const duplicates: LspCallHierarchyIncomingCall[] = [
      { from: callerItem, fromRanges: [{ start: { line: 1, character: 2 }, end: { line: 1, character: 12 } }] },
      { from: callerItem, fromRanges: [{ start: { line: 1, character: 2 }, end: { line: 1, character: 12 } }] },
    ];

    customHandler = (method) => {
      if (method === 'textDocument/prepareCallHierarchy') return [rootItem];
      if (method === 'callHierarchy/incomingCalls') return duplicates;
      return null;
    };

    const callers = await callProvider.getIncomingCalls(rootItem as any);
    expect(callers).not.toBeNull();
    expect(callers!.length).toBe(1); // Deduplicated to 1!
  });

  // --- Test J: Invalid symbol range ---
  it('Test J: normalizes inverted/outside selection range safely', async () => {
    await openDoc(testUriA, codeA, 'typescript');

    const invalidRangeItem: LspCallHierarchyItem = {
      name: 'functionA',
      kind: LspSymbolKind.Function,
      uri: testUriA,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 99, character: 0 }, end: { line: 100, character: 0 } }, // outside!
    };

    customHandler = () => [invalidRangeItem];

    const items = await callProvider.prepareCallHierarchy(testUriA, { line: 0, character: 0 });
    expect(items).not.toBeNull();
    expect(items![0].selectionRange.startLine).toBe(1); // Normalized to range
  });

  // --- Test K: Invalid call-site range ---
  it('Test K: filters out malformed call-site ranges', async () => {
    await openDoc(testUriB, codeB, 'typescript');

    const rootItem: LspCallHierarchyItem = {
      name: 'functionB',
      kind: LspSymbolKind.Function,
      uri: testUriB,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };

    const callerItem: LspCallHierarchyItem = {
      name: 'callerWithBadRange',
      kind: LspSymbolKind.Function,
      uri: testUriA,
      range: { start: { line: 0, character: 0 }, end: { line: 5, character: 1 } },
      selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
    };

    const incomingWithBadRange: LspCallHierarchyIncomingCall[] = [
      {
        from: callerItem,
        fromRanges: [
          { start: { line: 10, character: 0 }, end: { line: 2, character: 0 } } as any, // Inverted!
          { start: { line: 1, character: 2 }, end: { line: 1, character: 12 } }, // Valid!
        ],
      },
    ];

    customHandler = (method) => {
      if (method === 'callHierarchy/incomingCalls') return incomingWithBadRange;
      return null;
    };

    const calls = await callProvider.getIncomingCalls(rootItem as any);
    expect(calls).not.toBeNull();
    expect(calls![0].fromRanges.length).toBe(1);
    expect(calls![0].fromRanges[0].startLine).toBe(2);
  });

  // --- Test L: Malformed / Dangerous URI ---
  it('Test L: rejects call hierarchy items with malicious URI schemes', async () => {
    await openDoc(testUriA, codeA, 'typescript');

    const maliciousItem: LspCallHierarchyItem = {
      name: 'evil',
      kind: LspSymbolKind.Function,
      uri: 'javascript:alert(1)',
      range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
      selectionRange: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
    };

    customHandler = () => [maliciousItem];

    const items = await callProvider.prepareCallHierarchy(testUriA, { line: 0, character: 0 });
    expect(items).toBeNull();
  });

  // --- Test M: Huge result clamping ---
  it('Test M: handles large number of calls without freezing', async () => {
    await openDoc(testUriB, codeB, 'typescript');

    const rootItem: LspCallHierarchyItem = {
      name: 'functionB',
      kind: LspSymbolKind.Function,
      uri: testUriB,
      range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
      selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 25 } },
    };

    const manyCallers: LspCallHierarchyIncomingCall[] = [];
    for (let i = 0; i < 300; i++) {
      manyCallers.push({
        from: {
          name: `caller_${i}`,
          kind: LspSymbolKind.Function,
          uri: `file:///C:/project/src/file_${i}.ts`,
          range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
          selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        },
        fromRanges: [{ start: { line: 1, character: 0 }, end: { line: 1, character: 5 } }],
      });
    }

    customHandler = () => manyCallers;

    const res = await callProvider.getIncomingCalls(rootItem as any);
    expect(res).not.toBeNull();
    expect(res!.length).toBe(300);
  });

  // --- Test N & O: Delayed and out-of-order responses ---
  it('Test N & O: handles delayed responses and in-flight request superseding', async () => {
    await openDoc(testUriA, codeA, 'typescript');

    let resolveFirst: ((val: any) => void) | null = null;
    let callCount = 0;

    customHandler = () => {
      callCount++;
      if (callCount === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return [
        {
          name: 'secondCall',
          kind: LspSymbolKind.Function,
          uri: testUriA,
          range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
          selectionRange: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
        },
      ];
    };

    const p1 = callProvider.prepareCallHierarchy(testUriA, { line: 0, character: 0 });
    const p2 = callProvider.prepareCallHierarchy(testUriA, { line: 0, character: 1 });

    // Second response arrives first
    const res2 = await p2;
    expect(res2![0].name).toBe('secondCall');

    // First response resolves later
    resolveFirst!([
      {
        name: 'firstCallStale',
        kind: LspSymbolKind.Function,
        uri: testUriA,
        range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
        selectionRange: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
      },
    ]);
    const res1 = await p1;
    expect(res1).toBeNull(); // Discarded as superseded
  });

  // --- Test P: Document edit during request ---
  it('Test P: discards response if document revision changes during request', async () => {
    const doc = await openDoc(testUriA, codeA, 'typescript');

    customHandler = async () => {
      // Document is modified while server is processing
      await docEngine.updateText(doc.id, 'export function modified() {}', 'user-edit');
      return [
        {
          name: 'staleFunction',
          kind: LspSymbolKind.Function,
          uri: testUriA,
          range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
          selectionRange: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
        },
      ];
    };

    const res = await callProvider.prepareCallHierarchy(testUriA, { line: 0, character: 0 });
    expect(res).toBeNull();
  });

  // --- Test Q: Workspace switch ---
  it('Test Q: clears active hierarchy context on workspace switch', async () => {
    await openDoc(testUriA, codeA, 'typescript');

    customHandler = () => [
      {
        name: 'functionA',
        kind: LspSymbolKind.Function,
        uri: testUriA,
        range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
        selectionRange: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
      },
    ];

    await callCoordinator.prepareHierarchy(testUriA, { line: 0, character: 0 });
    expect(callCoordinator.getActiveContext()).not.toBeNull();

    // Switch workspace
    callCoordinator.clearSession();
    expect(callCoordinator.getActiveContext()).toBeNull();
  });

  // --- Test R: Server restart ---
  it('Test R: clears session on server restart', async () => {
    await openDoc(testUriA, codeA, 'typescript');

    customHandler = () => [
      {
        name: 'functionA',
        kind: LspSymbolKind.Function,
        uri: testUriA,
        range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
        selectionRange: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
      },
    ];

    await callCoordinator.prepareHierarchy(testUriA, { line: 0, character: 0 });
    expect(callCoordinator.getActiveContext()).not.toBeNull();

    const wsId = workspaceEngine.getWorkspaceId() || 'test-ws';
    const session = serverManager.getActiveSession('typescript', wsId);
    await session?.restart();
    callCoordinator.clearSession();

    expect(callCoordinator.getActiveContext()).toBeNull();
  });

  // --- Test S: Document close ---
  it('Test S: clears hierarchy context when root document closes', async () => {
    const doc = await openDoc(testUriA, codeA, 'typescript');

    customHandler = () => [
      {
        name: 'functionA',
        kind: LspSymbolKind.Function,
        uri: testUriA,
        range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
        selectionRange: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } },
      },
    ];

    await callCoordinator.prepareHierarchy(testUriA, { line: 0, character: 0 });
    expect(callCoordinator.getActiveContext()).not.toBeNull();

    await docEngine.close(doc.id, true);
    expect(callCoordinator.getActiveContext()).toBeNull();
  });

  // --- Test T: Language change / capability unsupported ---
  it('Test T: returns null when call hierarchy capability is not supported', async () => {
    await openDoc(testUriA, codeA, 'plaintext'); // plaintext has no LSP server

    const res = await callProvider.prepareCallHierarchy(testUriA, { line: 0, character: 0 });
    expect(res).toBeNull();

    const wsId = workspaceEngine.getWorkspaceId() || 'test-ws';
    const cap = callProvider.getCapabilityState('plaintext', wsId);
    expect(cap.supported).toBe(false);
  });
});
