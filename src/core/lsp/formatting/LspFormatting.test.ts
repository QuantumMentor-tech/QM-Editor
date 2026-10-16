/**
 * QM Editor LSP Formatting Test Suite
 * Phase 06, Step 63 — LSP Document Formatting, Range Formatting & Safe Formatting Edit Integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LspFormattingValidator } from './LspFormattingValidator';
import { LspFormattingMapper } from './LspFormattingMapper';
import { LspFormattingProvider } from './LspFormattingProvider';
import { LspFormattingCoordinator } from './LspFormattingCoordinator';
import { LspTextEdit, RequestMessage, LspFormattingResponse } from '../LspTypes';
import { MockLspTransport } from '../transport/MockLspTransport';
import { LspServerRegistry } from '../LspServerRegistry';
import { LspServerManager } from '../LspServerManager';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { EditorCoordinationService, globalEditorCoordinationService } from '../../editor/EditorCoordinationService';
import { globalWorkspaceEngine } from '../../workspace';
import { SettingsService } from '../../settings/SettingsService';
import { CancellationTokenSource } from '../../symbols/CancellationToken';

describe('LspFormattingValidator', () => {
  const sampleDoc = 'function test() {\n  const x = 1;\n  return x;\n}\n';

  it('validates canonical 1-based range correctly', () => {
    // Valid ranges
    expect(
      LspFormattingValidator.validateCanonicalRange(
        { startLine: 1, startColumn: 1, endLine: 2, endColumn: 5 },
        sampleDoc
      ).valid
    ).toBe(true);

    // Negative or 0 coordinates
    expect(
      LspFormattingValidator.validateCanonicalRange(
        { startLine: 0, startColumn: 1, endLine: 2, endColumn: 5 },
        sampleDoc
      ).valid
    ).toBe(false);

    // Inverted coordinates
    expect(
      LspFormattingValidator.validateCanonicalRange(
        { startLine: 3, startColumn: 5, endLine: 2, endColumn: 1 },
        sampleDoc
      ).valid
    ).toBe(false);
  });

  it('handles null, undefined, and empty formatting responses as no_changes', () => {
    expect(LspFormattingValidator.validateFormattingResponse(null, sampleDoc)).toEqual({
      valid: true,
      status: 'no_changes',
      value: [],
    });

    expect(LspFormattingValidator.validateFormattingResponse(undefined as unknown as LspFormattingResponse, sampleDoc)).toEqual({
      valid: true,
      status: 'no_changes',
      value: [],
    });

    expect(LspFormattingValidator.validateFormattingResponse([], sampleDoc)).toEqual({
      valid: true,
      status: 'no_changes',
      value: [],
    });
  });

  it('rejects invalid structures and inverted ranges', () => {
    // Non-array
    expect(
      LspFormattingValidator.validateFormattingResponse({} as any, sampleDoc).valid
    ).toBe(false);

    // Inverted edit range
    const inverted: LspTextEdit[] = [
      {
        range: { start: { line: 2, character: 5 }, end: { line: 1, character: 2 } },
        newText: 'foo',
      },
    ];
    expect(LspFormattingValidator.validateFormattingResponse(inverted, sampleDoc).valid).toBe(false);
  });

  it('detects and rejects overlapping edits strictly', () => {
    const overlapping: LspTextEdit[] = [
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
        newText: 'let',
      },
      {
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 15 } },
        newText: 'y',
      },
    ];

    const res = LspFormattingValidator.validateFormattingResponse(overlapping, sampleDoc);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('overlapping_edits');
    expect(res.error).toContain('overlapping edits');
  });

  it('accepts valid non-overlapping edits', () => {
    const validEdits: LspTextEdit[] = [
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 8 } },
        newText: 'const',
      },
      {
        range: { start: { line: 1, character: 2 }, end: { line: 1, character: 7 } },
        newText: 'let y',
      },
    ];

    const res = LspFormattingValidator.validateFormattingResponse(validEdits, sampleDoc);
    expect(res.valid).toBe(true);
    expect(res.status).toBe('valid');
    expect(res.value?.length).toBe(2);
  });

  it('rejects payloads exceeding maximum edit count or total byte limits', () => {
    const hugeEdits: LspTextEdit[] = [];
    for (let i = 0; i < 5001; i++) {
      hugeEdits.push({
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        newText: '',
      });
    }

    const res = LspFormattingValidator.validateFormattingResponse(hugeEdits, sampleDoc);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('payload_too_large');
  });
});

describe('LspFormattingMapper', () => {
  it('resolves formatting options from settings service with overrides', () => {
    const options = LspFormattingMapper.resolveFormattingOptions({
      tabSize: 4,
      insertSpaces: false,
    });

    expect(options.tabSize).toBe(4);
    expect(options.insertSpaces).toBe(false);
    expect(options.trimTrailingWhitespace).toBe(false);
  });

  it('maps canonical 1-based Range to 0-based LSP Range', () => {
    const lspRange = LspFormattingMapper.mapToLspRange({
      startLine: 1,
      startColumn: 1,
      endLine: 5,
      endColumn: 12,
    });

    expect(lspRange.start.line).toBe(0);
    expect(lspRange.start.character).toBe(0);
    expect(lspRange.end.line).toBe(4);
    expect(lspRange.end.character).toBe(11);
  });

  it('maps LSP edits directly into SingleTextEdits in ascending offset order', () => {
    const content = 'line1\nline2\nline3\n';
    const lspEdits: LspTextEdit[] = [
      {
        range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } },
        newText: 'LINE3',
      },
      {
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
        newText: 'LINE1',
      },
    ];

    const txEdits = LspFormattingMapper.mapToTransactionEdits(lspEdits, content);
    expect(txEdits.length).toBe(2);
    // Should be sorted ascending by offset
    expect(txEdits[0].from).toBeLessThan(txEdits[1].from);
    expect(txEdits[0].insertText).toBe('LINE1');
    expect(txEdits[1].insertText).toBe('LINE3');
  });
});

describe('LspFormattingProvider & LspFormattingCoordinator Integration', () => {
  let docEngine: DocumentEngine;
  let editorCoordination: EditorCoordinationService;
  let serverManager: LspServerManager;
  let mockTransport: MockLspTransport;
  let formattingProvider: LspFormattingProvider;
  let formattingCoordinator: LspFormattingCoordinator;
  let customHandler: ((method: string, params: any) => any) | null = null;

  const testFilePath = 'C:/project/src/index.ts';
  const initialCode = 'function   badIndent()  {\nreturn 42;\n}';

  beforeEach(async () => {
    docEngine = globalDocumentEngine;
    for (const d of docEngine.getAllDocuments()) {
      await docEngine.close(d.id, true);
    }
    editorCoordination = globalEditorCoordinationService;
    mockTransport = new MockLspTransport();
    customHandler = null;

    mockTransport.messageHandler = (msg) => {
      const req = msg as RequestMessage;
      if (req.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            capabilities: {
              documentFormattingProvider: true,
              documentRangeFormattingProvider: true,
            },
          },
        };
      }
      if (req.method === 'shutdown') {
        return { jsonrpc: '2.0', id: req.id, result: null };
      }
      if (customHandler) {
        const res = customHandler(req.method, req.params);
        if (res !== undefined) {
          return { jsonrpc: '2.0', id: req.id, result: res };
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

    formattingProvider = new LspFormattingProvider(serverManager, docEngine);
    formattingCoordinator = new LspFormattingCoordinator(
      formattingProvider,
      editorCoordination,
      docEngine
    );
  });

  afterEach(async () => {
    formattingCoordinator.dispose();
    await serverManager.dispose();
    for (const d of docEngine.getAllDocuments()) {
      await docEngine.close(d.id, true);
    }
    SettingsService.getInstance().set('lsp.formatting.enabled', true);
  });

  it('formats entire document through Edit Transaction when server returns edits', async () => {
    const { document: doc } = await docEngine.openResource(testFilePath, {
      initialContent: initialCode,
      languageId: 'typescript',
    });

    const initialRevision = doc.contentRevision;

    customHandler = (method) => {
      if (method === 'textDocument/formatting') {
        const edits: LspTextEdit[] = [
          {
            range: {
              start: { line: 0, character: 0 },
              end: { line: 2, character: 1 },
            },
            newText: 'function badIndent() {\n  return 42;\n}',
          },
        ];
        return edits;
      }
      return undefined;
    };

    const res = await formattingCoordinator.formatDocument(doc.id);
    expect(res.status).toBe('applied');
    expect(res.appliedEditsCount).toBe(1);

    const updatedDoc = docEngine.getDocument(doc.id);
    expect(updatedDoc?.content).toBe('function badIndent() {\n  return 42;\n}');
    expect(updatedDoc?.contentRevision).toBeGreaterThan(initialRevision);
  });

  it('returns no_changes when server returns null or empty edits', async () => {
    const { document: doc } = await docEngine.openResource(testFilePath, {
      initialContent: initialCode,
      languageId: 'typescript',
    });

    customHandler = (method) => {
      if (method === 'textDocument/formatting') {
        return null; // No formatting changes needed
      }
      return undefined;
    };

    const initialRevision = doc.contentRevision;
    const res = await formattingCoordinator.formatDocument(doc.id);

    expect(res.status).toBe('no_changes');
    expect(res.appliedEditsCount).toBe(0);

    const docAfter = docEngine.getDocument(doc.id);
    expect(docAfter?.contentRevision).toBe(initialRevision);
  });

  it('formats selection / range through textDocument/rangeFormatting', async () => {
    const { document: doc } = await docEngine.openResource(testFilePath, {
      initialContent: initialCode,
      languageId: 'typescript',
    });

    let capturedRange: any = null;
    customHandler = (method, params) => {
      if (method === 'textDocument/rangeFormatting') {
        capturedRange = params.range;
        const edits: LspTextEdit[] = [
          {
            range: {
              start: { line: 1, character: 0 },
              end: { line: 1, character: 10 },
            },
            newText: '  return 42;',
          },
        ];
        return edits;
      }
      return undefined;
    };

    const targetRange = { startLine: 2, startColumn: 1, endLine: 2, endColumn: 11 };
    const res = await formattingCoordinator.formatRange(doc.id, targetRange);

    expect(res.status).toBe('applied');
    expect(capturedRange).toEqual({
      start: { line: 1, character: 0 },
      end: { line: 1, character: 10 },
    });

    const updatedDoc = docEngine.getDocument(doc.id);
    expect(updatedDoc?.content).toContain('  return 42;');
  });

  it('rejects formatting when document is marked read-only', async () => {
    const { document: doc } = await docEngine.openResource(testFilePath, {
      initialContent: initialCode,
      languageId: 'typescript',
    });

    // Mark document read-only
    (doc.metadata as any).isReadOnly = true;

    const res = await formattingCoordinator.formatDocument(doc.id);
    expect(res.status).toBe('rejected');
    expect(res.error).toContain('read-only');
  });

  it('rejects formatting when lsp.formatting.enabled setting is false', async () => {
    const { document: doc } = await docEngine.openResource(testFilePath, {
      initialContent: initialCode,
      languageId: 'typescript',
    });

    SettingsService.getInstance().set('lsp.formatting.enabled', false);

    const res = await formattingCoordinator.formatDocument(doc.id);
    expect(res.status).toBe('rejected');
    expect(res.error).toContain('disabled');
  });

  it('rejects formatting when server capabilities do not support formatting', async () => {
    // Session without formatting capability
    const noFmtTransport = new MockLspTransport();
    noFmtTransport.messageHandler = (msg) => {
      const req = msg as RequestMessage;
      if (req.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: req.id,
          result: {
            capabilities: {
              documentFormattingProvider: false,
              documentRangeFormattingProvider: false,
            },
          },
        };
      }
      return null;
    };

    const noFmtManager = new (LspServerManager as any)(LspServerRegistry.getInstance());
    noFmtManager.setTransportFactory(() => noFmtTransport);

    const pySession = await noFmtManager.getOrCreateSession('python', '.py', 'test-ws', 'C:/project');
    if (pySession) {
      await pySession.start();
    }

    const { document: pyDoc } = await docEngine.openResource('C:/project/script.py', {
      initialContent: 'x=1\n',
      languageId: 'python',
    });

    const pyCoord = new LspFormattingCoordinator(
      new LspFormattingProvider(noFmtManager, docEngine),
      editorCoordination,
      docEngine
    );

    const res = await pyCoord.formatDocument(pyDoc.id);
    expect(res.status).toBe('rejected');
    expect(res.error).toContain('does not support document formatting');

    await noFmtManager.dispose();
    pyCoord.dispose();
  });

  it('rejects formatting safely if document content changed while request was in-flight (stale protection)', async () => {
    const { document: doc } = await docEngine.openResource(testFilePath, {
      initialContent: initialCode,
      languageId: 'typescript',
    });

    customHandler = (method) => {
      if (method === 'textDocument/formatting') {
        // Concurrently mutate the document to simulate user typing while in flight
        docEngine.updateText(doc.id, 'function modifiedConcurrently() {}', 'user');

        return [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 8 } },
            newText: 'const',
          },
        ];
      }
      return undefined;
    };

    const res = await formattingCoordinator.formatDocument(doc.id);
    expect(res.status).toBe('failed');
    expect(res.error).toContain('changed while formatting was in flight');
  });

  it('rejects formatting when cancellation is requested', async () => {
    const { document: doc } = await docEngine.openResource(testFilePath, {
      initialContent: initialCode,
      languageId: 'typescript',
    });

    const cts = new CancellationTokenSource();
    cts.cancel(); // Pre-cancel

    const req = {
      requestId: 'test-cancel',
      workspaceId: 'test-ws',
      workspaceGeneration: globalWorkspaceEngine.getGeneration(),
      documentId: doc.id,
      resourceUri: doc.resourceUri,
      documentRevision: doc.contentRevision,
      languageId: 'typescript',
    };

    const res = await formattingProvider.formatDocument(req, cts.token);
    expect(res.valid).toBe(false);
    expect(res.status).toBe('stale');
    expect(res.error).toContain('cancelled');
  });
});
