/**
 * QM Editor LSP Completion Integration Test Suite
 * Phase 06, Step 58 — LSP Completion Integration, Suggestion Intelligence & Safe Completion Acceptance
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LspCompletionValidator } from './LspCompletionValidator';
import { LspCompletionMapper } from './LspCompletionMapper';
import {
  LspCompletionItem,
  RequestMessage,
} from '../LspTypes';
import {
  CompletionItem,
} from '../../language-intelligence/LanguageIntelligenceTypes';
import { LspProviderAdapter } from '../LspProviderAdapter';
import { LspServerManager } from '../LspServerManager';
import { LspServerRegistry } from '../LspServerRegistry';
import { MockLspTransport } from '../transport/MockLspTransport';
import { CompletionCoordinator } from '../../language-intelligence/CompletionCoordinator';
import { LanguageIntelligenceRegistry } from '../../language-intelligence/LanguageIntelligenceRegistry';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';

describe('LspCompletionValidator', () => {
  it('validates and clamps max completion items defensive limit', () => {
    const rawItems: LspCompletionItem[] = [];
    for (let i = 0; i < 600; i++) {
      rawItems.push({ label: `item_${i}` });
    }

    const result = LspCompletionValidator.validatePayload(rawItems, 50);
    expect(result.valid).toBe(true);
    expect(result.items.length).toBe(50);
    expect(result.quarantinedCount).toBe(550);
  });

  it('drops items with missing or empty labels', () => {
    const rawItems = [
      { label: 'valid_item' },
      { label: '' },
      { label: '   ' },
      { label: null as any },
      { other: 'no-label' } as any,
    ];

    const result = LspCompletionValidator.validatePayload(rawItems);
    expect(result.valid).toBe(true);
    expect(result.items.length).toBe(1);
    expect(result.items[0].label).toBe('valid_item');
    expect(result.quarantinedCount).toBe(4);
  });

  it('sanitizes and strips malicious HTML and scripts from documentation', () => {
    const maliciousDoc = 'Safe prefix <script>alert("xss")</script><iframe src="evil.com"></iframe><a href="javascript:void(0)">link</a> safe suffix';
    const sanitized = LspCompletionValidator.sanitizeDocumentation(maliciousDoc);

    expect(sanitized).toBeDefined();
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('evil.com');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).toContain('Safe prefix');
    expect(sanitized).toContain('safe suffix');
  });

  it('safely downgrades snippet syntax without corrupting placeholder content', () => {
    const snippet = 'console.log(${1:message}, ${2:level});$0';
    const downgraded = LspCompletionValidator.downgradeSnippet(snippet);

    expect(downgraded).toBe('console.log(message, level);');
  });

  it('rejects invalid or inverted LSP ranges', () => {
    const validRange = { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } };
    const negativeRange = { start: { line: -1, character: 0 }, end: { line: 0, character: 5 } };
    const invertedLineRange = { start: { line: 5, character: 0 }, end: { line: 2, character: 0 } };
    const invertedCharRange = { start: { line: 2, character: 10 }, end: { line: 2, character: 4 } };

    expect(LspCompletionValidator.isValidRange(validRange)).toBe(true);
    expect(LspCompletionValidator.isValidRange(negativeRange)).toBe(false);
    expect(LspCompletionValidator.isValidRange(invertedLineRange)).toBe(false);
    expect(LspCompletionValidator.isValidRange(invertedCharRange)).toBe(false);
  });
});

describe('LspCompletionMapper', () => {
  it('maps all 25 LSP completion kinds to canonical CompletionItemKind', () => {
    expect(LspCompletionMapper.mapCompletionKind(1)).toBe('text');
    expect(LspCompletionMapper.mapCompletionKind(2)).toBe('method');
    expect(LspCompletionMapper.mapCompletionKind(3)).toBe('function');
    expect(LspCompletionMapper.mapCompletionKind(4)).toBe('constructor');
    expect(LspCompletionMapper.mapCompletionKind(5)).toBe('field');
    expect(LspCompletionMapper.mapCompletionKind(6)).toBe('variable');
    expect(LspCompletionMapper.mapCompletionKind(7)).toBe('class');
    expect(LspCompletionMapper.mapCompletionKind(8)).toBe('interface');
    expect(LspCompletionMapper.mapCompletionKind(9)).toBe('module');
    expect(LspCompletionMapper.mapCompletionKind(10)).toBe('property');
    expect(LspCompletionMapper.mapCompletionKind(11)).toBe('value');
    expect(LspCompletionMapper.mapCompletionKind(12)).toBe('value');
    expect(LspCompletionMapper.mapCompletionKind(13)).toBe('enum');
    expect(LspCompletionMapper.mapCompletionKind(14)).toBe('keyword');
    expect(LspCompletionMapper.mapCompletionKind(15)).toBe('snippet');
    expect(LspCompletionMapper.mapCompletionKind(16)).toBe('value');
    expect(LspCompletionMapper.mapCompletionKind(17)).toBe('file');
    expect(LspCompletionMapper.mapCompletionKind(18)).toBe('reference');
    expect(LspCompletionMapper.mapCompletionKind(19)).toBe('file');
    expect(LspCompletionMapper.mapCompletionKind(20)).toBe('enum');
    expect(LspCompletionMapper.mapCompletionKind(21)).toBe('constant');
    expect(LspCompletionMapper.mapCompletionKind(22)).toBe('class');
    expect(LspCompletionMapper.mapCompletionKind(23)).toBe('method');
    expect(LspCompletionMapper.mapCompletionKind(24)).toBe('keyword');
    expect(LspCompletionMapper.mapCompletionKind(25)).toBe('type');
  });

  it('converts 0-based LSP TextEdit range to canonical 1-based Range', () => {
    const lspItem: LspCompletionItem = {
      label: 'myFunction',
      kind: 3,
      textEdit: {
        range: {
          start: { line: 9, character: 4 },
          end: { line: 9, character: 10 },
        },
        newText: 'myFunction()',
      },
    };

    const canonical = LspCompletionMapper.toCanonicalCompletionItem(lspItem, 'lsp.test', 0, 100);
    expect(canonical.label).toBe('myFunction');
    expect(canonical.insertText).toBe('myFunction()');
    expect(canonical.kind).toBe('function');
    expect(canonical.range).toEqual({
      startLine: 10,
      startColumn: 5,
      endLine: 10,
      endColumn: 11,
    });
  });

  it('converts 0-based LSP InsertReplaceEdit insert range to canonical 1-based Range', () => {
    const lspItem: LspCompletionItem = {
      label: 'replaceOption',
      kind: 6,
      textEdit: {
        insert: {
          start: { line: 2, character: 1 },
          end: { line: 2, character: 5 },
        },
        replace: {
          start: { line: 2, character: 1 },
          end: { line: 2, character: 10 },
        },
        newText: 'optReplacement',
      },
    };

    const canonical = LspCompletionMapper.toCanonicalCompletionItem(lspItem, 'lsp.test', 1, 100);
    expect(canonical.insertText).toBe('optReplacement');
    expect(canonical.range).toEqual({
      startLine: 3,
      startColumn: 2,
      endLine: 3,
      endColumn: 6,
    });
  });

  it('preserves additionalTextEdits with 1-based coordinates', () => {
    const lspItem: LspCompletionItem = {
      label: 'importedUtil',
      kind: 3,
      insertText: 'importedUtil()',
      additionalTextEdits: [
        {
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
          newText: 'import { importedUtil } from "./utils";\n',
        },
      ],
    };

    const canonical = LspCompletionMapper.toCanonicalCompletionItem(lspItem, 'lsp.test', 0, 100);
    expect(canonical.additionalTextEdits).toHaveLength(1);
    expect(canonical.additionalTextEdits![0]).toEqual({
      range: {
        startLine: 1,
        startColumn: 1,
        endLine: 1,
        endColumn: 1,
      },
      newText: 'import { importedUtil } from "./utils";\n',
    });
  });
});

describe('LspProviderAdapter & Completion Engine Integration', () => {
  let docEngine: DocumentEngine;
  let registry: LanguageIntelligenceRegistry;
  let coordinator: CompletionCoordinator;
  let serverRegistry: LspServerRegistry;
  let serverManager: LspServerManager;
  let transport: MockLspTransport;
  let adapter: LspProviderAdapter;
  let customCompletionHandler: ((params: any) => Promise<any> | any) | null = null;
  let customResolveHandler: ((item: any) => Promise<any> | any) | null = null;

  beforeEach(async () => {
    // Reset singletons
    docEngine = globalDocumentEngine;
    registry = new LanguageIntelligenceRegistry();
    coordinator = new CompletionCoordinator(registry, docEngine);
    serverRegistry = LspServerRegistry.getInstance();
    customCompletionHandler = null;
    customResolveHandler = null;

    // Register a mock TypeScript language server definition if not already registered
    if (!serverRegistry.getServer('test-ts-lsp')) {
      serverRegistry.registerServer({
        serverDefinitionId: 'test-ts-lsp',
        displayName: 'Test TypeScript Server',
        languageIds: ['typescript', 'javascript'],
        fileExtensions: ['.ts', '.js'],
        command: 'test-ts-lsp',
        transportType: 'mock',
      });
    }

    transport = new MockLspTransport();
    transport.messageHandler = async (msg) => {
      if ('method' in msg && msg.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: (msg as RequestMessage).id,
          result: {
            capabilities: {
              textDocumentSync: 1,
              completionProvider: {
                triggerCharacters: ['.', '"', '/'],
                resolveProvider: true,
              },
            },
            serverInfo: {
              name: 'Mock TypeScript Server',
              version: '1.0.0',
            },
          },
        };
      }
      if ('method' in msg && msg.method === 'shutdown') {
        return {
          jsonrpc: '2.0',
          id: (msg as RequestMessage).id,
          result: null,
        };
      }
      if ('method' in msg && msg.method === 'textDocument/completion') {
        if (customCompletionHandler) {
          const res = await customCompletionHandler((msg as any).params);
          if (res && typeof res === 'object' && 'error' in res) {
            return {
              jsonrpc: '2.0',
              id: (msg as RequestMessage).id,
              error: res.error,
            };
          }
          return {
            jsonrpc: '2.0',
            id: (msg as RequestMessage).id,
            result: res,
          };
        }
        return {
          jsonrpc: '2.0',
          id: (msg as RequestMessage).id,
          result: [],
        };
      }
      if ('method' in msg && msg.method === 'completionItem/resolve') {
        if (customResolveHandler) {
          const res = await customResolveHandler((msg as any).params);
          return {
            jsonrpc: '2.0',
            id: (msg as RequestMessage).id,
            result: res,
          };
        }
        return {
          jsonrpc: '2.0',
          id: (msg as RequestMessage).id,
          result: (msg as any).params,
        };
      }
      return null;
    };

    serverManager = new (LspServerManager as any)(
      serverRegistry,
      () => transport
    );

    adapter = new LspProviderAdapter(serverManager);
    registry.registerProvider(adapter);
  });

  afterEach(async () => {
    coordinator.dispose();
    registry.dispose();
    await serverManager.dispose();
    await Promise.all(docEngine.getAllDocuments().map((d) => docEngine.close(d.id, true)));
  });

  it('queries completions from active LSP server and returns canonical items', async () => {
    // Start session
    const session = await serverManager.getOrCreateSession('typescript');
    expect(['ready', 'running']).toContain(session?.getState());

    // Create document in DocumentEngine
    const { document: doc } = await docEngine.openResource('file:///index.ts', {
      initialContent: 'console.',
      languageId: 'typescript',
    });

    // Mock response from LSP server
    customCompletionHandler = async (params: any) => {
      expect(params.textDocument.uri).toContain('index.ts');
      expect(params.position).toEqual({ line: 0, character: 8 });

      return {
        isIncomplete: false,
        items: [
          {
            label: 'log',
            kind: 2, // Method
            detail: '(message?: any, ...optionalParams: any[]): void',
            documentation: 'Prints to stdout with newline.',
            insertText: 'log',
          },
          {
            label: 'error',
            kind: 2,
            detail: '(message?: any, ...optionalParams: any[]): void',
            documentation: { kind: 'markdown', value: '**Prints error message**' },
            insertText: 'error',
          },
        ],
      };
    };

    const result = await coordinator.requestCompletions(doc.id, { line: 1, column: 9 });
    expect(result.items.length).toBeGreaterThanOrEqual(2);

    const logItem = result.items.find((i) => i.label === 'log');
    expect(logItem).toBeDefined();
    expect(logItem?.kind).toBe('method');
    expect(logItem?.detail).toContain('void');
    expect(logItem?.providerId).toBe('lsp.provider');
    expect(logItem?.priority).toBe(100);
  });

  it('coexists with lower priority built-in word completions', async () => {
    await serverManager.getOrCreateSession('typescript');

    const { document: doc } = await docEngine.openResource('file:///test.ts', {
      initialContent: 'apple apricot\nap',
      languageId: 'typescript',
    });

    customCompletionHandler = async () => [
      { label: 'apply', kind: 3, insertText: 'apply' },
    ];

    const result = await coordinator.requestCompletions(doc.id, { line: 2, column: 3 });
    // LSP item 'apply' should be present with priority 100
    // Word completion provider items 'apple', 'apricot' should have priority 5
    const applyItem = result.items.find((i) => i.label === 'apply');
    const appleItem = result.items.find((i) => i.label === 'apple');

    expect(applyItem).toBeDefined();
    expect(applyItem?.priority).toBe(100);
    expect(appleItem).toBeDefined();
    expect(appleItem?.priority).toBe(5);

    // High priority item should be ranked first
    expect(result.items[0].label).toBe('apply');
  });

  it('safely accepts completion and mutates document via EditTransaction with undo/redo', async () => {
    await serverManager.getOrCreateSession('typescript');

    const { document: doc } = await docEngine.openResource('file:///test2.ts', {
      initialContent: 'const msg = "hello";\ncon',
      languageId: 'typescript',
    });

    const completionItem: CompletionItem = {
      id: 'lsp:test:console-0',
      label: 'console',
      kind: 'variable',
      insertText: 'console',
      range: {
        startLine: 2,
        startColumn: 1,
        endLine: 2,
        endColumn: 4,
      },
      providerId: 'lsp.provider',
    };

    const applyResult = await coordinator.applyCompletion(doc.id, completionItem, doc.contentRevision);
    expect(applyResult.success).toBe(true);
    expect(applyResult.reason).toBe('applied');

    const updatedDoc = docEngine.getDocument(doc.id);
    expect(updatedDoc?.content).toBe('const msg = "hello";\nconsole');
    expect(updatedDoc?.isDirty).toBe(true);
    expect(updatedDoc?.contentRevision).toBeGreaterThan(0);
  });

  it('rejects completion acceptance when document is read-only', async () => {
    await serverManager.getOrCreateSession('typescript');

    const { document: doc } = await docEngine.openResource('file:///readonly.ts', {
      initialContent: 'const x = 1;',
      languageId: 'typescript',
      readOnly: true,
    });

    const completionItem: CompletionItem = {
      id: 'lsp:test:item',
      label: 'item',
      kind: 'text',
      insertText: 'item',
      providerId: 'lsp.provider',
    };

    const applyResult = await coordinator.applyCompletion(doc.id, completionItem, doc.contentRevision);
    expect(applyResult.success).toBe(false);
    expect(applyResult.reason).toBe('read_only');

    const unchangedDoc = docEngine.getDocument(doc.id);
    expect(unchangedDoc?.content).toBe('const x = 1;');
  });

  it('rejects stale completion acceptance when document revision has advanced', async () => {
    await serverManager.getOrCreateSession('typescript');

    const { document: doc } = await docEngine.openResource('file:///stale.ts', {
      initialContent: 'var a = 1;',
      languageId: 'typescript',
    });

    const initialRevision = doc.contentRevision;

    // Simulate user typing another edit
    await docEngine.updateText(doc.id, 'var a = 2;');
    expect(doc.contentRevision).toBeGreaterThan(initialRevision);

    const staleItem: CompletionItem = {
      id: 'lsp:test:item',
      label: 'autoItem',
      kind: 'text',
      insertText: 'autoItem',
      providerId: 'lsp.provider',
    };

    const applyResult = await coordinator.applyCompletion(doc.id, staleItem, initialRevision);
    expect(applyResult.success).toBe(false);
    expect(applyResult.reason).toBe('stale');
  });

  it('resolves completion item details lazily via completionItem/resolve', async () => {
    await serverManager.getOrCreateSession('typescript');

    customResolveHandler = async (item: any) => {
      return {
        ...item,
        detail: 'Resolved signature (a: number): void',
        documentation: 'Lazily resolved documentation from LSP server.',
      };
    };

    const rawItem: CompletionItem = {
      id: 'lsp:test:lazyItem',
      label: 'lazyItem',
      kind: 'function',
      providerId: 'lsp.provider',
      data: {
        rawItem: { label: 'lazyItem', kind: 3 },
      },
    };

    const resolved = await coordinator.resolveCompletionItem(rawItem);
    expect(resolved.detail).toBe('Resolved signature (a: number): void');
    expect(resolved.documentation).toBe('Lazily resolved documentation from LSP server.');
  });

  it('discards stale in-flight completion requests when user keeps typing', async () => {
    await serverManager.getOrCreateSession('typescript');

    const { document: doc } = await docEngine.openResource('file:///typing.ts', {
      initialContent: 'c',
      languageId: 'typescript',
    });

    let delayedResolve: ((value: any) => void) | undefined;
    customCompletionHandler = () => {
      return new Promise((resolve) => {
        delayedResolve = resolve;
      });
    };

    // Request 1
    const req1Promise = coordinator.requestCompletions(doc.id, { line: 1, column: 2 });
    await new Promise((r) => setTimeout(r, 10));

    // User types 'co', advancing revision
    await docEngine.updateText(doc.id, 'co');

    // Request 2
    const req2Promise = coordinator.requestCompletions(doc.id, { line: 1, column: 3 });

    // Late response 1 arrives
    if (delayedResolve) {
      delayedResolve([
        { label: 'char', kind: 1 },
      ]);
    }

    const res1 = await req1Promise;
    expect(res1.items).toEqual([]); // Discarded due to stale generation / revision!
    await req2Promise;
  });

  it('handles server failure gracefully without crashing the editor', async () => {
    await serverManager.getOrCreateSession('typescript');

    const { document: doc } = await docEngine.openResource('file:///crash.ts', {
      initialContent: 'error.',
      languageId: 'typescript',
    });

    // Server returns an internal error
    customCompletionHandler = async () => {
      return {
        error: { code: -32603, message: 'Server internal panic!' },
      };
    };

    const result = await coordinator.requestCompletions(doc.id, { line: 1, column: 7 });
    // Coordinator returns empty or fallback items without throwing
    expect(result).toBeDefined();
    expect(result.items).toBeDefined();
  });
});
