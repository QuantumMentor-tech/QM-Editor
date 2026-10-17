/**
 * QM Editor - LSP Semantic Tokens Legend Test Suite
 * Phase 06, Step 64 — LSP Semantic Tokens, Semantic Highlighting & Incremental Token Synchronization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  LspSemanticTokenLegendRegistry,
  DEFAULT_SEMANTIC_TOKEN_LEGEND,
} from './LspSemanticTokenLegend';

describe('LspSemanticTokenLegendRegistry', () => {
  let registry: LspSemanticTokenLegendRegistry;

  beforeEach(() => {
    registry = LspSemanticTokenLegendRegistry.getInstance();
    registry.clear();
  });

  it('provides default standard legend when session has no custom registration', () => {
    const legend = registry.getServerLegend('unregistered-session');
    expect(legend).toEqual(DEFAULT_SEMANTIC_TOKEN_LEGEND);
    expect(legend.tokenTypes).toContain('function');
    expect(legend.tokenTypes).toContain('variable');
    expect(legend.tokenModifiers).toContain('readonly');
    expect(legend.tokenModifiers).toContain('declaration');
  });

  it('registers and retrieves custom server session legend with monotonic generation counter', () => {
    const customLegend = {
      tokenTypes: ['myCustomType', 'function'],
      tokenModifiers: ['customMod', 'readonly'],
    };

    const gen1 = registry.registerServerLegend('session-1', customLegend);
    expect(gen1).toBe(1);
    expect(registry.getLegendGeneration('session-1')).toBe(1);

    const retrieved = registry.getServerLegend('session-1');
    expect(retrieved.tokenTypes).toEqual(['myCustomType', 'function']);
    expect(retrieved.tokenModifiers).toEqual(['customMod', 'readonly']);

    // Re-registering updates generation
    const gen2 = registry.registerServerLegend('session-1', customLegend);
    expect(gen2).toBe(2);
    expect(registry.getLegendGeneration('session-1')).toBe(2);
  });

  it('unregisters session legend and falls back to default', () => {
    registry.registerServerLegend('session-temp', {
      tokenTypes: ['tempType'],
      tokenModifiers: [],
    });

    expect(registry.resolveTokenType(0, 'session-temp')).toBe('tempType');

    registry.unregisterServerLegend('session-temp');
    expect(registry.getServerLegend('session-temp')).toEqual(DEFAULT_SEMANTIC_TOKEN_LEGEND);
  });

  it('resolves token type by index and validates index boundary', () => {
    registry.registerServerLegend('session-test', {
      tokenTypes: ['alpha', 'beta'],
      tokenModifiers: [],
    });

    expect(registry.isValidTokenType(0, 'session-test')).toBe(true);
    expect(registry.isValidTokenType(1, 'session-test')).toBe(true);
    expect(registry.isValidTokenType(2, 'session-test')).toBe(false);
    expect(registry.isValidTokenType(-1, 'session-test')).toBe(false);

    expect(registry.resolveTokenType(0, 'session-test')).toBe('alpha');
    expect(registry.resolveTokenType(1, 'session-test')).toBe('beta');
    expect(registry.resolveTokenType(99, 'session-test')).toBe('unknown');
  });

  it('resolves modifier bitmasks into name arrays', () => {
    registry.registerServerLegend('session-mods', {
      tokenTypes: ['type'],
      tokenModifiers: ['modA', 'modB', 'modC'],
    });

    // bit 0: modA (1), bit 2: modC (4) => mask 5
    expect(registry.resolveTokenModifiers(5, 'session-mods')).toEqual(['modA', 'modC']);
    // mask 0 => []
    expect(registry.resolveTokenModifiers(0, 'session-mods')).toEqual([]);
    // negative or invalid mask => []
    expect(registry.resolveTokenModifiers(-1, 'session-mods')).toEqual([]);
  });

  it('sanitizes token type and modifier names against HTML and XSS injection', () => {
    registry.registerServerLegend('session-xss', {
      tokenTypes: ['<script>alert("xss")</script>', 'valid_type-1', '   bad space   '],
      tokenModifiers: ['style="background:red"', 'normalMod'],
    });

    const legend = registry.getServerLegend('session-xss');
    // Non-alphanumeric/underscore/hyphen characters stripped
    expect(legend.tokenTypes[0]).toBe('scriptalertxssscript');
    expect(legend.tokenTypes[1]).toBe('valid_type-1');
    expect(legend.tokenTypes[2]).toBe('badspace');

    expect(legend.tokenModifiers[0]).toBe('stylebackgroundred');
    expect(legend.tokenModifiers[1]).toBe('normalMod');
  });
});
