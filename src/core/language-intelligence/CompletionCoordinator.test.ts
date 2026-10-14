/**
 * QM Editor Completion Coordinator Unit Tests
 * Phase 04, Step 42 — Language Intelligence Provider Architecture & Completion Framework
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CompletionCoordinator,
  rangeToOffsets,
} from './CompletionCoordinator';
import {
  LanguageIntelligenceRegistry,
} from './LanguageIntelligenceRegistry';
import {
  LanguageIntelligenceProvider,
  CompletionItem,
} from './LanguageIntelligenceTypes';
import { globalDocumentEngine, DocumentEngine } from '../documents/DocumentEngine';

describe('CompletionCoordinator', () => {
  let registry: LanguageIntelligenceRegistry;
  let coordinator: CompletionCoordinator;
  let docEngine: DocumentEngine;

  beforeEach(() => {
    LanguageIntelligenceRegistry.getInstance().clear();
    CompletionCoordinator.resetInstance();

    registry = LanguageIntelligenceRegistry.getInstance();
    docEngine = globalDocumentEngine;
    coordinator = CompletionCoordinator.getInstance();
  });

  afterEach(() => {
    coordinator.dispose();
  });

  describe('rangeToOffsets', () => {
    const sampleDoc = 'alpha\nbeta gamma\ndelta';

    it('calculates 0-based offsets for line and column correctly', () => {
      // Line 1, Col 1 to Col 6 -> 'alpha' (0 to 5)
      const r1 = rangeToOffsets(
        { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
        sampleDoc
      );
      expect(r1).toEqual({ from: 0, to: 5 });

      // Line 2, Col 6 to 11 -> 'gamma' (11 to 16)
      const r2 = rangeToOffsets(
        { startLine: 2, startColumn: 6, endLine: 2, endColumn: 11 },
        sampleDoc
      );
      expect(r2).toEqual({ from: 11, to: 16 });
    });

    it('clamps coordinates safely when lines/columns exceed bounds', () => {
      const clamped = rangeToOffsets(
        { startLine: 10, startColumn: 50, endLine: 20, endColumn: 100 },
        sampleDoc
      );
      expect(clamped.from).toBe(sampleDoc.length);
      expect(clamped.to).toBe(sampleDoc.length);
    });
  });

  describe('requestCompletions', () => {
    it('returns empty result when document is not found', async () => {
      const result = await coordinator.requestCompletions('nonexistent-doc', { line: 1, column: 1 });
      expect(result.items).toEqual([]);
    });

    it('uses fallback WordCompletionProvider for general buffer words', async () => {
      const { document: doc } = await docEngine.openResource('C:/test/test.ts', {
        initialContent: 'const calculateTotal = 100;\ncalc',
        languageId: 'typescript',
      });

      // Request completion at line 2, col 5 (after "calc")
      const result = await coordinator.requestCompletions(doc.id, { line: 2, column: 5 });
      expect(result.items.length).toBeGreaterThan(0);

      const match = result.items.find((item) => item.label === 'calculateTotal');
      expect(match).toBeDefined();
      expect(match?.kind).toBe('text');
      expect(match?.range).toEqual({
        startLine: 2,
        startColumn: 1,
        endLine: 2,
        endColumn: 5,
      });
    });

    it('prioritizes language-specific provider completions over word fallback', async () => {
      const { document: doc } = await docEngine.openResource('C:/test/service.ts', {
        initialContent: 'function test() { console. }',
        languageId: 'typescript',
      });

      const mockProvider: LanguageIntelligenceProvider = {
        providerId: 'ts.lang.service',
        displayName: 'TypeScript Language Service',
        supportedLanguages: ['typescript'],
        priority: 100, // Higher than word provider (5)
        capabilities: {
          completion: {
            triggerCharacters: ['.'],
          },
        },
        provideCompletions: async () => [
          {
            id: 'ts:log',
            label: 'log',
            kind: 'method',
            insertText: 'log()',
            detail: '(method) Console.log(...data: any[]): void',
            priority: 100,
          },
        ],
      };

      registry.registerProvider(mockProvider);

      const result = await coordinator.requestCompletions(doc.id, { line: 1, column: 27 }, {
        triggerKind: 'triggerCharacter',
        triggerCharacter: '.',
      });

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items[0].label).toBe('log');
      expect(result.items[0].kind).toBe('method');
      expect(result.items[0].providerId).toBe('ts.lang.service');
    });

    it('deduplicates items with identical label, insertText, and kind (higher priority wins)', async () => {
      const { document: doc } = await docEngine.openResource('C:/test/app.js', {
        initialContent: 'data',
        languageId: 'javascript',
      });

      const providerLow: LanguageIntelligenceProvider = {
        providerId: 'provider.low',
        supportedLanguages: ['javascript'],
        priority: 10,
        capabilities: { completion: {} },
        provideCompletions: async () => [
          { id: '1', label: 'formatString', kind: 'function', detail: 'Low detail', priority: 10 },
        ],
      };

      const providerHigh: LanguageIntelligenceProvider = {
        providerId: 'provider.high',
        supportedLanguages: ['javascript'],
        priority: 90,
        capabilities: { completion: {} },
        provideCompletions: async () => [
          { id: '2', label: 'formatString', kind: 'function', detail: 'High detail', priority: 90 },
        ],
      };

      registry.registerProvider(providerLow);
      registry.registerProvider(providerHigh);

      const result = await coordinator.requestCompletions(doc.id, { line: 1, column: 5 });
      const duplicates = result.items.filter((i) => i.label === 'formatString');

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0].detail).toBe('High detail');
      expect(duplicates[0].providerId).toBe('provider.high');
    });

    it('isolates provider failures without crashing other providers or coordinator', async () => {
      const { document: doc } = await docEngine.openResource('C:/test/main.py', {
        initialContent: 'imp',
        languageId: 'python',
      });

      const failingProvider: LanguageIntelligenceProvider = {
        providerId: 'provider.failing',
        supportedLanguages: ['python'],
        capabilities: { completion: {} },
        provideCompletions: async () => {
          throw new Error('Fatal provider explosion!');
        },
      };

      const healthyProvider: LanguageIntelligenceProvider = {
        providerId: 'provider.healthy',
        supportedLanguages: ['python'],
        capabilities: { completion: {} },
        provideCompletions: async () => [
          { id: 'py:import', label: 'import', kind: 'keyword' },
        ],
      };

      registry.registerProvider(failingProvider);
      registry.registerProvider(healthyProvider);

      const result = await coordinator.requestCompletions(doc.id, { line: 1, column: 4 });
      expect(result.items.some((i) => i.label === 'import')).toBe(true);
    });

    it('discards stale results if document revision advances during request', async () => {
      const { document: doc } = await docEngine.openResource('C:/test/calc.js', {
        initialContent: 'let x = 1;',
        languageId: 'javascript',
      });

      const slowProvider: LanguageIntelligenceProvider = {
        providerId: 'provider.slow',
        supportedLanguages: ['javascript'],
        capabilities: { completion: {} },
        provideCompletions: async (_req, token) => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          if (token?.isCancellationRequested) return [];
          return [{ id: 'slow:item', label: 'slowItem', kind: 'variable' }];
        },
      };

      registry.registerProvider(slowProvider);

      const completionPromise = coordinator.requestCompletions(doc.id, { line: 1, column: 5 });

      // Mutate document content to advance revision
      await docEngine.updateText(doc.id, 'let x = 2;');

      const result = await completionPromise;
      expect(result.items).toHaveLength(0);
    });
  });

  describe('applyCompletion', () => {
    it('applies completion and modifies document content via EditTransaction', async () => {
      const { document: doc } = await docEngine.openResource('C:/test/index.ts', {
        initialContent: 'const val = get',
        languageId: 'typescript',
      });

      const completionItem: CompletionItem = {
        id: 'item:getUser',
        label: 'getUser',
        insertText: 'getUser()',
        kind: 'function',
        range: {
          startLine: 1,
          startColumn: 13,
          endLine: 1,
          endColumn: 16,
        },
      };

      const initialRevision = doc.contentRevision;
      const result = await coordinator.applyCompletion(doc.id, completionItem, initialRevision);
      expect(result.success).toBe(true);
      expect(result.appliedText).toBe('getUser()');

      const updatedDoc = docEngine.getDocument(doc.id);
      expect(updatedDoc?.content).toBe('const val = getUser()');
      expect(updatedDoc?.contentRevision).toBeGreaterThan(initialRevision);
    });

    it('rejects applying completion to a read-only document', async () => {
      const { document: doc } = await docEngine.openResource('C:/test/locked.ts', {
        initialContent: 'read only content',
        languageId: 'typescript',
        readOnly: true,
      });

      const completionItem: CompletionItem = {
        id: 'item:test',
        label: 'test',
        kind: 'text',
      };

      const result = await coordinator.applyCompletion(doc.id, completionItem);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('read_only');

      const unmodifiedDoc = docEngine.getDocument(doc.id);
      expect(unmodifiedDoc?.content).toBe('read only content');
    });

    it('rejects applying completion when revision is stale', async () => {
      const { document: doc } = await docEngine.openResource('C:/test/version.ts', {
        initialContent: 'version 1',
        languageId: 'typescript',
      });

      const initialRevision = doc.contentRevision;

      // Edit document to increment revision
      await docEngine.updateText(doc.id, 'version 2');

      const completionItem: CompletionItem = {
        id: 'item:newVersion',
        label: 'newVersion',
        kind: 'text',
      };

      // Try applying with stale initial revision
      const result = await coordinator.applyCompletion(doc.id, completionItem, initialRevision);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('stale');
    });
  });
});
