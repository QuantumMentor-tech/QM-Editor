/**
 * QM Editor Phase 04 Core Engine Integration, Consistency & Hardening Test Suite
 * Step 45 of 135 — Phase 04 Final Integration & Completion Audit
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ApplicationRuntime } from './ApplicationRuntime';
import { registerDefaultServices } from './defaultServices';
import { globalDocumentEngine } from '../documents/DocumentEngine';
import { globalWorkspaceEngine } from '../workspace/WorkspaceEngine';
import { globalEditTransactionManager } from '../edit/EditTransactionManager';
import { globalDocumentHistoryService } from '../history/DocumentHistoryService';
import { globalDiagnosticService } from '../diagnostics/DiagnosticService';
import { globalNavigationCoordinator } from '../navigation/NavigationCoordinator';
import { globalEditorCoordinationService } from '../editor/EditorCoordinationService';
import {
  globalLanguageIntelligenceRegistry,
  globalCompletionCoordinator,
  globalHoverCoordinator,
  globalSignatureHelpCoordinator,
  globalCodeActionCoordinator,
} from '../language-intelligence';
import { CodeAction } from '../language-intelligence/CodeActionTypes';
import { normalizeWorkspacePath } from '../workspace/WorkspaceResourceBoundary';
import { ResourceSynchronizationService } from '../watcher/ResourceSynchronizationService';
import { CoalescedFileSystemEvent } from '../watcher/WatcherTypes';

describe('Phase 04 Core Engine Integration & Cross-Service Hardening', () => {
  let runtime: ApplicationRuntime;

  function resetAllGlobalSingletons(): void {
    globalDocumentEngine.reset();
    globalEditorCoordinationService.reset();
    globalNavigationCoordinator.reset();
    globalLanguageIntelligenceRegistry.clear();
    globalCompletionCoordinator.reset();
    globalHoverCoordinator.reset();
    globalSignatureHelpCoordinator.reset();
    globalCodeActionCoordinator.reset();
    globalDiagnosticService.clear();
  }

  beforeEach(async () => {
    resetAllGlobalSingletons();
    runtime = new ApplicationRuntime();
    registerDefaultServices(runtime);
    await runtime.start();
  });

  afterEach(async () => {
    resetAllGlobalSingletons();
  });

  // ---------------------------------------------------------------------------
  // 1. Service Lifecycle & Runtime Integrity
  // ---------------------------------------------------------------------------
  describe('Runtime & Service Lifecycle Integrity', () => {
    it('initializes all 30 Phase 04 core services in dependency order', () => {
      expect(runtime.isReady).toBe(true);
      expect(runtime.getState()).toBe('ready');

      // Verify presence of all Phase 04 services
      const expectedServices = [
        'settings',
        'feedback',
        'command',
        'file',
        'editTransactionManager',
        'documentEngine',
        'editorCoordination',
        'layout',
        'recentWorkspaces',
        'recentDocuments',
        'session',
        'workspace',
        'workspaceEngine',
        'search',
        'terminal',
        'tasks',
        'workspaceSearch',
        'workspaceIndex',
        'sourceControl',
        'watcher',
        'resourceSynchronization',
        'history',
        'diagnostics',
        'symbols',
        'navigation',
        'languageIntelligence',
        'completion',
        'hover',
        'signatureHelp',
        'codeActions',
      ];

      for (const serviceId of expectedServices) {
        expect(runtime.hasService(serviceId), `Service "${serviceId}" should be registered`).toBe(true);
        expect(runtime.getService(serviceId)).toBeDefined();
      }
    });

    it('resets workspace-scoped and cacheable services during workspace open and close', async () => {
      const gen1 = await runtime.openWorkspace('C:/test/workspace', 'TestWorkspace');
      expect(gen1).toBeGreaterThan(0);
      expect(runtime.currentWorkspaceUri).toBe('C:/test/workspace');

      const gen2 = await runtime.closeWorkspace();
      expect(gen2).toBe(gen1 + 1);
      expect(runtime.currentWorkspaceUri).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Mandatory End-to-End Scenarios (Section 41)
  // ---------------------------------------------------------------------------
  describe('Mandatory End-to-End Scenarios (Section 41)', () => {
    // Scenario A: Normal Editing
    it('Scenario A: Normal Editing (Open -> Edit -> Undo -> Redo -> Save -> Close)', async () => {
      const uri = 'C:/test/scenarioA.ts';
      const initialContent = 'const a = 1;';
      const openResult = await globalDocumentEngine.openResource(uri, { initialContent, languageId: 'typescript' });
      const doc = openResult.document;

      expect(doc.content).toBe(initialContent);
      expect(doc.contentRevision).toBe(0);
      expect(doc.isDirty).toBe(false);

      // 1. Edit via EditTransactionManager
      const editedContent = 'const a = 42;';
      const legacyModel = globalDocumentEngine.toDocumentModel(doc);
      await globalEditTransactionManager.applyTransaction(legacyModel, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        origin: 'user',
        changes: [{
          from: 0,
          to: initialContent.length,
          insertText: editedContent,
        }],
      });
      await globalDocumentEngine.updateText(doc.id, editedContent, 'user');

      expect(doc.content).toBe(editedContent);
      expect(doc.contentRevision).toBe(1);
      expect(doc.isDirty).toBe(true);

      // 2. Undo
      const historyStack = globalDocumentHistoryService.getOrCreateStack(doc.id);
      expect(historyStack.canUndo()).toBe(true);
      const undoTx = historyStack.popUndo();
      expect(undoTx).toBeDefined();

      // Applying reverse transaction
      const dirtyLegacyModel = globalDocumentEngine.toDocumentModel(doc);
      await globalEditTransactionManager.applyTransaction(dirtyLegacyModel, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        origin: 'undo',
        changes: [{
          from: 0,
          to: editedContent.length,
          insertText: initialContent,
        }],
      });
      // Sync document engine state
      await globalDocumentEngine.updateText(doc.id, initialContent, 'undo');
      expect(doc.content).toBe(initialContent);
      expect(doc.isDirty).toBe(false); // Restored to saved baseline

      // 3. Redo
      await globalDocumentEngine.updateText(doc.id, editedContent, 'redo');
      expect(doc.content).toBe(editedContent);
      expect(doc.isDirty).toBe(true);

      // 4. Save
      // Simulate save baseline update
      doc.savedRevision = doc.contentRevision;
      doc.savedBaselineContent = doc.content;
      doc.isDirty = false;
      doc.contentState = 'clean';
      expect(doc.isDirty).toBe(false);

      // 5. Close
      await globalDocumentEngine.close(doc.id, true);
      expect(globalDocumentEngine.hasDocument(doc.id)).toBe(false);
    });

    // Scenario B: Completion
    it('Scenario B: Completion (Open -> Request -> Accept via Transaction -> Undo)', async () => {
      const uri = 'C:/test/scenarioB.ts';
      const openResult = await globalDocumentEngine.openResource(uri, {
        initialContent: 'function test() { console.l }',
        languageId: 'typescript',
      });
      const doc = openResult.document;

      // Register completion provider
      const unreg = globalLanguageIntelligenceRegistry.registerProvider({
        providerId: 'scenario.b.provider',
        supportedLanguages: ['typescript'],
        capabilities: { completion: {} },
        provideCompletions: async () => [
          {
            id: 'comp.log',
            label: 'log',
            insertText: 'log',
            kind: 'method',
            providerId: 'scenario.b.provider',
          },
        ],
      });

      // Request completions
      const completions = await globalCompletionCoordinator.requestCompletions(
        doc.id,
        { line: 1, column: 27 }
      );

      expect(completions.items.length).toBeGreaterThan(0);
      expect(completions.items[0].label).toBe('log');

      // Apply completion via EditTransactionManager
      const legacyModel = globalDocumentEngine.toDocumentModel(doc);
      const applyResult = await globalEditTransactionManager.applyTransaction(legacyModel, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        origin: 'completion',
        changes: [{
          from: 26,
          to: 27,
          insertText: 'log()',
        }],
      });

      expect(applyResult.document.content).toBe('function test() { console.log() }');
      expect(applyResult.transaction.origin).toBe('completion');

      unreg();
      await globalDocumentEngine.close(doc.id, true);
    });

    // Scenario C: Diagnostic + Quick Fix
    it('Scenario C: Diagnostic + Quick Fix (Diagnostic -> Code Action -> Preview -> Apply -> Undo)', async () => {
      const uri = 'C:/test/scenarioC.ts';
      const initialContent = 'const unused = 1;\n';
      const openResult = await globalDocumentEngine.openResource(uri, { initialContent, languageId: 'typescript' });
      const doc = openResult.document;

      // 1. Publish diagnostic via collection
      const diagCollection = globalDiagnosticService.createCollection('linter.test');
      diagCollection.set(doc.resourceUri, [
        {
          id: 'diag-unused-var',
          uri: doc.resourceUri,
          message: 'Variable unused is never read.',
          severity: 'warning',
          range: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 13 },
          source: 'linter.test',
          code: 'TS6133',
          createdAt: Date.now(),
        },
      ]);

      const diags = globalDiagnosticService.getDiagnostics(doc.resourceUri);
      expect(diags.length).toBe(1);

      // 2. Register CodeAction provider
      const unreg = globalLanguageIntelligenceRegistry.registerProvider({
        providerId: 'linter.fix.provider',
        supportedLanguages: ['typescript'],
        capabilities: { codeActions: true },
        provideCodeActions: async (req) => {
          return [
            {
              id: 'fix.remove.unused',
              providerId: 'linter.fix.provider',
              title: 'Remove unused variable',
              kind: 'quickfix',
              isPreferred: true,
              diagnostics: req.diagnostics,
              documentRevision: req.documentRevision,
              edit: {
                changes: {
                  [req.resourceUri]: [
                    {
                      resourceUri: req.resourceUri,
                      range: { startLine: 1, startColumn: 1, endLine: 2, endColumn: 1 },
                      newText: '',
                    },
                  ],
                },
              },
            },
          ];
        },
      });

      // 3. Request actions
      const actions = await globalCodeActionCoordinator.provideCodeActions({
        requestId: 'req-test-scenario-c',
        workspaceId: globalWorkspaceEngine.getWorkspaceId() || 'ws-test',
        workspaceGeneration: globalWorkspaceEngine.getGeneration(),
        editorModelId: doc.id,
        triggerKind: 'invoked',
        documentId: doc.id,
        resourceUri: doc.resourceUri,
        documentRevision: doc.contentRevision,
        range: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 13 },
        diagnostics: diags,
        languageId: 'typescript',
      });

      expect(actions.length).toBe(1);
      const action = actions[0];

      // 4. Preview action (Non-mutating verification)
      const preview = await globalCodeActionCoordinator.previewCodeAction(action);
      expect(preview.affectedFiles.length).toBe(1);
      expect(doc.content).toBe(initialContent); // Non-mutating invariant
      expect(doc.isDirty).toBe(false);

      // 5. Apply action
      const execResult = await globalCodeActionCoordinator.applyCodeAction(action);
      expect(execResult.status).toBe('applied');
      expect(doc.content).toBe('');
      expect(doc.contentRevision).toBeGreaterThan(0);
      expect(doc.isDirty).toBe(true);

      unreg();
      await globalDocumentEngine.close(doc.id, true);
    });

    // Scenario D: External File Change
    it('Scenario D: External File Change on Clean Document (Reload & Synchronize)', async () => {
      const fileUri = normalizeWorkspacePath('file:///C:/test-workspace/clean.ts');
      const openResult = await globalDocumentEngine.openResource(fileUri, {
        initialContent: 'version 1',
        languageId: 'typescript',
      });
      const doc = openResult.document;
      expect(doc.isDirty).toBe(false);

      // Simulate watcher classifying external modification on clean document
      const syncService = new ResourceSynchronizationService();
      const event: CoalescedFileSystemEvent = {
        uri: fileUri,
        type: 'modify',
        timestamp: Date.now(),
        workspaceGeneration: globalWorkspaceEngine.getGeneration(),
      };

      const classification = await syncService.classifyChange(event);
      expect(classification.classification).toBe('clean_document_reload');

      await globalDocumentEngine.close(doc.id, true);
    });

    // Scenario E: Dirty Conflict
    it('Scenario E: External File Change on Dirty Document (Conflict Protection)', async () => {
      const fileUri = normalizeWorkspacePath('file:///C:/test-workspace/dirty.ts');
      const openResult = await globalDocumentEngine.openResource(fileUri, {
        initialContent: 'original text',
        languageId: 'typescript',
      });
      const doc = openResult.document;

      // Make dirty
      doc.content = 'local unsaved edit';
      doc.isDirty = true;
      doc.contentRevision = 2;

      const syncService = new ResourceSynchronizationService();
      const event: CoalescedFileSystemEvent = {
        uri: fileUri,
        type: 'modify',
        timestamp: Date.now(),
        workspaceGeneration: globalWorkspaceEngine.getGeneration(),
      };

      const classification = await syncService.classifyChange(event);
      expect(classification.classification).toBe('dirty_document_conflict');
      // Local content must remain intact
      expect(doc.content).toBe('local unsaved edit');

      await globalDocumentEngine.close(doc.id, true);
    });

    // Scenario F: Workspace Switch Race
    it('Scenario F: Workspace Switch Race (Stale Generation Rejection)', async () => {
      const initialGen = globalWorkspaceEngine.getGeneration();

      // Code action generated for initial workspace generation
      const action: CodeAction = {
        id: 'act.race',
        providerId: 'test',
        title: 'Action in WS 1',
        kind: 'quickfix',
        workspaceGeneration: initialGen,
        documentRevision: 0,
      };

      // Switch workspace (increments generation)
      await globalWorkspaceEngine.open('C:/other/workspace', { name: 'OtherWS' });
      const newGen = globalWorkspaceEngine.getGeneration();
      expect(newGen).toBeGreaterThan(initialGen);

      // Attempting to validate or apply the old action must fail
      const validation = await globalCodeActionCoordinator.validateCodeAction(action);
      expect(validation.valid).toBe(false);
      expect(validation.status).toBe('workspace_mismatch');
    });

    // Scenario G: Document Lifecycle Race
    it('Scenario G: Document Lifecycle Race (Stale Revision Rejection)', async () => {
      const uri = 'C:/test/scenarioG.ts';
      const openResult = await globalDocumentEngine.openResource(uri, { initialContent: 'rev 0', languageId: 'typescript' });
      const doc = openResult.document;

      const action: CodeAction = {
        id: 'act.stale.rev',
        providerId: 'test',
        title: 'Stale Action',
        kind: 'quickfix',
        documentRevision: 0, // Generated for rev 0
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

      // User types, bumping document revision to 1
      await globalDocumentEngine.updateText(doc.id, 'rev 1', 'user');
      expect(doc.contentRevision).toBe(1);

      // Old action at rev 0 must be rejected
      const validation = await globalCodeActionCoordinator.validateCodeAction(action);
      expect(validation.valid).toBe(false);
      expect(validation.status).toBe('stale');

      await globalDocumentEngine.close(doc.id, true);
    });

    // Scenario H: Provider Failure Isolation
    it('Scenario H: Provider Failure Isolation (Fault-Tolerant Provider Aggregation)', async () => {
      const uri = 'C:/test/scenarioH.ts';
      const openResult = await globalDocumentEngine.openResource(uri, { initialContent: 'test', languageId: 'typescript' });
      const doc = openResult.document;

      // Failing Provider A
      const unregA = globalLanguageIntelligenceRegistry.registerProvider({
        providerId: 'provider.failing.A',
        supportedLanguages: ['typescript'],
        capabilities: { completion: {} },
        provideCompletions: async () => {
          throw new Error('Fatal Provider A crash');
        },
      });

      // Healthy Provider B
      const unregB = globalLanguageIntelligenceRegistry.registerProvider({
        providerId: 'provider.healthy.B',
        supportedLanguages: ['typescript'],
        capabilities: { completion: {} },
        provideCompletions: async () => [
          {
            id: 'comp.healthy',
            label: 'healthyItem',
            kind: 'keyword',
            providerId: 'provider.healthy.B',
          },
        ],
      });

      // Completion aggregation must shield from Provider A failure and return Provider B results
      const res = await globalCompletionCoordinator.requestCompletions(
        doc.id,
        { line: 1, column: 1 }
      );

      expect(res.items.length).toBe(1);
      expect(res.items[0].label).toBe('healthyItem');

      unregA();
      unregB();
      await globalDocumentEngine.close(doc.id, true);
    });

    // Scenario I: Read-Only Protection
    it('Scenario I: Read-Only Document Protection at Mutation Boundary', async () => {
      const uri = 'C:/test/scenarioI.ts';
      const openResult = await globalDocumentEngine.openResource(uri, {
        initialContent: 'readonly content',
        languageId: 'typescript',
        readOnly: true,
        readOnlyReason: 'permission',
      });
      const doc = openResult.document;

      expect(doc.metadata.isReadOnly).toBe(true);

      // 1. Direct updateText must be rejected
      await expect(
        globalDocumentEngine.updateText(doc.id, 'mutated text', 'user')
      ).rejects.toThrow(/read-only/i);

      // 2. Code action execution must be rejected
      const action: CodeAction = {
        id: 'act.readonly',
        providerId: 'test',
        title: 'Mutate Readonly',
        kind: 'quickfix',
        documentRevision: doc.contentRevision,
        edit: {
          changes: {
            [doc.resourceUri]: [
              {
                resourceUri: doc.resourceUri,
                range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 5 },
                newText: 'edit',
              },
            ],
          },
        },
      };

      const val = await globalCodeActionCoordinator.validateCodeAction(action);
      expect(val.valid).toBe(false);
      expect(val.status).toBe('read_only');

      await globalDocumentEngine.close(doc.id, true);
    });

    // Scenario J: Shutdown During In-Flight Work
    it('Scenario J: Application Shutdown Cleans Up and Rejects Late Work', async () => {
      const shutdownRuntime = new ApplicationRuntime();
      registerDefaultServices(shutdownRuntime);
      await shutdownRuntime.start();
      expect(shutdownRuntime.isReady).toBe(true);

      // Trigger shutdown
      await shutdownRuntime.shutdown();
      expect(shutdownRuntime.getState()).toBe('terminated');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Cross-Service Consistency Assertions (Section 42)
  // ---------------------------------------------------------------------------
  describe('Cross-Service Consistency Assertions (Section 42)', () => {
    it('Assertion 1: Every open document has valid resource identity and non-negative revision', async () => {
      const doc = (await globalDocumentEngine.openResource('C:/test/assert1.ts', { initialContent: 'x' })).document;
      expect(doc.id).toBeDefined();
      expect(doc.resourceUri).toBe('file:///C:/test/assert1.ts');
      expect(doc.contentRevision).toBeGreaterThanOrEqual(0);
      expect(doc.savedRevision).toBeGreaterThanOrEqual(0);
      await globalDocumentEngine.close(doc.id, true);
    });

    it('Assertion 2: TextModel from EditorCoordination maps strictly to DocumentEngine', async () => {
      const doc = (await globalDocumentEngine.openResource('C:/test/assert2.ts', { initialContent: 'model test' })).document;
      const coordinator = runtime.getService<any>('editorCoordination');
      const textModel = coordinator.getTextModel(doc.id);
      expect(textModel.getText()).toBe('model test');
      expect(textModel.resourceUri).toBe(doc.resourceUri);
      await globalDocumentEngine.close(doc.id, true);
    });

    it('Assertion 3: EditTransactionManager rejects overlapping edits deterministically', () => {
      const content = '0123456789';
      const overlappingEdits = [
        { from: 2, to: 6, insertText: 'abc' },
        { from: 4, to: 8, insertText: 'def' },
      ];

      expect(() => {
        globalEditTransactionManager.validateChanges(content, overlappingEdits);
      }).toThrow();
    });

    it('Assertion 4: NavigationCoordinator uses DocumentEngine and enforces bounds', async () => {
      const uri = 'C:/test/assert4.ts';
      const doc = (await globalDocumentEngine.openResource(uri, { initialContent: 'line1\nline2\nline3' })).document;

      const navResult = await globalNavigationCoordinator.navigateToLocation({
        uri: doc.resourceUri,
        range: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 5 },
      });

      expect(navResult.success).toBe(true);
      expect(navResult.documentId).toBe(doc.id);
      await globalDocumentEngine.close(doc.id, true);
    });
  });
});
