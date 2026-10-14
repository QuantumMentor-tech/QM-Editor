/**
 * QM Editor Hover Coordinator Unit Tests
 * Phase 04, Step 43 — Hover Information, Signature Help & Contextual Language Intelligence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  HoverCoordinator,
} from './HoverCoordinator';
import {
  LanguageIntelligenceRegistry,
} from './LanguageIntelligenceRegistry';
import {
  LanguageIntelligenceProvider,
} from './LanguageIntelligenceTypes';
import { globalDocumentEngine, DocumentEngine } from '../documents/DocumentEngine';

describe('HoverCoordinator', () => {
  let registry: LanguageIntelligenceRegistry;
  let coordinator: HoverCoordinator;
  let docEngine: DocumentEngine;

  beforeEach(() => {
    LanguageIntelligenceRegistry.getInstance().clear();
    HoverCoordinator.resetInstance();

    registry = LanguageIntelligenceRegistry.getInstance();
    docEngine = globalDocumentEngine;
    coordinator = HoverCoordinator.getInstance();
  });

  afterEach(() => {
    coordinator.dispose();
  });

  it('returns null when document is not found', async () => {
    const res = await coordinator.requestHover('nonexistent-doc', { line: 1, column: 1 });
    expect(res).toBeNull();
  });

  it('returns null when no hover provider supports the active language', async () => {
    const { document: doc } = await docEngine.openResource('C:/test/file.unknown', {
      initialContent: 'hello world',
      languageId: 'plaintext',
    });

    const res = await coordinator.requestHover(doc.id, { line: 1, column: 1 });
    expect(res).toBeNull();
  });

  it('queries compatible hover provider and normalizes HoverResult', async () => {
    const { document: doc } = await docEngine.openResource('C:/test/app.ts', {
      initialContent: 'const greeting = "Hello";',
      languageId: 'typescript',
    });

    const mockProvider: LanguageIntelligenceProvider = {
      providerId: 'ts.hover.provider',
      displayName: 'TypeScript Hover Provider',
      supportedLanguages: ['typescript'],
      priority: 80,
      capabilities: {
        hover: {},
      },
      provideHover: async (req) => {
        return {
          contents: [
            { language: 'typescript', value: 'const greeting: string' },
            'Stores greeting message.',
          ],
          range: {
            startLine: req.position.line,
            startColumn: 7,
            endLine: req.position.line,
            endColumn: 15,
          },
          location: {
            uri: req.uri,
            range: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 15 },
          },
          providerId: 'ts.hover.provider',
          requestId: req.requestId,
          generation: 1,
          revision: req.revision,
        };
      },
    };

    registry.registerProvider(mockProvider);

    const result = await coordinator.requestHover(doc.id, { line: 1, column: 8 });
    expect(result).not.toBeNull();
    expect(result?.providerId).toBe('ts.hover.provider');
    expect(result?.contents).toHaveLength(2);
    expect(result?.range).toEqual({ startLine: 1, startColumn: 7, endLine: 1, endColumn: 15 });
    expect(result?.location?.uri).toBe(doc.resourceUri);
  });

  it('aggregates contents from multiple providers in priority order', async () => {
    const { document: doc } = await docEngine.openResource('C:/test/calc.py', {
      initialContent: 'import math',
      languageId: 'python',
    });

    const lowPrioProvider: LanguageIntelligenceProvider = {
      providerId: 'py.low.hover',
      supportedLanguages: ['python'],
      priority: 20,
      capabilities: { hover: {} },
      provideHover: async () => ({
        contents: ['Low priority documentation note.'],
        providerId: 'py.low.hover',
        requestId: '',
        generation: 0,
        revision: 0,
      }),
    };

    const highPrioProvider: LanguageIntelligenceProvider = {
      providerId: 'py.high.hover',
      supportedLanguages: ['python'],
      priority: 90,
      capabilities: { hover: {} },
      provideHover: async () => ({
        contents: [{ language: 'python', value: 'module math' }],
        range: { startLine: 1, startColumn: 8, endLine: 1, endColumn: 12 },
        providerId: 'py.high.hover',
        requestId: '',
        generation: 0,
        revision: 0,
      }),
    };

    registry.registerProvider(lowPrioProvider);
    registry.registerProvider(highPrioProvider);

    const result = await coordinator.requestHover(doc.id, { line: 1, column: 9 });
    expect(result).not.toBeNull();
    expect(result?.providerId).toBe('py.high.hover');
    expect(result?.contents).toHaveLength(2);
    // Highest priority provider content appears first
    expect(result?.contents[0]).toEqual({ language: 'python', value: 'module math' });
    expect(result?.contents[1]).toBe('Low priority documentation note.');
    expect(result?.range).toEqual({ startLine: 1, startColumn: 8, endLine: 1, endColumn: 12 });
  });

  it('isolates provider failures without crashing coordinator or other providers', async () => {
    const { document: doc } = await docEngine.openResource('C:/test/fail.js', {
      initialContent: 'let num = 100;',
      languageId: 'javascript',
    });

    const explodingProvider: LanguageIntelligenceProvider = {
      providerId: 'js.exploding.hover',
      supportedLanguages: ['javascript'],
      capabilities: { hover: {} },
      provideHover: async () => {
        throw new Error('Fatal hover parser crash!');
      },
    };

    const safeProvider: LanguageIntelligenceProvider = {
      providerId: 'js.safe.hover',
      supportedLanguages: ['javascript'],
      capabilities: { hover: {} },
      provideHover: async () => ({
        contents: ['let num: number'],
        providerId: 'js.safe.hover',
        requestId: '',
        generation: 0,
        revision: 0,
      }),
    };

    registry.registerProvider(explodingProvider);
    registry.registerProvider(safeProvider);

    const result = await coordinator.requestHover(doc.id, { line: 1, column: 5 });
    expect(result).not.toBeNull();
    expect(result?.contents[0]).toBe('let num: number');
  });

  it('discards stale hover results if document revision advances during request', async () => {
    const { document: doc } = await docEngine.openResource('C:/test/stale.ts', {
      initialContent: 'let count = 0;',
      languageId: 'typescript',
    });

    const slowProvider: LanguageIntelligenceProvider = {
      providerId: 'ts.slow.hover',
      supportedLanguages: ['typescript'],
      capabilities: { hover: {} },
      provideHover: async (_req, token) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (token?.isCancellationRequested) return null;
        return {
          contents: ['let count: number'],
          providerId: 'ts.slow.hover',
          requestId: '',
          generation: 0,
          revision: 0,
        };
      },
    };

    registry.registerProvider(slowProvider);

    const hoverPromise = coordinator.requestHover(doc.id, { line: 1, column: 5 });

    // Mutate document to increment revision
    await docEngine.updateText(doc.id, 'let count = 1;');

    const result = await hoverPromise;
    expect(result).toBeNull();
  });

  it('leverages cache for identical position and revision', async () => {
    const { document: doc } = await docEngine.openResource('C:/test/cache.ts', {
      initialContent: 'const pi = 3.14;',
      languageId: 'typescript',
    });

    let calls = 0;
    const countingProvider: LanguageIntelligenceProvider = {
      providerId: 'ts.counting.hover',
      supportedLanguages: ['typescript'],
      capabilities: { hover: {} },
      provideHover: async () => {
        calls++;
        return {
          contents: ['const pi: 3.14'],
          providerId: 'ts.counting.hover',
          requestId: '',
          generation: 0,
          revision: 0,
        };
      },
    };

    registry.registerProvider(countingProvider);

    const res1 = await coordinator.requestHover(doc.id, { line: 1, column: 7 });
    expect(res1?.contents[0]).toBe('const pi: 3.14');
    expect(calls).toBe(1);

    const res2 = await coordinator.requestHover(doc.id, { line: 1, column: 7 });
    expect(res2?.contents[0]).toBe('const pi: 3.14');
    expect(calls).toBe(1); // Cached, provider not re-called
  });
});
