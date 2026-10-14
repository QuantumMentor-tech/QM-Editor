/**
 * QM Editor Canonical Language Intelligence Registry
 * Phase 04, Step 42 — Language Intelligence Provider Architecture & Completion Framework
 */

import {
  LanguageIntelligenceProvider,
  LanguageIntelligenceCapability,
} from './LanguageIntelligenceTypes';
import { logger } from '../../utils/logger';

export class LanguageIntelligenceRegistry {
  private static instance: LanguageIntelligenceRegistry | null = null;
  private readonly providers: Map<string, LanguageIntelligenceProvider> = new Map();
  private isDisposed: boolean = false;

  public static getInstance(): LanguageIntelligenceRegistry {
    if (!LanguageIntelligenceRegistry.instance) {
      LanguageIntelligenceRegistry.instance = new LanguageIntelligenceRegistry();
    }
    return LanguageIntelligenceRegistry.instance;
  }

  /**
   * Registers a new language intelligence provider.
   * Throws if provider is invalid or if a provider with the same ID is already registered.
   */
  public registerProvider(provider: LanguageIntelligenceProvider): () => void {
    if (this.isDisposed) {
      throw new Error('LanguageIntelligenceRegistry is disposed.');
    }

    if (!provider || !provider.providerId || typeof provider.providerId !== 'string') {
      throw new Error('Provider must have a valid non-empty providerId string.');
    }

    if (this.providers.has(provider.providerId)) {
      throw new Error(`Duplicate language intelligence provider registration: "${provider.providerId}".`);
    }

    this.providers.set(provider.providerId, provider);
    logger.info(`LanguageIntelligenceRegistry: registered provider "${provider.providerId}"`);

    return () => {
      this.unregisterProvider(provider.providerId);
    };
  }

  /**
   * Unregisters a provider and safely invokes its disposal lifecycle method.
   */
  public unregisterProvider(providerId: string): void {
    const existing = this.providers.get(providerId);
    if (existing) {
      this.providers.delete(providerId);
      try {
        existing.dispose?.();
      } catch (err) {
        logger.error(`LanguageIntelligenceRegistry: error disposing provider "${providerId}"`, {
          error: (err as Error).message,
        });
      }
      logger.info(`LanguageIntelligenceRegistry: unregistered provider "${providerId}"`);
    }
  }

  /**
   * Retrieves all registered providers, optionally filtered by language and capability,
   * sorted deterministically by priority descending.
   */
  public getProviders(
    languageId?: string,
    capability?: LanguageIntelligenceCapability
  ): LanguageIntelligenceProvider[] {
    const all = Array.from(this.providers.values());

    return all
      .filter((p) => {
        // Language filter
        if (languageId) {
          const supportsAll =
            !p.supportedLanguages ||
            p.supportedLanguages.length === 0 ||
            p.supportedLanguages.includes('*');

          if (!supportsAll && !p.supportedLanguages.includes(languageId.toLowerCase())) {
            return false;
          }
        }

        // Capability filter
        if (capability) {
          if (capability === 'completion' && !p.capabilities?.completion) {
            return false;
          }
          if (capability === 'hover' && !p.capabilities?.hover) {
            return false;
          }
          if (capability === 'signatureHelp' && !p.capabilities?.signatureHelp) {
            return false;
          }
          if (capability === 'definition' && !p.capabilities?.definition) {
            return false;
          }
          if (capability === 'codeActions' && !p.capabilities?.codeActions) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const prioA = a.priority ?? 50;
        const prioB = b.priority ?? 50;
        if (prioA !== prioB) return prioB - prioA;
        return a.providerId.localeCompare(b.providerId);
      });
  }

  public getProvider(providerId: string): LanguageIntelligenceProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Collects all unique completion trigger characters declared by providers supporting the specified language.
   */
  public getTriggerCharacters(languageId: string): string[] {
    const providers = this.getProviders(languageId, 'completion');
    const set = new Set<string>();

    for (const p of providers) {
      const triggers = p.capabilities.completion?.triggerCharacters;
      if (triggers && Array.isArray(triggers)) {
        for (const ch of triggers) {
          if (typeof ch === 'string' && ch.length === 1) {
            set.add(ch);
          }
        }
      }
    }

    return Array.from(set);
  }

  /**
   * Retrieves all providers supporting hover for the given language.
   */
  public getHoverProviders(languageId?: string): LanguageIntelligenceProvider[] {
    return this.getProviders(languageId, 'hover');
  }

  /**
   * Retrieves all providers supporting signature help for the given language.
   */
  public getSignatureHelpProviders(languageId?: string): LanguageIntelligenceProvider[] {
    return this.getProviders(languageId, 'signatureHelp');
  }

  /**
   * Collects all unique signature help trigger characters declared by providers supporting the specified language.
   */
  public getSignatureHelpTriggerCharacters(languageId: string): string[] {
    const providers = this.getSignatureHelpProviders(languageId);
    const set = new Set<string>();

    for (const p of providers) {
      const caps = p.capabilities.signatureHelp;
      if (caps && typeof caps === 'object' && Array.isArray(caps.triggerCharacters)) {
        for (const ch of caps.triggerCharacters) {
          if (typeof ch === 'string' && ch.length === 1) {
            set.add(ch);
          }
        }
      }
    }

    return Array.from(set);
  }

  /**
   * Collects all unique signature help retrigger characters declared by providers supporting the specified language.
   */
  public getSignatureHelpRetriggerCharacters(languageId: string): string[] {
    const providers = this.getSignatureHelpProviders(languageId);
    const set = new Set<string>();

    for (const p of providers) {
      const caps = p.capabilities.signatureHelp;
      if (caps && typeof caps === 'object' && Array.isArray(caps.retriggerCharacters)) {
        for (const ch of caps.retriggerCharacters) {
          if (typeof ch === 'string' && ch.length === 1) {
            set.add(ch);
          }
        }
      }
    }

    return Array.from(set);
  }

  /**
   * Retrieves all providers supporting code actions for the given language.
   */
  public getCodeActionProviders(languageId?: string): LanguageIntelligenceProvider[] {
    return this.getProviders(languageId, 'codeActions');
  }

  public clear(): void {
    this.isDisposed = false;
    for (const p of this.providers.values()) {
      try {
        p.dispose?.();
      } catch {
        // Safe disposal
      }
    }
    this.providers.clear();
  }

  public static resetInstance(): void {
    if (LanguageIntelligenceRegistry.instance) {
      LanguageIntelligenceRegistry.instance.clear();
      LanguageIntelligenceRegistry.instance = null;
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.clear();
  }
}

export const globalLanguageIntelligenceRegistry = LanguageIntelligenceRegistry.getInstance();
