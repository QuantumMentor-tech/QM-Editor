/**
 * QM Editor LSP Navigation Integration Test Suite
 * Phase 06, Step 60 — LSP Code Navigation, Definitions, Declarations, Type Definitions & References
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LspLocationValidator } from './LspLocationValidator';
import { LspLocationMapper } from './LspLocationMapper';
import { LspNavigationProvider } from './LspNavigationProvider';
import { LspNavigationCoordinator } from './LspNavigationCoordinator';
import { LspNavigationRequest, LspReferenceRequest } from './LspNavigationTypes';
import { LspLocation, LspLocationLink, RequestMessage } from '../LspTypes';
import { MockLspTransport } from '../transport/MockLspTransport';
import { LspServerRegistry } from '../LspServerRegistry';
import { LspServerManager } from '../LspServerManager';
import { NavigationCoordinator } from '../../navigation/NavigationCoordinator';
import { DocumentEngine } from '../../documents/DocumentEngine';
import { EditorCoordinationService } from '../../editor/EditorCoordinationService';
import { NavigationService } from '../../../services/NavigationService';
import { FeedbackService } from '../../feedback/FeedbackService';

describe('LspLocationValidator', () => {
  it('validates and accepts legitimate file URIs and local paths', () => {
    const res1 = LspLocationValidator.validateUri('file:///C:/project/src/index.ts');
    expect(res1.valid).toBe(true);
    expect(res1.value).toBe('file:///C:/project/src/index.ts');

    const res2 = LspLocationValidator.validateUri('C:/project/src/index.ts');
    expect(res2.valid).toBe(true);
    expect(res2.value).toBe('C:/project/src/index.ts');
  });

  it('rejects empty, null, or non-string URIs', () => {
    expect(LspLocationValidator.validateUri('').valid).toBe(false);
    expect(LspLocationValidator.validateUri('   ').valid).toBe(false);
    expect(LspLocationValidator.validateUri(null).valid).toBe(false);
    expect(LspLocationValidator.validateUri(undefined).valid).toBe(false);
    expect(LspLocationValidator.validateUri(123).valid).toBe(false);
  });

  it('blocks insecure URI schemes (javascript:, command:, shell:, data:)', () => {
    expect(LspLocationValidator.validateUri('javascript:alert(1)').valid).toBe(false);
    expect(LspLocationValidator.validateUri('command:workbench.action.reloadWindow').valid).toBe(false);
    expect(LspLocationValidator.validateUri('shell:powershell.exe').valid).toBe(false);
    expect(LspLocationValidator.validateUri('data:text/html,<script>').valid).toBe(false);
  });

  it('validates 0-based position coordinates', () => {
    const valid = LspLocationValidator.validatePosition({ line: 10, character: 5 });
    expect(valid.valid).toBe(true);
    expect(valid.value).toEqual({ line: 10, character: 5 });

    expect(LspLocationValidator.validatePosition({ line: -1, character: 0 }).valid).toBe(false);
    expect(LspLocationValidator.validatePosition({ line: 0, character: -2 }).valid).toBe(false);
    expect(LspLocationValidator.validatePosition({ line: '0', character: 1 } as any).valid).toBe(false);
    expect(LspLocationValidator.validatePosition(null).valid).toBe(false);
  });

  it('validates 0-based range and normalizes inverted bounds', () => {
    // Normal range
    const normal = LspLocationValidator.validateRange({
      start: { line: 2, character: 4 },
      end: { line: 2, character: 10 },
    });
    expect(normal.valid).toBe(true);
    expect(normal.value).toEqual({
      start: { line: 2, character: 4 },
      end: { line: 2, character: 10 },
    });

    // Inverted range: start > end gets automatically normalized
    const inverted = LspLocationValidator.validateRange({
      start: { line: 5, character: 0 },
      end: { line: 2, character: 0 },
    });
    expect(inverted.valid).toBe(true);
    expect(inverted.value?.start.line).toBe(2);
    expect(inverted.value?.end.line).toBe(5);
  });

  it('distinguishes between Location and LocationLink structures', () => {
    const loc: LspLocation = {
      uri: 'file:///path/a.ts',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
    };
    const link: LspLocationLink = {
      targetUri: 'file:///path/b.ts',
      targetRange: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
      targetSelectionRange: { start: { line: 1, character: 2 }, end: { line: 1, character: 6 } },
    };

    expect(LspLocationValidator.isLocation(loc)).toBe(true);
    expect(LspLocationValidator.isLocationLink(loc)).toBe(false);

    expect(LspLocationValidator.isLocationLink(link)).toBe(true);
    expect(LspLocationValidator.isLocation(link)).toBe(false);
  });

  it('discards malformed location items in an array while preserving valid targets', () => {
    const rawResponse = [
      {
        uri: 'file:///path/valid1.ts',
        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
      },
      {
        uri: 'javascript:alert(1)', // Malicious / blocked
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      },
      {
        uri: 'file:///path/broken.ts',
        range: { start: { line: -5, character: 0 }, end: { line: 0, character: 0 } }, // Negative line
      },
      {
        targetUri: 'file:///path/valid2.ts',
        targetRange: { start: { line: 5, character: 0 }, end: { line: 5, character: 20 } },
        targetSelectionRange: { start: { line: 5, character: 2 }, end: { line: 5, character: 8 } },
      },
    ];

    const validated = LspLocationValidator.validateNavigationResponse(rawResponse);
    expect(validated.length).toBe(2);
    expect((validated[0] as LspLocation).uri).toBe('file:///path/valid1.ts');
    expect((validated[1] as LspLocationLink).targetUri).toBe('file:///path/valid2.ts');
  });

  it('validates request context against active session state and generation', () => {
    const mockSession: any = {
      sessionId: 'session-1',
      getState: () => 'ready',
      getSessionGeneration: () => 1,
    };

    const req: LspNavigationRequest = {
      requestId: 'req-1',
      documentId: 'doc-1',
      uri: 'C:/test.ts',
      languageId: 'typescript',
      revision: 1,
      position: { line: 1, column: 1 },
      serverSessionId: 'session-1',
      serverGeneration: 1,
    };

    expect(LspLocationValidator.validateRequestContext(req, mockSession, true).valid).toBe(true);

    // Disabled setting
    expect(LspLocationValidator.validateRequestContext(req, mockSession, false).valid).toBe(false);

    // Stopped session
    const stoppedSession: any = { ...mockSession, getState: () => 'stopped' };
    expect(LspLocationValidator.validateRequestContext(req, stoppedSession, true).valid).toBe(false);

    // Generation mismatch
    const staleReq: LspNavigationRequest = { ...req, serverGeneration: 99 };
    expect(LspLocationValidator.validateRequestContext(staleReq, mockSession, true).valid).toBe(false);
  });
});

describe('LspLocationMapper', () => {
  it('converts 0-based LSP range to 1-based canonical Range', () => {
    const canonical = LspLocationMapper.mapLspRange({
      start: { line: 0, character: 4 },
      end: { line: 9, character: 20 },
    });

    expect(canonical).toEqual({
      startLine: 1,
      startColumn: 5,
      endLine: 10,
      endColumn: 21,
    });
  });

  it('maps LocationLink targetRange and targetSelectionRange', () => {
    const link: LspLocationLink = {
      targetUri: 'file:///C:/test/file.ts',
      targetRange: { start: { line: 10, character: 0 }, end: { line: 15, character: 10 } },
      targetSelectionRange: { start: { line: 10, character: 4 }, end: { line: 10, character: 8 } },
    };

    const canonical = LspLocationMapper.mapItemToLocation(link);
    expect(canonical.range).toEqual({
      startLine: 11,
      startColumn: 1,
      endLine: 16,
      endColumn: 11,
    });
    expect(canonical.selectionRange).toEqual({
      startLine: 11,
      startColumn: 5,
      endLine: 11,
      endColumn: 9,
    });
  });

  it('deduplicates identical targets with matching URI and range', () => {
    const items: LspLocation[] = [
      {
        uri: 'file:///C:/test/file.ts',
        range: { start: { line: 5, character: 2 }, end: { line: 5, character: 10 } },
      },
      {
        uri: 'file:///C:/test/file.ts',
        range: { start: { line: 5, character: 2 }, end: { line: 5, character: 10 } }, // Duplicate
      },
      {
        uri: 'file:///C:/test/file.ts',
        range: { start: { line: 20, character: 0 }, end: { line: 20, character: 5 } }, // Distinct
      },
    ];

    const canonical = LspLocationMapper.mapToCanonicalLocations(items);
    expect(canonical.length).toBe(2);
  });

  it('builds ReferenceResult grouped by resource and sorted deterministically', () => {
    const locs = [
      {
        uri: 'C:/project/b.ts',
        range: { startLine: 15, startColumn: 1, endLine: 15, endColumn: 10 },
      },
      {
        uri: 'C:/project/a.ts',
        range: { startLine: 20, startColumn: 5, endLine: 20, endColumn: 10 },
      },
      {
        uri: 'C:/project/a.ts',
        range: { startLine: 5, startColumn: 1, endLine: 5, endColumn: 10 },
      },
    ];

    const refResult = LspLocationMapper.buildReferenceResult('ref-1', locs, 42, false);
    expect(refResult.totalCount).toBe(3);
    expect(refResult.groups.length).toBe(2);
    // a.ts comes before b.ts
    expect(refResult.groups[0].displayPath).toBe('a.ts');
    expect(refResult.groups[0].locations.length).toBe(2);
    expect(refResult.groups[0].locations[0].range?.startLine).toBe(5);
    expect(refResult.groups[0].locations[1].range?.startLine).toBe(20);
    expect(refResult.groups[1].displayPath).toBe('b.ts');
  });
});

describe('LspNavigationProvider & Server Integration', () => {
  let transport: MockLspTransport;
  let registry: LspServerRegistry;
  let manager: LspServerManager;
  let provider: LspNavigationProvider;
  let customHandler: ((method: string, params: any) => any) | null = null;

  beforeEach(async () => {
    transport = new MockLspTransport();
    registry = LspServerRegistry.getInstance();
    manager = new (LspServerManager as any)(registry, () => transport);
    customHandler = null;

    if (!registry.getServer('test-ts-nav')) {
      registry.registerServer({
        serverDefinitionId: 'test-ts-nav',
        displayName: 'Test TypeScript Navigation Server',
        languageIds: ['typescript'],
        fileExtensions: ['.ts'],
        command: 'typescript-language-server',
        transportType: 'mock',
      });
    }

    // Handle initialize handshake & custom method requests
    transport.messageHandler = async (msg) => {
      if ('method' in msg && msg.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: (msg as RequestMessage).id,
          result: {
            capabilities: {
              definitionProvider: true,
              declarationProvider: true,
              typeDefinitionProvider: true,
              referencesProvider: true,
            },
            serverInfo: { name: 'Test Server', version: '1.0.0' },
          },
        };
      }
      if ('method' in msg && msg.method === 'shutdown') {
        return { jsonrpc: '2.0', id: (msg as RequestMessage).id, result: null };
      }
      if ('method' in msg && customHandler) {
        const res = customHandler((msg as RequestMessage).method, (msg as RequestMessage).params);
        return { jsonrpc: '2.0', id: (msg as RequestMessage).id, result: res };
      }
      return null;
    };

    manager.setTransportFactory(() => transport);
    const session = await manager.getOrCreateSession('typescript', '.ts', 'ws-nav', 'C:/test-ws');
    if (session) {
      await session.start();
    }

    provider = new LspNavigationProvider(manager);
  });

  afterEach(async () => {
    await manager.dispose();
  });

  it('provides single definition through textDocument/definition', async () => {
    customHandler = (method) => {
      if (method === 'textDocument/definition') {
        return {
          uri: 'file:///C:/test-ws/target.ts',
          range: { start: { line: 14, character: 4 }, end: { line: 14, character: 12 } },
        };
      }
      return null;
    };

    const req: LspNavigationRequest = {
      requestId: 'req-def-1',
      documentId: 'doc-1',
      uri: 'C:/test-ws/source.ts',
      languageId: 'typescript',
      revision: 1,
      position: { line: 5, column: 8 },
      workspaceId: 'ws-nav',
    };

    const locs = await provider.provideDefinition(req);
    expect(locs.length).toBe(1);
    expect(locs[0].uri).toContain('target.ts');
    expect(locs[0].range?.startLine).toBe(15);
    expect(locs[0].range?.startColumn).toBe(5);
  });

  it('provides declaration through textDocument/declaration', async () => {
    customHandler = (method) => {
      if (method === 'textDocument/declaration') {
        return {
          uri: 'file:///C:/test-ws/types.d.ts',
          range: { start: { line: 40, character: 2 }, end: { line: 40, character: 15 } },
        };
      }
      return null;
    };

    const req: LspNavigationRequest = {
      requestId: 'req-decl-1',
      documentId: 'doc-1',
      uri: 'C:/test-ws/source.ts',
      languageId: 'typescript',
      revision: 1,
      position: { line: 10, column: 5 },
      workspaceId: 'ws-nav',
    };

    const locs = await provider.provideDeclaration(req);
    expect(locs.length).toBe(1);
    expect(locs[0].uri).toContain('types.d.ts');
    expect(locs[0].range?.startLine).toBe(41);
  });

  it('provides type definition through textDocument/typeDefinition', async () => {
    customHandler = (method) => {
      if (method === 'textDocument/typeDefinition') {
        return {
          uri: 'file:///C:/test-ws/models.ts',
          range: { start: { line: 8, character: 0 }, end: { line: 8, character: 20 } },
        };
      }
      return null;
    };

    const req: LspNavigationRequest = {
      requestId: 'req-typedef-1',
      documentId: 'doc-1',
      uri: 'C:/test-ws/source.ts',
      languageId: 'typescript',
      revision: 1,
      position: { line: 2, column: 12 },
      workspaceId: 'ws-nav',
    };

    const locs = await provider.provideTypeDefinition(req);
    expect(locs.length).toBe(1);
    expect(locs[0].uri).toContain('models.ts');
    expect(locs[0].range?.startLine).toBe(9);
  });

  it('finds references with includeDeclaration option and groups results', async () => {
    let capturedParams: any = null;
    customHandler = (method, params) => {
      if (method === 'textDocument/references') {
        capturedParams = params;
        return [
          {
            uri: 'file:///C:/test-ws/source.ts',
            range: { start: { line: 4, character: 8 }, end: { line: 4, character: 14 } },
          },
          {
            uri: 'file:///C:/test-ws/consumer.ts',
            range: { start: { line: 12, character: 0 }, end: { line: 12, character: 6 } },
          },
        ];
      }
      return null;
    };

    const req: LspReferenceRequest = {
      requestId: 'req-refs-1',
      documentId: 'doc-1',
      uri: 'C:/test-ws/source.ts',
      languageId: 'typescript',
      revision: 1,
      position: { line: 5, column: 9 },
      workspaceId: 'ws-nav',
      includeDeclaration: true,
    };

    const result = await provider.provideReferences(req);
    expect(capturedParams?.context?.includeDeclaration).toBe(true);
    expect(result).not.toBeNull();
    expect(result?.totalCount).toBe(2);
    expect(result?.groups.length).toBe(2);
  });
});

describe('LspNavigationCoordinator & Navigation History Integration', () => {
  let docEngine: DocumentEngine;
  let editorCoord: EditorCoordinationService;
  let navService: NavigationService;
  let navCoordinator: NavigationCoordinator;
  let feedbackService: FeedbackService;
  let mockProvider: any;
  let coordinator: LspNavigationCoordinator;

  beforeEach(() => {
    docEngine = new DocumentEngine();
    editorCoord = new EditorCoordinationService();
    navService = new NavigationService();
    navCoordinator = new NavigationCoordinator(docEngine, editorCoord, navService);
    feedbackService = new FeedbackService();

    mockProvider = {
      provideDefinition: vi.fn(),
      provideDeclaration: vi.fn(),
      provideTypeDefinition: vi.fn(),
      provideReferences: vi.fn(),
    };

    coordinator = new LspNavigationCoordinator(mockProvider, navCoordinator, feedbackService);
  });

  it('navigates directly and records navigation history when single definition returned', async () => {
    // Prime initial origin location in navigation history
    navService.pushLocation({
      documentId: 'doc-source',
      filePath: 'C:/test-ws/source.ts',
      documentTitle: 'source.ts',
      line: 5,
      column: 10,
    });

    // Set up a mock document opener
    let openedUri: string | null = null;
    navCoordinator.registerDocumentOpener({
      openDocument: async (uri: string) => {
        openedUri = uri;
        return 'doc-target-1';
      },
      activateDocument: vi.fn(),
    });

    mockProvider.provideDefinition.mockResolvedValue([
      {
        uri: 'C:/test-ws/target.ts',
        range: { startLine: 25, startColumn: 4, endLine: 25, endColumn: 12 },
      },
    ]);

    const success = await coordinator.goToDefinition(
      'doc-source',
      { line: 5, column: 10 },
      'C:/test-ws/source.ts',
      'typescript',
      1
    );

    expect(success).toBe(true);
    expect(openedUri).toBe('C:/test-ws/target.ts');

    // Verify navigation history recorded
    expect(navCoordinator.canNavigateBack()).toBe(true);
    const backResult = await navCoordinator.navigateBack();
    expect(backResult).not.toBeNull();
  });

  it('dispatches qm:navigation:multiple-targets event when multiple definitions exist', async () => {
    const multiEventSpy = vi.fn();
    window.addEventListener('qm:navigation:multiple-targets', multiEventSpy);

    mockProvider.provideDefinition.mockResolvedValue([
      { uri: 'C:/test-ws/target1.ts', range: { startLine: 10, startColumn: 1, endLine: 10, endColumn: 5 } },
      { uri: 'C:/test-ws/target2.ts', range: { startLine: 30, startColumn: 1, endLine: 30, endColumn: 5 } },
    ]);

    const result = await coordinator.goToDefinition(
      'doc-source',
      { line: 1, column: 1 },
      'C:/test-ws/source.ts',
      'typescript',
      1
    );

    expect(result).toBe(true);
    expect(multiEventSpy).toHaveBeenCalledTimes(1);

    window.removeEventListener('qm:navigation:multiple-targets', multiEventSpy);
  });

  it('dispatches qm:navigation:references event when references exist', async () => {
    const refsEventSpy = vi.fn();
    window.addEventListener('qm:navigation:references', refsEventSpy);

    mockProvider.provideReferences.mockResolvedValue({
      requestId: 'refs-1',
      locations: [
        { uri: 'C:/test-ws/target.ts', range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 } },
      ],
      totalCount: 1,
      groups: [
        {
          uri: 'C:/test-ws/target.ts',
          displayPath: 'target.ts',
          locations: [{ uri: 'C:/test-ws/target.ts', range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 } }],
        },
      ],
    });

    const refRes = await coordinator.findReferences(
      'doc-source',
      { line: 1, column: 1 },
      'C:/test-ws/source.ts',
      'typescript',
      1
    );

    expect(refRes?.totalCount).toBe(1);
    expect(refsEventSpy).toHaveBeenCalledTimes(1);

    window.removeEventListener('qm:navigation:references', refsEventSpy);
  });

  it('displays controlled notification when no definitions are found', async () => {
    mockProvider.provideDefinition.mockResolvedValue([]);
    const showSpy = vi.spyOn(feedbackService, 'show');

    const success = await coordinator.goToDefinition(
      'doc-source',
      { line: 1, column: 1 },
      'C:/test-ws/source.ts',
      'typescript',
      1
    );

    expect(success).toBe(false);
    expect(showSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'info',
        message: 'No definition found.',
      })
    );
  });
});
