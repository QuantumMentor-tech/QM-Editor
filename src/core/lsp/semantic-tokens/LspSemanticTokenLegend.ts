/**
 * QM Editor - LSP Semantic Tokens Legend Registry
 * 
 * Manages the token types and token modifiers legends defined in LSP 3.17,
 * both default standard legends and per-server-session customized legends.
 */

import { Logger } from '../../../utils/logger';
import {
  LspSemanticTokensLegend,
  STANDARD_TOKEN_TYPES,
  STANDARD_TOKEN_MODIFIERS,
} from './LspSemanticTokenTypes';

export const DEFAULT_SEMANTIC_TOKEN_LEGEND: LspSemanticTokensLegend = {
  tokenTypes: [...STANDARD_TOKEN_TYPES],
  tokenModifiers: [...STANDARD_TOKEN_MODIFIERS],
};

interface SessionLegendData {
  legend: LspSemanticTokensLegend;
  generation: number;
}

export class LspSemanticTokenLegendRegistry {
  private static instance: LspSemanticTokenLegendRegistry | null = null;
  private readonly sessionLegends = new Map<string, SessionLegendData>();
  private globalGeneration = 0;

  private constructor() {}

  public static getInstance(): LspSemanticTokenLegendRegistry {
    if (!LspSemanticTokenLegendRegistry.instance) {
      LspSemanticTokenLegendRegistry.instance = new LspSemanticTokenLegendRegistry();
    }
    return LspSemanticTokenLegendRegistry.instance;
  }

  /**
   * Register or update the semantic tokens legend for a given server session.
   * Returns the new legend generation counter.
   */
  public registerServerLegend(sessionKey: string, rawLegend?: LspSemanticTokensLegend): number {
    const validLegend = this.sanitizeLegend(rawLegend);
    const prev = this.sessionLegends.get(sessionKey);
    const newGen = (prev ? prev.generation : 0) + 1;
    this.globalGeneration++;

    this.sessionLegends.set(sessionKey, {
      legend: validLegend,
      generation: newGen,
    });

    Logger.info(`LspSemanticTokenLegend: Registered legend for session "${sessionKey}"`, {
      tokenTypeCount: validLegend.tokenTypes.length,
      tokenModifierCount: validLegend.tokenModifiers.length,
      generation: newGen,
    });

    return newGen;
  }

  /**
   * Synchronizes server legend, only advancing generation if the legend actually changed.
   */
  public syncServerLegend(sessionKey: string, rawLegend?: LspSemanticTokensLegend): number {
    const validLegend = this.sanitizeLegend(rawLegend);
    const prev = this.sessionLegends.get(sessionKey);

    if (prev) {
      const sameTypes =
        prev.legend.tokenTypes.length === validLegend.tokenTypes.length &&
        prev.legend.tokenTypes.every((t, i) => t === validLegend.tokenTypes[i]);
      const sameMods =
        prev.legend.tokenModifiers.length === validLegend.tokenModifiers.length &&
        prev.legend.tokenModifiers.every((m, i) => m === validLegend.tokenModifiers[i]);
      if (sameTypes && sameMods) {
        return prev.generation;
      }
    }

    return this.registerServerLegend(sessionKey, rawLegend);
  }

  /**
   * Unregister legend for a terminated server session.
   */
  public unregisterServerLegend(sessionKey: string): void {
    if (this.sessionLegends.delete(sessionKey)) {
      Logger.debug(`LspSemanticTokenLegend: Unregistered legend for session "${sessionKey}"`);
    }
  }

  /**
   * Retrieve the active legend for a server session, or default legend if not found.
   */
  public getServerLegend(sessionKey?: string): LspSemanticTokensLegend {
    if (sessionKey) {
      const data = this.sessionLegends.get(sessionKey);
      if (data) {
        return data.legend;
      }
    }
    return DEFAULT_SEMANTIC_TOKEN_LEGEND;
  }

  /**
   * Get the current legend generation counter for a session.
   */
  public getLegendGeneration(sessionKey?: string): number {
    if (sessionKey) {
      const data = this.sessionLegends.get(sessionKey);
      if (data) {
        return data.generation;
      }
    }
    return 0;
  }

  /**
   * Check if a token type index is valid under the current legend.
   */
  public isValidTokenType(index: number, sessionKey?: string): boolean {
    const legend = this.getServerLegend(sessionKey);
    return Number.isInteger(index) && index >= 0 && index < legend.tokenTypes.length;
  }

  /**
   * Resolve a token type index into its string name.
   */
  public resolveTokenType(index: number, sessionKey?: string): string {
    const legend = this.getServerLegend(sessionKey);
    if (index >= 0 && index < legend.tokenTypes.length) {
      return legend.tokenTypes[index];
    }
    return 'unknown';
  }

  /**
   * Resolve a token modifier bitmask into an array of modifier string names.
   */
  public resolveTokenModifiers(bitmask: number, sessionKey?: string): string[] {
    if (!bitmask || bitmask <= 0) {
      return [];
    }

    const legend = this.getServerLegend(sessionKey);
    const modifiers: string[] = [];
    const maxBits = Math.min(32, legend.tokenModifiers.length);

    for (let bit = 0; bit < maxBits; bit++) {
      if ((bitmask & (1 << bit)) !== 0) {
        modifiers.push(legend.tokenModifiers[bit]);
      }
    }

    return modifiers;
  }

  /**
   * Clear all registered legends (useful for tests and full resets).
   */
  public clear(): void {
    this.sessionLegends.clear();
    this.globalGeneration = 0;
  }

  private sanitizeLegend(rawLegend?: LspSemanticTokensLegend): LspSemanticTokensLegend {
    if (!rawLegend || typeof rawLegend !== 'object') {
      return DEFAULT_SEMANTIC_TOKEN_LEGEND;
    }

    const tokenTypes = Array.isArray(rawLegend.tokenTypes)
      ? rawLegend.tokenTypes
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .map((t) => t.trim().replace(/[^a-zA-Z0-9_-]/g, ''))
      : [...STANDARD_TOKEN_TYPES];

    const tokenModifiers = Array.isArray(rawLegend.tokenModifiers)
      ? rawLegend.tokenModifiers
          .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
          .map((m) => m.trim().replace(/[^a-zA-Z0-9_-]/g, ''))
      : [...STANDARD_TOKEN_MODIFIERS];

    return {
      tokenTypes: tokenTypes.length > 0 ? tokenTypes : [...STANDARD_TOKEN_TYPES],
      tokenModifiers: tokenModifiers.length > 0 ? tokenModifiers : [...STANDARD_TOKEN_MODIFIERS],
    };
  }
}

export const globalSemanticTokenLegend = LspSemanticTokenLegendRegistry.getInstance();
