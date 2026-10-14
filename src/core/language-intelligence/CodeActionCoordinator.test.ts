/**
 * QM Editor Code Action Coordinator Unit Tests
 * Phase 04, Step 44 — Code Actions, Quick Fixes & Safe Code Transformation Foundation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CodeActionCoordinator,
  codeActionRangeToOffsets,
} from './CodeActionCoordinator';
import {
  LanguageIntelligenceRegistry,
} from './LanguageIntelligenceRegistry';
import {
  LanguageIntelligenceProvider,
  CodeAction,
  CodeActionRequest,
} from './index';
import { globalDocumentEngine, DocumentEngine } from '../documents/DocumentEngine';
import { globalEditorCoordinationService, EditorCoordinationService } from '../editor';
import { globalWorkspaceEngine } from '../workspace';
import { Diagnostic } from '../diagnostics/DiagnosticTypes';

describe('CodeActionCoordinator', () => {
  let registry: LanguageIntelligenceRegistry;
  let coordinator: CodeActionCoordinator;
  let docEngine: DocumentEngine;
  let editorCoord: EditorCoordinationService;

  async function createTestDoc(uri: string, initialContent: string, languageId: string = 'typescript', readOnly: boolean = false) {
    const res = await docEngine.openResource(uri, { initialContent, languageId, readOnly });
    return res.document;
  }

  beforeEach(() => {
    registry = new LanguageIntelligenceRegistry();
    docEngine = globalDocumentEngine;
    editorCoord = globalEditorCoordinationService;
    coordinator = new CodeActionCoordinator(registry, docEngine, editorCoord);
  });

  afterEach(() => {
    coordinator.dispose();
    registry.clear();
  });

  describe('codeActionRangeToOffsets', () => {
    it('correctly maps 1-based Range to 0-based character offsets', () => {
      const content = 'hello\nworld\nfoo';
      // 'world' is line 2, cols 1 to 6
      const range = { startLine: 2, startColumn: 1, endLine: 2, endColumn: 6 };
      const offsets = codeActionRangeToOffsets(content, range);
      expect(offsets.from).toBe(6);
      expect(offsets.to).toBe(11);
      expect(content.slice(offsets.from, offsets.to)).toBe('world');
    });

    it('safely clamps out-of-bounds line or column coordinates', () => {
      const content = 'abc';
      const range = { startLine: 10, startColumn: 5, endLine: 10, endColumn: 10 };
      const offsets = codeActionRangeToOffsets(content, range);
      expect(offsets.from).toBe(3);
      expect(offsets.to).toBe(3);
    });
  });

  describe('provideCodeActions', () => {
    it('queries compatible providers and returns sorted actions', async () => {
      const doc = await createTestDoc('C:/test/action.ts', 'const x: number = "bad";');

      const dummyDiag: Diagnostic = {
        id: 'diag-1',
        uri: doc.resourceUri,
        severity: 'error',
        message: 'Type string is not assignable to type number',
        source: 'typescript',
        createdAt: Date.now(),
        range: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 8 },
      };

      const provider: LanguageIntelligenceProvider = {
        providerId: 'ts.actions',
        supportedLanguages: ['typescript'],
        capabilities: {
          codeActions: {
            providedCodeActionKinds: ['quickfix'],
          },
        },
        provideCodeActions: async (req) => {
          return [
            {
              id: 'ts.fix.changeType',
              providerId: 'ts.actions',
              title: 'Change type to string',
              kind: 'quickfix',
              isPreferred: true,
              diagnostics: req.diagnostics,
              edit: {
                changes: {
                  [req.resourceUri]: [
                    {
                      resourceUri: req.resourceUri,
                      range: { startLine: 1, startColumn: 11, endLine: 1, endColumn: 17 },
                      newText: 'string',
                    },
                  ],
                },
              },
            },
            {
              id: 'ts.fix.cast',
              providerId: 'ts.actions',
              title: 'Add type assertion',
              kind: 'quickfix',
              isPreferred: false,
            },
          ];
        },
      };

      registry.registerProvider(provider);

      const request: CodeActionRequest = {
        requestId: 'ca-req-1',
        workspaceId: 'ws-test',
        workspaceGeneration: globalWorkspaceEngine.getGeneration(),
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        editorModelId: doc.id,
        documentRevision: doc.contentRevision,
        range: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 8 },
        diagnostics: [dummyDiag],
        languageId: 'typescript',
        triggerKind: 'invoked',
      };

      const actions = await coordinator.provideCodeActions(request);
      expect(actions.length).toBe(2);
      expect(actions[0].id).toBe('ts.fix.changeType');
      expect(actions[0].isPreferred).toBe(true);
      expect(actions[1].id).toBe('ts.fix.cast');
      expect(actions[1].isPreferred).toBe(false);
    });

    it('isolates provider failures without crashing coordinator', async () => {
      const doc = await createTestDoc('C:/test/error.ts', 'let z = 1;');

      const explodingProvider: LanguageIntelligenceProvider = {
        providerId: 'exploding.actions',
        supportedLanguages: ['typescript'],
        capabilities: { codeActions: true },
        provideCodeActions: async () => {
          throw new Error('Fatal action provider crash!');
        },
      };

      const healthyProvider: LanguageIntelligenceProvider = {
        providerId: 'healthy.actions',
        supportedLanguages: ['typescript'],
        capabilities: { codeActions: true },
        provideCodeActions: async () => {
          return [
            {
              id: 'healthy.fix',
              providerId: 'healthy.actions',
              title: 'Healthy action',
              kind: 'quickfix',
            },
          ];
        },
      };

      registry.registerProvider(explodingProvider);
      registry.registerProvider(healthyProvider);

      const request: CodeActionRequest = {
        requestId: 'ca-err-req',
        workspaceId: 'ws-test',
        workspaceGeneration: globalWorkspaceEngine.getGeneration(),
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        editorModelId: doc.id,
        documentRevision: doc.contentRevision,
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 },
        diagnostics: [],
        languageId: 'typescript',
        triggerKind: 'invoked',
      };

      const actions = await coordinator.provideCodeActions(request);
      expect(actions.length).toBe(1);
      expect(actions[0].id).toBe('healthy.fix');
    });

    it('rejects code action requests when document revision is stale', async () => {
      const doc = await createTestDoc('C:/test/stale.ts', 'const a = 1;');

      const provider: LanguageIntelligenceProvider = {
        providerId: 'provider.ts',
        supportedLanguages: ['typescript'],
        capabilities: { codeActions: true },
        provideCodeActions: async () => [
          { id: 'act-1', providerId: 'provider.ts', title: 'Fix', kind: 'quickfix' },
        ],
      };
      registry.registerProvider(provider);

      const staleRequest: CodeActionRequest = {
        requestId: 'req-stale',
        workspaceId: 'ws-test',
        workspaceGeneration: globalWorkspaceEngine.getGeneration(),
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        editorModelId: doc.id,
        documentRevision: doc.contentRevision + 999, // Mismatched revision
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
        diagnostics: [],
        languageId: 'typescript',
        triggerKind: 'invoked',
      };

      const actions = await coordinator.provideCodeActions(staleRequest);
      expect(actions).toEqual([]);
    });
  });

  describe('validateCodeAction', () => {
    it('blocks actions with a disabledReason', () => {
      const action: CodeAction = {
        id: 'disabled.act',
        providerId: 'test',
        title: 'Extract variable',
        kind: 'refactor.extract',
        disabledReason: 'No expression selected for extraction',
      };

      const val = coordinator.validateCodeAction(action);
      expect(val.valid).toBe(false);
      expect(val.status).toBe('disabled');
      expect(val.error).toBe('No expression selected for extraction');
    });

    it('blocks actions targeting read-only documents', async () => {
      const doc = await createTestDoc('C:/test/readonly.ts', 'content', 'typescript', true);

      const action: CodeAction = {
        id: 'act.ro',
        providerId: 'test',
        title: 'Fix read-only',
        kind: 'quickfix',
        documentRevision: doc.contentRevision,
        edit: {
          changes: {
            [doc.resourceUri]: [
              {
                resourceUri: doc.resourceUri,
                range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
                newText: 'x',
              },
            ],
          },
        },
      };

      const val = coordinator.validateCodeAction(action, { documentId: doc.id });
      expect(val.valid).toBe(false);
      expect(val.status).toBe('read_only');
    });

    it('detects and rejects overlapping edits in the same file', async () => {
      const doc = await createTestDoc('C:/test/overlap.ts', 'abcdefghij');

      const action: CodeAction = {
        id: 'act.overlap',
        providerId: 'test',
        title: 'Conflicting edits',
        kind: 'quickfix',
        documentRevision: doc.contentRevision,
        edit: {
          changes: {
            [doc.resourceUri]: [
              {
                resourceUri: doc.resourceUri,
                range: { startLine: 1, startColumn: 2, endLine: 1, endColumn: 6 }, // 'bcde'
                newText: '1',
              },
              {
                resourceUri: doc.resourceUri,
                range: { startLine: 1, startColumn: 4, endLine: 1, endColumn: 8 }, // 'defg' overlaps!
                newText: '2',
              },
            ],
          },
        },
      };

      const val = coordinator.validateCodeAction(action, { documentId: doc.id });
      expect(val.valid).toBe(false);
      expect(val.status).toBe('invalid_range');
      expect(val.error).toContain('Overlapping edit ranges detected');
    });
  });

  describe('previewCodeAction', () => {
    it('generates accurate non-mutating preview without changing document state', async () => {
      const doc = await createTestDoc('C:/test/preview.ts', 'const num = 10;');
      const initialRev = doc.contentRevision;
      const initialDirty = doc.isDirty;

      const action: CodeAction = {
        id: 'act.preview',
        providerId: 'preview.p',
        title: 'Convert const to let',
        kind: 'quickfix',
        documentRevision: doc.contentRevision,
        edit: {
          changes: {
            [doc.resourceUri]: [
              {
                resourceUri: doc.resourceUri,
                range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
                newText: 'let',
              },
            ],
          },
        },
      };

      const preview = await coordinator.previewCodeAction(action);
      expect(preview.actionId).toBe('act.preview');
      expect(preview.affectedFiles.length).toBe(1);
      expect(preview.affectedFiles[0].originalContent).toBe('const num = 10;');
      expect(preview.affectedFiles[0].proposedContent).toBe('let num = 10;');
      expect(preview.requiresConfirmation).toBe(false);

      // Verify Non-Mutation Invariant!
      expect(doc.content).toBe('const num = 10;');
      expect(doc.contentRevision).toBe(initialRev);
      expect(doc.isDirty).toBe(initialDirty);
    });

    it('flags requiresConfirmation when multiple files are affected', async () => {
      const doc1 = await createTestDoc('C:/test/file1.ts', 'export const A = 1;');
      const doc2 = await createTestDoc('C:/test/file2.ts', 'import { A } from "./file1";');

      const action: CodeAction = {
        id: 'act.multi',
        providerId: 'refactor.p',
        title: 'Rename export across files',
        kind: 'refactor',
        edit: {
          changes: {
            [doc1.resourceUri]: [
              {
                resourceUri: doc1.resourceUri,
                range: { startLine: 1, startColumn: 14, endLine: 1, endColumn: 15 },
                newText: 'B',
              },
            ],
            [doc2.resourceUri]: [
              {
                resourceUri: doc2.resourceUri,
                range: { startLine: 1, startColumn: 10, endLine: 1, endColumn: 11 },
                newText: 'B',
              },
            ],
          },
        },
      };

      const preview = await coordinator.previewCodeAction(action);
      expect(preview.affectedFiles.length).toBe(2);
      expect(preview.requiresConfirmation).toBe(true);
      expect(preview.confirmationReason).toContain('modifies 2 files');
    });
  });

  describe('applyCodeAction', () => {
    it('applies code action transformation through Edit Transaction System with revision tracking', async () => {
      const doc = await createTestDoc('C:/test/apply.ts', 'console.log("hello");');
      const startRev = doc.contentRevision;

      const action: CodeAction = {
        id: 'act.replaceLog',
        providerId: 'ts.fix',
        title: 'Replace log with warn',
        kind: 'quickfix',
        documentRevision: doc.contentRevision,
        edit: {
          changes: {
            [doc.resourceUri]: [
              {
                resourceUri: doc.resourceUri,
                range: { startLine: 1, startColumn: 9, endLine: 1, endColumn: 12 },
                newText: 'warn',
              },
            ],
          },
        },
      };

      const result = await coordinator.applyCodeAction(action, {
        documentId: doc.id,
        expectedRevision: doc.contentRevision,
      });

      expect(result.status).toBe('applied');
      expect(result.appliedEditsCount).toBe(1);
      expect(doc.content).toBe('console.warn("hello");');
      expect(doc.contentRevision).toBeGreaterThan(startRev);
      expect(doc.isDirty).toBe(true);
    });

    it('rejects stale action execution when document content changed after action generation', async () => {
      const doc = await createTestDoc('C:/test/stale-exec.ts', 'let x = 10;');

      const action: CodeAction = {
        id: 'act.stale',
        providerId: 'ts.fix',
        title: 'Fix let',
        kind: 'quickfix',
        documentRevision: doc.contentRevision, // Revision at generation
        edit: {
          changes: {
            [doc.resourceUri]: [
              {
                resourceUri: doc.resourceUri,
                range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 4 },
                newText: 'const',
              },
            ],
          },
        },
      };

      // User continues typing in document, advancing revision!
      await docEngine.updateText(doc.id, 'let x = 20;\n// more code', 'user');
      expect(doc.contentRevision).toBeGreaterThan(action.documentRevision!);

      // Now attempting to apply the old action
      const result = await coordinator.applyCodeAction(action, {
        documentId: doc.id,
      });

      expect(result.status).toBe('stale');
      expect(result.error).toContain('Stale action: document revision has advanced');
      // Document remains untouched by the rejected action
      expect(doc.content).toBe('let x = 20;\n// more code');
    });
  });
});
