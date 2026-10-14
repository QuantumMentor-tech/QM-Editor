/**
 * QM Editor Language Intelligence Registry Unit Tests
 * Phase 04, Step 42 — Language Intelligence Provider Architecture & Completion Framework
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  LanguageIntelligenceRegistry,
} from './LanguageIntelligenceRegistry';
import {
  LanguageIntelligenceProvider,
} from './LanguageIntelligenceTypes';

describe('LanguageIntelligenceRegistry', () => {
  let registry: LanguageIntelligenceRegistry;

  beforeEach(() => {
    LanguageIntelligenceRegistry.resetInstance();
    registry = LanguageIntelligenceRegistry.getInstance();
  });

  afterEach(() => {
    registry.dispose();
  });

  it('registers and retrieves a provider successfully', () => {
    const dummyProvider: LanguageIntelligenceProvider = {
      providerId: 'test.ts.provider',
      displayName: 'TypeScript Provider',
      supportedLanguages: ['typescript'],
      priority: 80,
      capabilities: {
        completion: {
          triggerCharacters: ['.', ':'],
        },
      },
      provideCompletions: async () => [],
    };

    const unregister = registry.registerProvider(dummyProvider);
    expect(registry.getProvider('test.ts.provider')).toBe(dummyProvider);

    const providers = registry.getProviders('typescript', 'completion');
    expect(providers).toHaveLength(1);
    expect(providers[0].providerId).toBe('test.ts.provider');

    unregister();
    expect(registry.getProvider('test.ts.provider')).toBeUndefined();
  });

  it('prevents duplicate provider registration', () => {
    const providerA: LanguageIntelligenceProvider = {
      providerId: 'shared.provider',
      supportedLanguages: ['*'],
      capabilities: { completion: {} },
    };
    const providerB: LanguageIntelligenceProvider = {
      providerId: 'shared.provider',
      supportedLanguages: ['*'],
      capabilities: { completion: {} },
    };

    registry.registerProvider(providerA);
    expect(() => registry.registerProvider(providerB)).toThrow(
      /Duplicate language intelligence provider registration/
    );
  });

  it('validates providerId format', () => {
    expect(() =>
      registry.registerProvider({
        providerId: '',
        supportedLanguages: ['*'],
        capabilities: {},
      })
    ).toThrow(/valid non-empty providerId/);
  });

  it('filters providers accurately by language', () => {
    const tsProvider: LanguageIntelligenceProvider = {
      providerId: 'provider.ts',
      supportedLanguages: ['typescript'],
      capabilities: { completion: {} },
    };
    const pyProvider: LanguageIntelligenceProvider = {
      providerId: 'provider.py',
      supportedLanguages: ['python'],
      capabilities: { completion: {} },
    };
    const universalProvider: LanguageIntelligenceProvider = {
      providerId: 'provider.universal',
      supportedLanguages: ['*'],
      capabilities: { completion: {} },
    };

    registry.registerProvider(tsProvider);
    registry.registerProvider(pyProvider);
    registry.registerProvider(universalProvider);

    const tsProviders = registry.getProviders('typescript');
    expect(tsProviders.map((p) => p.providerId)).toEqual(
      expect.arrayContaining(['provider.ts', 'provider.universal'])
    );
    expect(tsProviders.map((p) => p.providerId)).not.toContain('provider.py');

    const pyProviders = registry.getProviders('python');
    expect(pyProviders.map((p) => p.providerId)).toEqual(
      expect.arrayContaining(['provider.py', 'provider.universal'])
    );
    expect(pyProviders.map((p) => p.providerId)).not.toContain('provider.ts');
  });

  it('filters providers by capability', () => {
    const completionProvider: LanguageIntelligenceProvider = {
      providerId: 'provider.completion',
      supportedLanguages: ['*'],
      capabilities: {
        completion: {},
      },
    };
    const hoverProvider: LanguageIntelligenceProvider = {
      providerId: 'provider.hover',
      supportedLanguages: ['*'],
      capabilities: {
        hover: {},
      },
    };

    registry.registerProvider(completionProvider);
    registry.registerProvider(hoverProvider);

    const completionMatches = registry.getProviders(undefined, 'completion');
    expect(completionMatches.map((p) => p.providerId)).toEqual(['provider.completion']);

    const hoverMatches = registry.getProviders(undefined, 'hover');
    expect(hoverMatches.map((p) => p.providerId)).toEqual(['provider.hover']);
  });

  it('sorts providers deterministically by priority descending and ID', () => {
    const lowPrio: LanguageIntelligenceProvider = {
      providerId: 'provider.low',
      priority: 10,
      supportedLanguages: ['*'],
      capabilities: { completion: {} },
    };
    const highPrio: LanguageIntelligenceProvider = {
      providerId: 'provider.high',
      priority: 90,
      supportedLanguages: ['*'],
      capabilities: { completion: {} },
    };
    const midPrioA: LanguageIntelligenceProvider = {
      providerId: 'provider.mid.a',
      priority: 50,
      supportedLanguages: ['*'],
      capabilities: { completion: {} },
    };
    const midPrioB: LanguageIntelligenceProvider = {
      providerId: 'provider.mid.b',
      priority: 50,
      supportedLanguages: ['*'],
      capabilities: { completion: {} },
    };

    registry.registerProvider(lowPrio);
    registry.registerProvider(highPrio);
    registry.registerProvider(midPrioB);
    registry.registerProvider(midPrioA);

    const sorted = registry.getProviders();
    expect(sorted.map((p) => p.providerId)).toEqual([
      'provider.high',
      'provider.mid.a',
      'provider.mid.b',
      'provider.low',
    ]);
  });

  it('collects valid trigger characters for language', () => {
    const provider1: LanguageIntelligenceProvider = {
      providerId: 'provider.1',
      supportedLanguages: ['javascript'],
      capabilities: {
        completion: {
          triggerCharacters: ['.', '(', 'invalid-multi'],
        },
      },
    };
    const provider2: LanguageIntelligenceProvider = {
      providerId: 'provider.2',
      supportedLanguages: ['javascript'],
      capabilities: {
        completion: {
          triggerCharacters: ['.', ':', '>'],
        },
      },
    };

    registry.registerProvider(provider1);
    registry.registerProvider(provider2);

    const triggers = registry.getTriggerCharacters('javascript');
    expect(triggers.sort()).toEqual(['(', '.', ':', '>'].sort());
  });

  it('safely handles provider disposal and unregistration', () => {
    const disposeFn = vi.fn();
    const provider: LanguageIntelligenceProvider = {
      providerId: 'provider.disposable',
      supportedLanguages: ['*'],
      capabilities: {},
      dispose: disposeFn,
    };

    registry.registerProvider(provider);
    registry.unregisterProvider('provider.disposable');
    expect(disposeFn).toHaveBeenCalledTimes(1);

    // Unregister non-existent doesn't throw
    expect(() => registry.unregisterProvider('non.existent')).not.toThrow();
  });
});
