/**
 * QM Editor LSP Rename & WorkspaceEdit Test Suite
 * Phase 06, Step 62 — LSP Rename, Prepare Rename & Safe Multi-File Workspace Edit Integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LspWorkspaceEditValidator } from './LspWorkspaceEditValidator';
import { LspWorkspaceEditMapper } from './LspWorkspaceEditMapper';
import { LspRenameProvider } from './LspRenameProvider';
import { LspRenameCoordinator } from './LspRenameCoordinator';
import { LspWorkspaceEdit, RequestMessage } from '../LspTypes';
import { LspUriMapper } from '../LspUriMapper';
import { MockLspTransport } from '../transport/MockLspTransport';
import { LspServerRegistry } from '../LspServerRegistry';
import { LspServerManager } from '../LspServerManager';
import { DocumentEngine, globalDocumentEngine } from '../../documents/DocumentEngine';
import { EditorCoordinationService, globalEditorCoordinationService } from '../../editor/EditorCoordinationService';
import { CodeActionCoordinator, globalCodeActionCoordinator } from '../../language-intelligence/CodeActionCoordinator';
import { globalWorkspaceEngine } from '../../workspace';
import { CancellationTokenSource } from '../../symbols/CancellationToken';

describe('LspWorkspaceEditValidator', () => {
  it('validates proposed symbol names correctly', () => {
    // Valid names
    expect(LspWorkspaceEditValidator.validateNewName('newMethodName').valid).toBe(true);
    expect(LspWorkspaceEditValidator.validateNewName('$my_var123').valid).toBe(true);

    // Empty or whitespace
    expect(LspWorkspaceEditValidator.validateNewName('').valid).toBe(false);
    expect(LspWorkspaceEditValidator.validateNewName('   ').valid).toBe(false);
    expect(LspWorkspaceEditValidator.validateNewName(null).valid).toBe(false);

    // Control characters
    expect(LspWorkspaceEditValidator.validateNewName('test\x00name').valid).toBe(false);
    expect(LspWorkspaceEditValidator.validateNewName('test\x1Fname').valid).toBe(false);

    // Multi-line names
    expect(LspWorkspaceEditValidator.validateNewName('line1\nline2').valid).toBe(false);
    expect(LspWorkspaceEditValidator.validateNewName('line1\r\nline2').valid).toBe(false);

    // Same name check
    const sameRes = LspWorkspaceEditValidator.validateNewName('oldName', 'oldName');
    expect(sameRes.valid).toBe(false);
    expect(sameRes.error).toContain('different');

    // Too long
    const hugeName = 'a'.repeat(300);
    expect(LspWorkspaceEditValidator.validateNewName(hugeName).valid).toBe(false);
  });

  it('validates URIs and rejects insecure schemes and path traversals', () => {
    // Valid file URI
    expect(LspWorkspaceEditValidator.validateEditUri('file:///C:/project/src/index.ts').valid).toBe(true);

    // Dangerous schemes
    expect(LspWorkspaceEditValidator.validateEditUri('javascript:alert(1)').valid).toBe(false);
    expect(LspWorkspaceEditValidator.validateEditUri('command:workbench.action.closeAll').valid).toBe(false);
    expect(LspWorkspaceEditValidator.validateEditUri('shell:cmd.exe').valid).toBe(false);

    // Path traversal
    expect(LspWorkspaceEditValidator.validateEditUri('file:///C:/project/../../windows/system32.dll').valid).toBe(false);
    expect(LspWorkspaceEditValidator.validateEditUri('file:///C:/project/..\\..\\windows/system32.dll').valid).toBe(false);
  });

  it('validates edit ranges and detects overlapping edits', async () => {
    const docEngine = new DocumentEngine();
    const { document: doc } = await docEngine.openResource('C:/test/App.ts', {
      initialContent: 'const user = 10;\nconsole.log(user);',
    });

    const fileUri = LspUriMapper.pathToUri('C:/test/App.ts');

    // Valid non-overlapping edits
    const validEdit: LspWorkspaceEdit = {
      changes: {
        [fileUri]: [
          {
            range: { start: { line: 0, character: 6 }, end: { line: 0, character: 10 } },
            newText: 'account',
          },
          {
            range: { start: { line: 1, character: 12 }, end: { line: 1, character: 16 } },
            newText: 'account',
          },
        ],
      },
    };
    expect(LspWorkspaceEditValidator.validateWorkspaceEdit(validEdit, { documentEngine: docEngine }).valid).toBe(true);

    // Overlapping edits on same range
    const overlappingEdit: LspWorkspaceEdit = {
      changes: {
        [fileUri]: [
          {
            range: { start: { line: 0, character: 6 }, end: { line: 0, character: 10 } },
            newText: 'account',
          },
          {
            range: { start: { line: 0, character: 8 }, end: { line: 0, character: 12 } },
            newText: 'other',
          },
        ],
      },
    };
    const overlapRes = LspWorkspaceEditValidator.validateWorkspaceEdit(overlappingEdit, { documentEngine: docEngine });
    expect(overlapRes.valid).toBe(false);
    expect(overlapRes.status).toBe('overlapping_edits');

    // Out of bounds range (line 10 does not exist in 2-line file)
    const outOfBoundsEdit: LspWorkspaceEdit = {
      changes: {
        [fileUri]: [
          {
            range: { start: { line: 10, character: 0 }, end: { line: 10, character: 5 } },
            newText: 'test',
          },
        ],
      },
    };
    const oobRes = LspWorkspaceEditValidator.validateWorkspaceEdit(outOfBoundsEdit, { documentEngine: docEngine });
    expect(oobRes.valid).toBe(false);
    expect(oobRes.status).toBe('invalid_range');

    // Read-only document protection
    (doc.metadata as any).isReadOnly = true;
    const readOnlyRes = LspWorkspaceEditValidator.validateWorkspaceEdit(validEdit, { documentEngine: docEngine });
    expect(readOnlyRes.valid).toBe(false);
    expect(readOnlyRes.status).toBe('read_only');
  });
});

describe('LspWorkspaceEditMapper', () => {
  it('maps changes map to canonical WorkspaceEdit with 1-based coordinates', () => {
    const raw: LspWorkspaceEdit = {
      changes: {
        'file:///C:/project/App.ts': [
          {
            range: { start: { line: 0, character: 6 }, end: { line: 0, character: 10 } },
            newText: 'newVar',
          },
        ],
      },
    };

    const canonical = LspWorkspaceEditMapper.mapWorkspaceEdit(raw);
    expect(canonical.changes).toBeDefined();
    const expectedKey = LspUriMapper.uriToPath('file:///C:/project/App.ts');
    const edits = canonical.changes![expectedKey];
    expect(edits).toBeDefined();
    expect(edits.length).toBe(1);
    expect(edits[0].range.startLine).toBe(1);
    expect(edits[0].range.startColumn).toBe(7);
    expect(edits[0].range.endLine).toBe(1);
    expect(edits[0].range.endColumn).toBe(11);
    expect(edits[0].newText).toBe('newVar');
  });

  it('maps documentChanges with text edits and resource operations', () => {
    const raw: LspWorkspaceEdit = {
      documentChanges: [
        {
          textDocument: { uri: 'file:///C:/project/User.ts', version: 1 },
          edits: [
            {
              range: { start: { line: 2, character: 4 }, end: { line: 2, character: 12 } },
              newText: 'Customer',
            },
          ],
        },
        {
          kind: 'rename',
          oldUri: 'file:///C:/project/User.ts',
          newUri: 'file:///C:/project/Customer.ts',
        },
      ],
    };

    const canonical = LspWorkspaceEditMapper.mapWorkspaceEdit(raw);
    const expectedUserKey = LspUriMapper.uriToPath('file:///C:/project/User.ts');
    const expectedCustKey = LspUriMapper.uriToPath('file:///C:/project/Customer.ts');

    expect(canonical.changes![expectedUserKey]).toBeDefined();
    expect(canonical.changes![expectedUserKey][0].newText).toBe('Customer');

    expect(canonical.resourceOperations).toBeDefined();
    expect(canonical.resourceOperations!.length).toBe(1);
    expect(canonical.resourceOperations![0].type).toBe('renameFile');
    if (canonical.resourceOperations![0].type === 'renameFile') {
      expect(canonical.resourceOperations![0].oldUri).toBe(expectedUserKey);
      expect(canonical.resourceOperations![0].newUri).toBe(expectedCustKey);
    }
  });
});

describe('LspRenameProvider & LspRenameCoordinator Integration', () => {
  let docEngine: DocumentEngine;
  let editorCoordination: EditorCoordinationService;
  let codeActionCoord: CodeActionCoordinator;
  let serverManager: LspServerManager;
  let transport: MockLspTransport;
  let renameProvider: LspRenameProvider;
  let coordinator: LspRenameCoordinator;
  let customHandler: ((method: string, params: any) => any) | null = null;

  beforeEach(async () => {
    docEngine = globalDocumentEngine;
    for (const d of docEngine.getAllDocuments()) {
      await docEngine.close(d.id, true);
    }
    editorCoordination = globalEditorCoordinationService;
    codeActionCoord = globalCodeActionCoordinator;

    transport = new MockLspTransport();
    customHandler = null;

    transport.messageHandler = (msg) => {
      if ('method' in msg && msg.method === 'initialize') {
        return {
          jsonrpc: '2.0',
          id: (msg as RequestMessage).id,
          result: {
            capabilities: {
              renameProvider: {
                prepareProvider: true,
              },
            },
            serverInfo: { name: 'Test Server', version: '1.0.0' },
          },
        };
      }
      if ('method' in msg && msg.method === 'shutdown') {
        return { jsonrpc: '2.0', id: (msg as RequestMessage).id, result: null };
      }
      if ('method' in msg && 'id' in msg && (msg as any).id !== undefined && customHandler) {
        const res = customHandler((msg as RequestMessage).method, (msg as RequestMessage).params);
        if (res !== undefined) {
          return { jsonrpc: '2.0', id: (msg as RequestMessage).id, result: res };
        }
      }
      return null;
    };

    serverManager = new (LspServerManager as any)(LspServerRegistry.getInstance());
    serverManager.setTransportFactory(() => transport);

    const session = await serverManager.getOrCreateSession('typescript', '.ts', 'ws-test', 'C:/test-ws');
    if (session) {
      await session.start();
    }

    renameProvider = new LspRenameProvider(serverManager, docEngine);
    coordinator = new LspRenameCoordinator(renameProvider, codeActionCoord, docEngine, serverManager);
  });

  afterEach(async () => {
    await serverManager.dispose();
    for (const d of docEngine.getAllDocuments()) {
      await docEngine.close(d.id, true);
    }
  });

  it('prepares rename and extracts symbol range and placeholder', async () => {
    const { document: doc } = await docEngine.openResource('C:/test-ws/App.ts', {
      initialContent: 'function calculateTotal() {\n  return 42;\n}',
    });

    customHandler = (method) => {
      if (method === 'textDocument/prepareRename') {
        return {
          range: {
            start: { line: 0, character: 9 },
            end: { line: 0, character: 23 },
          },
          placeholder: 'calculateTotal',
        };
      }
      return undefined;
    };

    const prep = await coordinator.prepareRename({
      requestId: 'prep-1',
      workspaceId: 'ws-test',
      workspaceGeneration: globalWorkspaceEngine.getGeneration(),
      documentId: doc.id,
      resourceUri: 'C:/test-ws/App.ts',
      documentRevision: doc.contentRevision,
      line: 1,
      column: 12,
      languageId: 'typescript',
    });

    expect(prep.valid).toBe(true);
    expect(prep.value?.placeholder).toBe('calculateTotal');
    expect(prep.value?.range.startLine).toBe(1);
    expect(prep.value?.range.startColumn).toBe(10);
    expect(prep.value?.range.endLine).toBe(1);
    expect(prep.value?.range.endColumn).toBe(24);
  });

  it('rejects prepareRename when symbol is not renameable', async () => {
    const { document: doc } = await docEngine.openResource('C:/test-ws/App.ts', {
      initialContent: 'const x = 1;',
    });

    customHandler = (method) => {
      if (method === 'textDocument/prepareRename') {
        return null; // Server indicates element cannot be renamed
      }
      return undefined;
    };

    const prep = await coordinator.prepareRename({
      requestId: 'prep-2',
      workspaceId: 'ws-test',
      workspaceGeneration: globalWorkspaceEngine.getGeneration(),
      documentId: doc.id,
      resourceUri: 'C:/test-ws/App.ts',
      documentRevision: doc.contentRevision,
      line: 1,
      column: 1,
      languageId: 'typescript',
    });

    expect(prep.valid).toBe(false);
    expect(prep.status).toBe('not_renameable');
  });

  it('rejects stale prepareRename when document revision has advanced', async () => {
    const { document: doc } = await docEngine.openResource('C:/test-ws/App.ts', {
      initialContent: 'const x = 1;',
    });

    const prep = await coordinator.prepareRename({
      requestId: 'prep-3',
      workspaceId: 'ws-test',
      workspaceGeneration: globalWorkspaceEngine.getGeneration(),
      documentId: doc.id,
      resourceUri: 'C:/test-ws/App.ts',
      documentRevision: doc.contentRevision - 1, // Stale revision
      line: 1,
      column: 7,
      languageId: 'typescript',
    });

    expect(prep.valid).toBe(false);
    expect(prep.status).toBe('stale');
  });

  it('executes single-file rename transactionally and supports native Undo', async () => {
    const { document: doc } = await docEngine.openResource('C:/test-ws/App.ts', {
      initialContent: 'function greet() {\n  return greet;\n}',
    });

    let currentContent = doc.content;
    const history: string[] = [doc.content];
    let historyIdx = 0;

    const mockAdapter: any = {
      applyEdits: (edits: any[]) => {
        const sortedDesc = [...edits].sort((a, b) => b.from - a.from);
        for (const e of sortedDesc) {
          currentContent = currentContent.slice(0, e.from) + e.insert + currentContent.slice(e.to);
        }
        history.push(currentContent);
        historyIdx++;
      },
      getContent: () => currentContent,
      canUndo: () => historyIdx > 0,
      canRedo: () => historyIdx < history.length - 1,
      undo: () => {
        if (historyIdx > 0) {
          historyIdx--;
          currentContent = history[historyIdx];
          doc.content = currentContent;
          return true;
        }
        return false;
      },
      redo: () => {
        if (historyIdx < history.length - 1) {
          historyIdx++;
          currentContent = history[historyIdx];
          doc.content = currentContent;
          return true;
        }
        return false;
      },
    };
    editorCoordination.registerEditorInstance('inst-rename', doc.id, mockAdapter);

    const fileUri = LspUriMapper.pathToUri('C:/test-ws/App.ts');

    customHandler = (method) => {
      if (method === 'textDocument/rename') {
        return {
          changes: {
            [fileUri]: [
              {
                range: { start: { line: 0, character: 9 }, end: { line: 0, character: 14 } },
                newText: 'welcome',
              },
              {
                range: { start: { line: 1, character: 9 }, end: { line: 1, character: 14 } },
                newText: 'welcome',
              },
            ],
          },
        };
      }
      return undefined;
    };

    const execRes = await coordinator.executeRename(
      {
        requestId: 'rename-1',
        workspaceId: 'ws-test',
        workspaceGeneration: globalWorkspaceEngine.getGeneration(),
        documentId: doc.id,
        resourceUri: 'C:/test-ws/App.ts',
        documentRevision: doc.contentRevision,
        line: 1,
        column: 10,
        newName: 'welcome',
        languageId: 'typescript',
      },
      'greet'
    );

    expect(execRes.status).toBe('applied');
    expect(execRes.affectedFilesCount).toBe(1);
    expect(doc.content).toBe('function welcome() {\n  return welcome;\n}');
    expect(doc.isDirty).toBe(true);

    // Test Undo integration
    const undoRes = await editorCoordination.undo(doc.id);
    expect(undoRes).toBe(true);
    expect(doc.content).toBe('function greet() {\n  return greet;\n}');

    // Test Redo
    const redoRes = await editorCoordination.redo(doc.id);
    expect(redoRes).toBe(true);
    expect(doc.content).toBe('function welcome() {\n  return welcome;\n}');
  });

  it('executes multi-file workspace rename across multiple open documents', async () => {
    const { document: docA } = await docEngine.openResource('C:/test-ws/A.ts', {
      initialContent: 'export const sharedConfig = 100;',
    });
    const { document: docB } = await docEngine.openResource('C:/test-ws/B.ts', {
      initialContent: 'import { sharedConfig } from "./A";\nconsole.log(sharedConfig);',
    });

    const uriA = LspUriMapper.pathToUri('C:/test-ws/A.ts');
    const uriB = LspUriMapper.pathToUri('C:/test-ws/B.ts');

    customHandler = (method) => {
      if (method === 'textDocument/rename') {
        return {
          changes: {
            [uriA]: [
              {
                range: { start: { line: 0, character: 13 }, end: { line: 0, character: 25 } },
                newText: 'appSettings',
              },
            ],
            [uriB]: [
              {
                range: { start: { line: 0, character: 9 }, end: { line: 0, character: 21 } },
                newText: 'appSettings',
              },
              {
                range: { start: { line: 1, character: 12 }, end: { line: 1, character: 24 } },
                newText: 'appSettings',
              },
            ],
          },
        };
      }
      return undefined;
    };

    const execRes = await coordinator.executeRename(
      {
        requestId: 'rename-2',
        workspaceId: 'ws-test',
        workspaceGeneration: globalWorkspaceEngine.getGeneration(),
        documentId: docA.id,
        resourceUri: 'C:/test-ws/A.ts',
        documentRevision: docA.contentRevision,
        line: 1,
        column: 15,
        newName: 'appSettings',
        languageId: 'typescript',
      },
      'sharedConfig'
    );

    expect(execRes.status).toBe('applied');
    expect(execRes.affectedFilesCount).toBe(2);
    expect(docA.content).toBe('export const appSettings = 100;');
    expect(docB.content).toBe('import { appSettings } from "./A";\nconsole.log(appSettings);');
    expect(docA.isDirty).toBe(true);
    expect(docB.isDirty).toBe(true);
  });

  it('generates a non-mutating preview before execution', async () => {
    const { document: doc } = await docEngine.openResource('C:/test-ws/Preview.ts', {
      initialContent: 'const counter = 0;',
    });

    const fileUri = LspUriMapper.pathToUri('C:/test-ws/Preview.ts');

    customHandler = (method) => {
      if (method === 'textDocument/rename') {
        return {
          changes: {
            [fileUri]: [
              {
                range: { start: { line: 0, character: 6 }, end: { line: 0, character: 13 } },
                newText: 'index',
              },
            ],
          },
        };
      }
      return undefined;
    };

    const prevRes = await coordinator.previewRename({
      requestId: 'rename-prev',
      workspaceId: 'ws-test',
      workspaceGeneration: globalWorkspaceEngine.getGeneration(),
      documentId: doc.id,
      resourceUri: 'C:/test-ws/Preview.ts',
      documentRevision: doc.contentRevision,
      line: 1,
      column: 8,
      newName: 'index',
      languageId: 'typescript',
    });

    expect(prevRes.valid).toBe(true);
    expect(prevRes.value?.affectedFiles.length).toBe(1);
    expect(prevRes.value?.affectedFiles[0].proposedContent).toBe('const index = 0;');
    // Verify document was NOT mutated by preview
    expect(doc.content).toBe('const counter = 0;');
    expect(doc.isDirty).toBe(false);
  });

  it('handles cancellation and aborts without mutating document', async () => {
    const { document: doc } = await docEngine.openResource('C:/test-ws/Cancel.ts', {
      initialContent: 'const target = 1;',
    });

    const cts = new CancellationTokenSource();
    cts.cancel(); // Cancel immediately

    const res = await renameProvider.requestRename(
      {
        requestId: 'rename-cancel',
        workspaceId: 'ws-test',
        workspaceGeneration: globalWorkspaceEngine.getGeneration(),
        documentId: doc.id,
        resourceUri: 'C:/test-ws/Cancel.ts',
        documentRevision: doc.contentRevision,
        line: 1,
        column: 8,
        newName: 'renamed',
        languageId: 'typescript',
      },
      cts.token
    );

    expect(res.valid).toBe(false);
    expect(res.status).toBe('stale');
    expect(doc.content).toBe('const target = 1;');
  });
});
