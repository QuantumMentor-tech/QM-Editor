/**
 * QM Editor LSP Contextual Intelligence Test Suite
 * Phase 06, Step 59 — LSP Hover, Signature Help & Contextual Documentation Integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LspContextValidator } from './LspContextValidator';
import { LspContextMapper } from './LspContextMapper';
import {
  LspHover,
  LspSignatureHelp,
  RequestMessage,
} from '../LspTypes';
import {
  HoverRequest,
  SignatureHelpRequest,
} from '../../language-intelligence/LanguageIntelligenceTypes';
import { LspProviderAdapter } from '../LspProviderAdapter';
import { LspServerManager } from '../LspServerManager';
import { LspServerRegistry } from '../LspServerRegistry';
import { MockLspTransport } from '../transport/MockLspTransport';
import { HoverCoordinator } from '../../language-intelligence/HoverCoordinator';
import { SignatureHelpCoordinator } from '../../language-intelligence/SignatureHelpCoordinator';
import { LanguageIntelligenceRegistry } from '../../language-intelligence/LanguageIntelligenceRegistry';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { settingsService } from '../../settings/SettingsService';

describe('LspContextValidator', () => {
  it('sanitizes untrusted documentation text and strips dangerous tags and javascript URIs', () => {
    const maliciousDoc =
      'Safe text <script>alert("hack")</script><iframe src="evil.com"></iframe> ' +
      '[link](javascript:stealData()) <button onclick="run()">Click</button>';

    const clean = LspContextValidator.sanitizeDocumentationText(maliciousDoc);
    expect(clean).toBeDefined();
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('<iframe>');
    expect(clean).not.toContain('<button');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('Safe text');
    expect(clean).toContain('#blocked-uri');
  });

  it('clamps oversized documentation text', () => {
    const hugeDoc = 'A'.repeat(LspContextValidator.MAX_DOC_LENGTH + 500);
    const clean = LspContextValidator.sanitizeDocumentationText(hugeDoc);
    expect(clean).toBeDefined();
    expect(clean?.length).toBeLessThan(LspContextValidator.MAX_DOC_LENGTH + 100);
    expect(clean).toContain('*(documentation truncated)*');
  });

  it('validates hover with plaintext and markdown MarkupContent', () => {
    const rawPlaintext: LspHover = {
      contents: { kind: 'plaintext', value: 'Simple documentation' },
    };
    const valid1 = LspContextValidator.validateHoverResponse(rawPlaintext);
    expect(valid1).not.toBeNull();
    expect(valid1?.contents).toEqual({ kind: 'plaintext', value: 'Simple documentation' });

    const rawMarkdown: LspHover = {
      contents: { kind: 'markdown', value: '### Function Info\n`const x = 1;`' },
      range: {
        start: { line: 2, character: 5 },
        end: { line: 2, character: 15 },
      },
    };
    const valid2 = LspContextValidator.validateHoverResponse(rawMarkdown);
    expect(valid2).not.toBeNull();
    expect(valid2?.range).toEqual({
      start: { line: 2, character: 5 },
      end: { line: 2, character: 15 },
    });
  });

  it('normalizes inverted hover ranges safely', () => {
    const rawInverted: LspHover = {
      contents: 'Inverted range test',
      range: {
        start: { line: 5, character: 10 },
        end: { line: 3, character: 2 },
      },
    };
    const valid = LspContextValidator.validateHoverResponse(rawInverted);
    expect(valid?.range).toEqual({
      start: { line: 3, character: 2 },
      end: { line: 5, character: 10 },
    });
  });

  it('validates and clamps signature help responses with active parameter fallback', () => {
    const rawSig: LspSignatureHelp = {
      signatures: [
        {
          label: 'calculate(x: number, y: string): void',
          documentation: { kind: 'markdown', value: 'Calculates the result.' },
          parameters: [
            { label: 'x: number', documentation: 'First operand' },
            { label: [20, 29], documentation: 'Second operand' },
          ],
        },
      ],
      activeSignature: 99, // Out of bounds -> fallback to 0
      activeParameter: 5,  // Out of bounds -> fallback to max param index (1)
    };

    const valid = LspContextValidator.validateSignatureHelpResponse(rawSig);
    expect(valid).not.toBeNull();
    expect(valid?.activeSignature).toBe(0);
    expect(valid?.activeParameter).toBe(1);
    expect(valid?.signatures[0].parameters?.[1].label).toEqual([20, 29]);
  });

  it('returns null for empty or invalid signature help payloads', () => {
    expect(LspContextValidator.validateSignatureHelpResponse(null)).toBeNull();
    expect(LspContextValidator.validateSignatureHelpResponse({})).toBeNull();
    expect(LspContextValidator.validateSignatureHelpResponse({ signatures: [] })).toBeNull();
  });
});

describe('LspContextMapper', () => {
  it('translates 0-based LSP hover range into 1-based canonical Range', () => {
    const hover: LspHover = {
      contents: 'Hover symbol info',
      range: {
        start: { line: 0, character: 4 },
        end: { line: 0, character: 12 },
      },
    };
    const req: HoverRequest = {
      requestId: 'req-1',
      documentId: 'doc-1',
      uri: 'file:///main.ts',
      languageId: 'typescript',
      revision: 1,
      position: { line: 1, column: 5 },
      offset: 4,
    };

    const canonical = LspContextMapper.mapLspHover(hover, req, 'lsp.test');
    expect(canonical.providerId).toBe('lsp.test');
    expect(canonical.revision).toBe(1);
    expect(canonical.range).toEqual({
      startLine: 1,
      startColumn: 5,
      endLine: 1,
      endColumn: 13,
    });
    expect(canonical.contents).toHaveLength(1);
  });

  it('translates LSP signature help into canonical SignatureHelpResult', () => {
    const sigHelp: LspSignatureHelp = {
      signatures: [
        {
          label: 'greet(name: string): string',
          documentation: 'Returns greeting',
          parameters: [{ label: 'name: string' }],
        },
      ],
      activeSignature: 0,
      activeParameter: 0,
    };
    const req: SignatureHelpRequest = {
      requestId: 'sig-1',
      documentId: 'doc-1',
      uri: 'file:///main.ts',
      languageId: 'typescript',
      revision: 2,
      position: { line: 1, column: 7 },
      offset: 6,
      triggerKind: 'invoked',
    };

    const canonical = LspContextMapper.mapLspSignatureHelp(sigHelp, req, 'lsp.test');
    expect(canonical.providerId).toBe('lsp.test');
    expect(canonical.signatures).toHaveLength(1);
    expect(canonical.signatures[0].label).toBe('greet(name: string): string');
    expect(canonical.activeSignature).toBe(0);
    expect(canonical.activeParameter).toBe(0);
  });
});

describe('LspProviderAdapter Contextual Intelligence Integration', () => {
  let docEngine: DocumentEngine;
  let registry: LanguageIntelligenceRegistry;
  let hoverCoordinator: HoverCoordinator;
  let signatureCoordinator: SignatureHelpCoordinator;
  let serverRegistry: LspServerRegistry;
  let serverManager: LspServerManager;
  let transport: MockLspTransport;
  let adapter: LspProviderAdapter;

  let customHoverHandler: ((params: any) => Promise<any> | any) | null = null;
  let customSigHandler: ((params: any) => Promise<any> | any) | null = null;

  beforeEach(async () => {
    docEngine = globalDocumentEngine;
    registry = new LanguageIntelligenceRegistry();
    hoverCoordinator = new HoverCoordinator(registry, docEngine);
    signatureCoordinator = new SignatureHelpCoordinator(registry, docEngine);
    serverRegistry = LspServerRegistry.getInstance();
    customHoverHandler = null;
    customSigHandler = null;

    if (!serverRegistry.getServer('test-context-lsp')) {
      serverRegistry.registerServer({
        serverDefinitionId: 'test-context-lsp',
        displayName: 'Test Context LSP Server',
        languageIds: ['typescript', 'javascript'],
        fileExtensions: ['.ts', '.js'],
        command: 'test-context-lsp',
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
              hoverProvider: true,
              signatureHelpProvider: {
                triggerCharacters: ['(', ','],
                retriggerCharacters: [','],
              },
            },
            serverInfo: { name: 'Test Context Mock Server', version: '1.0.0' },
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

      if ('method' in msg && msg.method === 'textDocument/hover') {
        if (customHoverHandler) {
          const res = await customHoverHandler((msg as any).params);
          if (res && res.error) {
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
          result: {
            contents: { kind: 'markdown', value: '### Type Info\n`const version: string`' },
            range: {
              start: { line: 0, character: 6 },
              end: { line: 0, character: 13 },
            },
          },
        };
      }

      if ('method' in msg && msg.method === 'textDocument/signatureHelp') {
        if (customSigHandler) {
          const res = await customSigHandler((msg as any).params);
          if (res && res.error) {
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
          result: {
            signatures: [
              {
                label: 'readFile(path: string, encoding?: string): Promise<string>',
                documentation: 'Reads file contents asynchronously.',
                parameters: [
                  { label: 'path: string', documentation: 'File path' },
                  { label: 'encoding?: string', documentation: 'Character encoding' },
                ],
              },
            ],
            activeSignature: 0,
            activeParameter: 1,
          },
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
    hoverCoordinator.dispose();
    signatureCoordinator.dispose();
    registry.dispose();
    await serverManager.dispose();
    await Promise.all(docEngine.getAllDocuments().map((d) => docEngine.close(d.id, true)));
  });

  it('queries hover documentation through HoverCoordinator and receives canonical result', async () => {
    await serverManager.getOrCreateSession('typescript');

    const { document: doc } = await docEngine.openResource('file:///main.ts', {
      initialContent: 'const version = "1.0.0";',
      languageId: 'typescript',
    });

    const hoverResult = await hoverCoordinator.requestHover(doc.id, { line: 1, column: 7 });
    expect(hoverResult).not.toBeNull();
    expect(hoverResult?.providerId).toBe(adapter.providerId);
    expect(hoverResult?.contents).toHaveLength(1);
    expect(hoverResult?.range).toEqual({
      startLine: 1,
      startColumn: 7,
      endLine: 1,
      endColumn: 14,
    });
  });

  it('queries signature help through SignatureHelpCoordinator and receives canonical result', async () => {
    await serverManager.getOrCreateSession('typescript');

    const { document: doc } = await docEngine.openResource('file:///app.ts', {
      initialContent: 'readFile("config.json", )',
      languageId: 'typescript',
    });

    const sigResult = await signatureCoordinator.requestSignatureHelp(doc.id, { line: 1, column: 24 }, {
      triggerKind: 'triggerCharacter',
      triggerCharacter: ',',
    });

    expect(sigResult).not.toBeNull();
    expect(sigResult?.providerId).toBe(adapter.providerId);
    expect(sigResult?.signatures).toHaveLength(1);
    expect(sigResult?.signatures[0].label).toContain('readFile');
    expect(sigResult?.signatures[0].parameters).toHaveLength(2);
    expect(sigResult?.activeParameter).toBe(1);
  });

  it('rejects stale hover responses when document revision advances before response arrives', async () => {
    await serverManager.getOrCreateSession('typescript');

    const { document: doc } = await docEngine.openResource('file:///stale.ts', {
      initialContent: 'let count = 0;',
      languageId: 'typescript',
    });

    let delayedResolve: ((val: any) => void) | undefined;
    customHoverHandler = () => {
      return new Promise((resolve) => {
        delayedResolve = resolve;
      });
    };

    // Request 1
    const hoverPromise = hoverCoordinator.requestHover(doc.id, { line: 1, column: 5 });

    // Document advances revision before response arrives
    await docEngine.updateText(doc.id, 'let count = 1;');

    if (delayedResolve) {
      delayedResolve({
        contents: 'count: number',
      });
    }

    const result = await hoverPromise;
    expect(result).toBeNull(); // Discarded due to stale revision!
  });

  it('handles server errors gracefully without throwing', async () => {
    await serverManager.getOrCreateSession('typescript');

    const { document: doc } = await docEngine.openResource('file:///error.ts', {
      initialContent: 'errorSymbol',
      languageId: 'typescript',
    });

    customHoverHandler = () => {
      return {
        error: { code: -32603, message: 'Server internal panic!' },
      };
    };

    const result = await hoverCoordinator.requestHover(doc.id, { line: 1, column: 2 });
    expect(result).toBeNull();
  });

  it('respects lsp.hover.enabled and lsp.signatureHelp.enabled user settings', async () => {
    await serverManager.getOrCreateSession('typescript');

    const { document: doc } = await docEngine.openResource('file:///settings.ts', {
      initialContent: 'foo();',
      languageId: 'typescript',
    });

    // Disable hover
    await settingsService.set('lsp.hover.enabled', false);
    const hoverRes = await hoverCoordinator.requestHover(doc.id, { line: 1, column: 2 });
    expect(hoverRes).toBeNull();

    // Re-enable hover
    await settingsService.set('lsp.hover.enabled', true);
    const hoverRes2 = await hoverCoordinator.requestHover(doc.id, { line: 1, column: 2 });
    expect(hoverRes2).not.toBeNull();

    // Disable signature help
    await settingsService.set('lsp.signatureHelp.enabled', false);
    const sigRes = await signatureCoordinator.requestSignatureHelp(doc.id, { line: 1, column: 5 });
    expect(sigRes).toBeNull();

    // Re-enable signature help
    await settingsService.set('lsp.signatureHelp.enabled', true);
    const sigRes2 = await signatureCoordinator.requestSignatureHelp(doc.id, { line: 1, column: 5 });
    expect(sigRes2).not.toBeNull();
  });
});
