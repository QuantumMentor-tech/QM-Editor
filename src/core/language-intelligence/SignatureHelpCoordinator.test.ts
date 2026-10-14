/**
 * QM Editor Signature Help Coordinator Unit Tests
 * Phase 04, Step 43 — Hover Information, Signature Help & Contextual Language Intelligence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SignatureHelpCoordinator,
} from './SignatureHelpCoordinator';
import {
  LanguageIntelligenceRegistry,
} from './LanguageIntelligenceRegistry';
import {
  LanguageIntelligenceProvider,
} from './LanguageIntelligenceTypes';
import { globalDocumentEngine, DocumentEngine } from '../documents/DocumentEngine';

describe('SignatureHelpCoordinator', () => {
  let registry: LanguageIntelligenceRegistry;
  let coordinator: SignatureHelpCoordinator;
  let docEngine: DocumentEngine;

  beforeEach(() => {
    LanguageIntelligenceRegistry.getInstance().clear();
    SignatureHelpCoordinator.resetInstance();

    registry = LanguageIntelligenceRegistry.getInstance();
    docEngine = globalDocumentEngine;
    coordinator = SignatureHelpCoordinator.getInstance();
  });

  afterEach(() => {
    coordinator.dispose();
  });

  it('returns null when document is not found', async () => {
    const res = await coordinator.requestSignatureHelp('nonexistent-doc', { line: 1, column: 1 });
    expect(res).toBeNull();
  });

  it('returns null when no signature provider supports language', async () => {
    const { document: doc } = await docEngine.openResource('C:/test/file.txt', {
      initialContent: 'call(1, 2)',
      languageId: 'plaintext',
    });

    const res = await coordinator.requestSignatureHelp(doc.id, { line: 1, column: 6 });
    expect(res).toBeNull();
  });

  it('queries compatible signature provider and normalizes result', async () => {
    const { document: doc } = await docEngine.openResource('C:/test/math.ts', {
      initialContent: 'Math.max(10, 20)',
      languageId: 'typescript',
    });

    const mockProvider: LanguageIntelligenceProvider = {
      providerId: 'ts.sig.provider',
      displayName: 'TypeScript Signature Provider',
      supportedLanguages: ['typescript'],
      priority: 80,
      capabilities: {
        signatureHelp: {
          triggerCharacters: ['(', ','],
        },
      },
      provideSignatureHelp: async (req) => {
        return {
          signatures: [
            {
              label: 'Math.max(...values: number[]): number',
              documentation: 'Returns the largest of the given numbers.',
              parameters: [
                {
                  label: '...values: number[]',
                  documentation: 'Numbers to compare.',
                },
              ],
            },
          ],
          activeSignature: 0,
          activeParameter: 0,
          providerId: 'ts.sig.provider',
          requestId: req.requestId,
          generation: 1,
          revision: req.revision,
        };
      },
    };

    registry.registerProvider(mockProvider);

    const result = await coordinator.requestSignatureHelp(doc.id, { line: 1, column: 10 }, {
      triggerKind: 'triggerCharacter',
      triggerCharacter: '(',
    });

    expect(result).not.toBeNull();
    expect(result?.providerId).toBe('ts.sig.provider');
    expect(result?.signatures).toHaveLength(1);
    expect(result?.signatures[0].label).toContain('Math.max');
    expect(result?.activeSignature).toBe(0);
    expect(result?.activeParameter).toBe(0);
  });

  it('picks highest priority provider when multiple providers return signatures', async () => {
    const { document: doc } = await docEngine.openResource('C:/test/format.js', {
      initialContent: 'formatText("val", 2)',
      languageId: 'javascript',
    });

    const lowPrioProvider: LanguageIntelligenceProvider = {
      providerId: 'js.low.sig',
      supportedLanguages: ['javascript'],
      priority: 10,
      capabilities: { signatureHelp: {} },
      provideSignatureHelp: async () => ({
        signatures: [{ label: 'formatText(val)', parameters: [] }],
        activeSignature: 0,
        activeParameter: 0,
        providerId: 'js.low.sig',
        requestId: '',
        generation: 0,
        revision: 0,
      }),
    };

    const highPrioProvider: LanguageIntelligenceProvider = {
      providerId: 'js.high.sig',
      supportedLanguages: ['javascript'],
      priority: 95,
      capabilities: { signatureHelp: {} },
      provideSignatureHelp: async () => ({
        signatures: [
          {
            label: 'formatText(val: string, indent: number): string',
            parameters: [{ label: 'val: string' }, { label: 'indent: number' }],
          },
        ],
        activeSignature: 0,
        activeParameter: 1,
        providerId: 'js.high.sig',
        requestId: '',
        generation: 0,
        revision: 0,
      }),
    };

    registry.registerProvider(lowPrioProvider);
    registry.registerProvider(highPrioProvider);

    const result = await coordinator.requestSignatureHelp(doc.id, { line: 1, column: 18 });
    expect(result).not.toBeNull();
    expect(result?.providerId).toBe('js.high.sig');
    expect(result?.activeParameter).toBe(1);
  });

  it('clamps activeSignature and activeParameter safely within bounds', async () => {
    const { document: doc } = await docEngine.openResource('C:/test/bounds.ts', {
      initialContent: 'fn()',
      languageId: 'typescript',
    });

    const outOfBoundsProvider: LanguageIntelligenceProvider = {
      providerId: 'ts.oob.sig',
      supportedLanguages: ['typescript'],
      capabilities: { signatureHelp: {} },
      provideSignatureHelp: async () => ({
        signatures: [
          {
            label: 'fn(a: string): void',
            parameters: [{ label: 'a: string' }],
          },
        ],
        activeSignature: 999, // Out of bounds
        activeParameter: 888, // Out of bounds
        providerId: 'ts.oob.sig',
        requestId: '',
        generation: 0,
        revision: 0,
      }),
    };

    registry.registerProvider(outOfBoundsProvider);

    const result = await coordinator.requestSignatureHelp(doc.id, { line: 1, column: 4 });
    expect(result).not.toBeNull();
    expect(result?.activeSignature).toBe(0); // Clamped to max index (0)
    expect(result?.activeParameter).toBe(0); // Clamped to max index (0)
  });

  it('isolates provider failures without crashing coordinator', async () => {
    const { document: doc } = await docEngine.openResource('C:/test/err.py', {
      initialContent: 'print("hi")',
      languageId: 'python',
    });

    const explodingProvider: LanguageIntelligenceProvider = {
      providerId: 'py.exploding.sig',
      supportedLanguages: ['python'],
      capabilities: { signatureHelp: {} },
      provideSignatureHelp: async () => {
        throw new Error('Fatal signature parser failure!');
      },
    };

    const healthyProvider: LanguageIntelligenceProvider = {
      providerId: 'py.healthy.sig',
      supportedLanguages: ['python'],
      capabilities: { signatureHelp: {} },
      provideSignatureHelp: async () => ({
        signatures: [{ label: 'print(*values: object): void', parameters: [] }],
        activeSignature: 0,
        activeParameter: 0,
        providerId: 'py.healthy.sig',
        requestId: '',
        generation: 0,
        revision: 0,
      }),
    };

    registry.registerProvider(explodingProvider);
    registry.registerProvider(healthyProvider);

    const result = await coordinator.requestSignatureHelp(doc.id, { line: 1, column: 7 });
    expect(result).not.toBeNull();
    expect(result?.providerId).toBe('py.healthy.sig');
  });

  it('discards stale signature results if document revision advances during request', async () => {
    const { document: doc } = await docEngine.openResource('C:/test/sig-stale.ts', {
      initialContent: 'call(',
      languageId: 'typescript',
    });

    const slowProvider: LanguageIntelligenceProvider = {
      providerId: 'ts.slow.sig',
      supportedLanguages: ['typescript'],
      capabilities: { signatureHelp: {} },
      provideSignatureHelp: async (_req, token) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (token?.isCancellationRequested) return null;
        return {
          signatures: [{ label: 'call(x: number): void', parameters: [] }],
          activeSignature: 0,
          activeParameter: 0,
          providerId: 'ts.slow.sig',
          requestId: '',
          generation: 0,
          revision: 0,
        };
      },
    };

    registry.registerProvider(slowProvider);

    const sigPromise = coordinator.requestSignatureHelp(doc.id, { line: 1, column: 5 });

    // Advance revision
    await docEngine.updateText(doc.id, 'call(1, ');

    const result = await sigPromise;
    expect(result).toBeNull();
  });
});
