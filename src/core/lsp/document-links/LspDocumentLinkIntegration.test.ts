/**
 * QM Editor - LSP Document Link Integration Test Suite
 * Phase 06, Step 67 — LSP Document Links, Clickable Resource References & Safe URI Navigation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LspDocumentLinkProvider } from './LspDocumentLinkProvider';
import { LspDocumentLinkCoordinator } from './LspDocumentLinkCoordinator';
import { MockLspTransport } from '../transport/MockLspTransport';
import { LspServerRegistry } from '../LspServerRegistry';
import { LspServerManager } from '../LspServerManager';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { DocumentRecord } from '../../documents/DocumentTypes';
import { WorkspaceEngine, globalWorkspaceEngine } from '../../workspace/WorkspaceEngine';
import { SettingsService } from '../../settings/SettingsService';
import { RequestMessage, LspDocumentLink } from '../LspTypes';
import { NavigationCoordinator } from '../../navigation/NavigationCoordinator';
import { FeedbackService } from '../../feedback/FeedbackService';

describe('LspDocumentLink Subsystem Integration', () => {
  let docEngine: DocumentEngine;
  let workspaceEngine: WorkspaceEngine;
  let serverManager: LspServerManager;
  let mockTransport: MockLspTransport;
  let linkProvider: LspDocumentLinkProvider;
  let linkCoordinator: LspDocumentLinkCoordinator;
  let navigationCoordinator: NavigationCoordinator;
  let feedbackService: FeedbackService;
  let customHandler: ((method: string, params: any) => any | Promise<any>) | null = null;

  const testUri = 'file:///C:/project/src/index.ts';
  const initialCode = 'import "./config.json";\n// See #L10 for details\nconst url = "https://example.com";\n';

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
              documentLinkProvider: {
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

    navigationCoordinator = new (NavigationCoordinator as any)(docEngine);
    feedbackService = new FeedbackService();

    linkProvider = new LspDocumentLinkProvider(
      serverManager,
      SettingsService.getInstance(),
      workspaceEngine,
      docEngine
    );

    linkCoordinator = new LspDocumentLinkCoordinator(
      linkProvider,
      docEngine,
      workspaceEngine,
      SettingsService.getInstance(),
      navigationCoordinator,
      feedbackService
    );
  });

  afterEach(async () => {
    linkCoordinator.dispose();
    linkProvider.dispose();
    await serverManager.dispose();
    for (const d of docEngine.getAllDocuments()) {
      await docEngine.close(d.id, true);
    }
  });

  it('requests and maps document links from language server', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    const sampleLinks: LspDocumentLink[] = [
      {
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 22 },
        },
        target: 'file:///C:/project/src/config.json',
        tooltip: 'Open configuration',
      },
      {
        range: {
          start: { line: 2, character: 12 },
          end: { line: 2, character: 33 },
        },
        target: 'https://example.com',
      },
    ];

    customHandler = (method, params) => {
      if (method === 'textDocument/documentLink') {
        expect(params.textDocument.uri).toContain('index.ts');
        return sampleLinks;
      }
      return null;
    };

    const result = await linkProvider.requestDocumentLinks(testUri);
    expect(result).not.toBeNull();
    expect(result?.links).toHaveLength(2);
    expect(result?.decorations).toHaveLength(2);

    const link0 = result!.links[0];
    expect(link0.target).toBe('file:///C:/project/src/config.json');
    expect(link0.tooltip).toBe('Open configuration');
    expect(link0.classification).toBe('workspace-local');

    const link1 = result!.links[1];
    expect(link1.classification).toBe('external-web');
  });

  it('resolves unresolved document links lazily via documentLink/resolve', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    const unresolvedLinks: LspDocumentLink[] = [
      {
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 22 },
        },
        data: { fileRef: 'config.json' },
      },
    ];

    customHandler = (method, params) => {
      if (method === 'textDocument/documentLink') {
        return unresolvedLinks;
      }
      if (method === 'documentLink/resolve') {
        expect(params.data).toEqual({ fileRef: 'config.json' });
        return {
          ...params,
          target: 'file:///C:/project/src/config.json',
          tooltip: 'Resolved Config',
        };
      }
      return null;
    };

    const result = await linkProvider.requestDocumentLinks(testUri);
    expect(result).not.toBeNull();
    const link = result!.links[0];
    expect(link.isResolved).toBe(false);
    expect(link.target).toBeUndefined();

    // Now resolve it
    const resolved = await linkProvider.resolveDocumentLink(link);
    expect(resolved.isResolved).toBe(true);
    expect(resolved.target).toBe('file:///C:/project/src/config.json');
    expect(resolved.tooltip).toBe('Resolved Config');
  });

  it('executes same-document fragment navigation on activation', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    const navigateSpy = vi.spyOn(navigationCoordinator, 'navigateToLocation').mockResolvedValue({
      success: true,
      location: { uri: testUri },
    });

    customHandler = (method) => {
      if (method === 'textDocument/documentLink') {
        return [
          {
            range: {
              start: { line: 1, character: 7 },
              end: { line: 1, character: 11 },
            },
            target: '#L10',
          },
        ];
      }
      return null;
    };

    linkCoordinator.requestDocumentLinks(testUri, true);
    await new Promise((r) => setTimeout(r, 60));

    const decos = linkCoordinator.getDecorations(testUri);
    expect(decos).toHaveLength(1);
    const linkId = decos[0].id;

    const success = await linkCoordinator.executeLink(linkId);
    expect(success).toBe(true);
    expect(navigateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: testUri,
        range: {
          startLine: 10,
          startColumn: 1,
          endLine: 10,
          endColumn: 1,
        },
      })
    );
  });

  it('navigates to local workspace resource on activation', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    const navigateSpy = vi.spyOn(navigationCoordinator, 'navigateToLocation').mockResolvedValue({
      success: true,
      location: { uri: 'file:///C:/project/src/config.json' },
    });

    customHandler = (method) => {
      if (method === 'textDocument/documentLink') {
        return [
          {
            range: {
              start: { line: 0, character: 7 },
              end: { line: 0, character: 22 },
            },
            target: 'file:///C:/project/src/config.json',
          },
        ];
      }
      return null;
    };

    linkCoordinator.requestDocumentLinks(testUri, true);
    await new Promise((r) => setTimeout(r, 60));

    const decos = linkCoordinator.getDecorations(testUri);
    const linkId = decos[0].id;

    const success = await linkCoordinator.executeLink(linkId);
    expect(success).toBe(true);
    expect(navigateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: expect.stringContaining('config.json'),
      })
    );
  });

  it('safely opens external web link when allowed', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    const openSpy = vi.fn();
    (global as any).window = { open: openSpy };

    customHandler = (method) => {
      if (method === 'textDocument/documentLink') {
        return [
          {
            range: {
              start: { line: 2, character: 12 },
              end: { line: 2, character: 33 },
            },
            target: 'https://example.com/api',
          },
        ];
      }
      return null;
    };

    linkCoordinator.requestDocumentLinks(testUri, true);
    await new Promise((r) => setTimeout(r, 60));

    const decos = linkCoordinator.getDecorations(testUri);
    const linkId = decos[0].id;

    const success = await linkCoordinator.executeLink(linkId);
    expect(success).toBe(true);
    expect(openSpy).toHaveBeenCalledWith('https://example.com/api', '_blank', 'noopener,noreferrer');
  });

  it('blocks dangerous javascript: schemes without execution', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    const feedbackSpy = vi.spyOn(feedbackService, 'show');

    customHandler = (method) => {
      if (method === 'textDocument/documentLink') {
        return [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 10 },
            },
            target: 'javascript:alert("PWNED")',
          },
        ];
      }
      return null;
    };

    linkCoordinator.requestDocumentLinks(testUri, true);
    await new Promise((r) => setTimeout(r, 60));

    const decos = linkCoordinator.getDecorations(testUri);
    expect(decos).toHaveLength(1);
    const linkId = decos[0].id;

    const success = await linkCoordinator.executeLink(linkId);
    expect(success).toBe(false);
    expect(feedbackSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warning',
        message: expect.stringContaining('Blocked unsafe link'),
      })
    );
  });

  it('rejects stale responses when document revision changes during request', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = async (method) => {
      if (method === 'textDocument/documentLink') {
        await new Promise((r) => setTimeout(r, 60));
        return [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 5 },
            },
            target: 'https://example.com',
          },
        ];
      }
      return null;
    };

    const requestPromise = linkProvider.requestDocumentLinks(testUri);

    // Rapid edit occurs while request is in flight
    docEngine.updateText(doc.id, 'const modified = true;\n', 'user');

    const result = await requestPromise;
    expect(result).toBeNull();
  });

  it('cleans up links and cache when document is closed', async () => {
    const doc = await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/documentLink') {
        return [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 5 },
            },
            target: 'https://example.com',
          },
        ];
      }
      return null;
    };

    linkCoordinator.requestDocumentLinks(testUri, true);
    await new Promise((r) => setTimeout(r, 60));
    expect(linkCoordinator.getDecorations(testUri).length).toBeGreaterThan(0);

    // Close document
    await docEngine.close(doc.id, true);

    expect(linkCoordinator.getDecorations(testUri)).toHaveLength(0);
    expect(linkProvider.getCache(testUri)).toBeUndefined();
  });

  it('respects lsp.documentLinks.enabled setting when disabled', async () => {
    const settings = SettingsService.getInstance();
    settings.set('lsp.documentLinks.enabled', false);

    await openDoc(testUri, initialCode, 'typescript');

    let requestCount = 0;
    customHandler = (method) => {
      if (method === 'textDocument/documentLink') {
        requestCount++;
        return [];
      }
      return null;
    };

    const result = await linkProvider.requestDocumentLinks(testUri);
    expect(result).toBeNull();
    expect(requestCount).toBe(0);

    // Reset setting
    settings.reset('lsp.documentLinks.enabled');
  });

  it('handles empty server response cleanly', async () => {
    await openDoc(testUri, initialCode, 'typescript');

    customHandler = (method) => {
      if (method === 'textDocument/documentLink') {
        return [];
      }
      return null;
    };

    const result = await linkProvider.requestDocumentLinks(testUri);
    expect(result).not.toBeNull();
    expect(result?.links).toEqual([]);
    expect(result?.decorations).toEqual([]);
  });
});
