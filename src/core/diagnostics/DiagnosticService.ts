/**
 * QM Editor Canonical Diagnostic Aggregator & Service
 * Phase 04, Step 34 & Step 40 — Core Engine Diagnostics Model, Aggregation & Editor Integration
 */

import {
  Diagnostic,
  DiagnosticCollection as IDiagnosticCollection,
  DiagnosticFilter,
  DiagnosticSummary,
  DiagnosticChangeEvent,
  DiagnosticChangeListener,
  DiagnosticSeverity,
  DiagnosticProvider,
  DiagnosticChangeType,
} from './DiagnosticTypes';
import {
  DiagnosticCollection,
  DiagnosticCollectionDelegate,
} from './DiagnosticCollection';
import {
  normalizeDiagnosticUri,
  sortDiagnostics,
} from './DiagnosticValidation';
import { globalDocumentEngine } from '../documents/DocumentEngine';
import { logger } from '../../utils/logger';

export interface NavigationTargetValidationResult {
  valid: boolean;
  uri: string;
  line: number;
  column: number;
  isResourceLevel: boolean;
  reason?: string;
}

export class DiagnosticService implements DiagnosticCollectionDelegate {
  private static instance: DiagnosticService | null = null;

  private readonly collections: Map<string, DiagnosticCollection> = new Map();
  private readonly providers: Map<string, DiagnosticProvider> = new Map();
  private readonly listeners: Set<DiagnosticChangeListener> = new Set();
  private readonly summaryCache: Map<string, DiagnosticSummary> = new Map();
  private isDisposed: boolean = false;

  public static getInstance(): DiagnosticService {
    if (!DiagnosticService.instance) {
      DiagnosticService.instance = new DiagnosticService();
    }
    return DiagnosticService.instance;
  }

  // ---------------------------------------------------------------------------
  // 1. Diagnostic Provider Registration & Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Registers an authoritative diagnostic provider with declared capabilities.
   * Returns its owner-scoped DiagnosticCollection.
   */
  public registerProvider(provider: DiagnosticProvider): IDiagnosticCollection {
    if (this.isDisposed) {
      throw new Error('DiagnosticService is already disposed');
    }

    const providerId = provider.providerId?.trim();
    if (!providerId) {
      throw new Error('Diagnostic provider must have a valid providerId');
    }

    this.providers.set(providerId, provider);
    return this.createCollection(providerId);
  }

  /**
   * Unregisters a diagnostic provider, safely disposing its diagnostics and collection.
   */
  public unregisterProvider(providerId: string): void {
    const trimmed = providerId.trim();
    const provider = this.providers.get(trimmed);
    if (provider) {
      try {
        provider.dispose?.();
      } catch (err) {
        logger.error('Error during provider disposal', {
          providerId: trimmed,
          error: (err as Error).message,
        });
      }
      this.providers.delete(trimmed);
    }

    const col = this.collections.get(trimmed);
    if (col) {
      col.dispose();
      this.collections.delete(trimmed);
    }
  }

  public getProvider(providerId: string): DiagnosticProvider | undefined {
    return this.providers.get(providerId.trim());
  }

  public getProviders(): readonly DiagnosticProvider[] {
    return Array.from(this.providers.values());
  }

  // ---------------------------------------------------------------------------
  // 2. Collection Management
  // ---------------------------------------------------------------------------

  /**
   * Creates or retrieves a named DiagnosticCollection for a specific producer.
   */
  public createCollection(name: string): IDiagnosticCollection {
    if (this.isDisposed) {
      throw new Error('DiagnosticService is already disposed');
    }

    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Diagnostic collection name cannot be empty');
    }

    const existing = this.collections.get(trimmed);
    if (existing) {
      existing.clear();
      return existing;
    }

    const collection = new DiagnosticCollection(trimmed, this);
    this.collections.set(trimmed, collection);
    return collection;
  }

  /**
   * Retrieves an existing DiagnosticCollection by name.
   */
  public getCollection(name: string): IDiagnosticCollection | undefined {
    return this.collections.get(name.trim());
  }

  // ---------------------------------------------------------------------------
  // 3. Diagnostics Queries & Aggregations
  // ---------------------------------------------------------------------------

  /**
   * Gets aggregated diagnostics for a specific URI, or all diagnostics in workspace.
   */
  public getDiagnostics(uri?: string): Diagnostic[] {
    if (this.isDisposed) return [];

    if (uri) {
      const normalizedUri = normalizeDiagnosticUri(uri);
      const result: Diagnostic[] = [];

      for (const collection of this.collections.values()) {
        const diags = collection.get(normalizedUri);
        if (diags.length > 0) {
          result.push(...diags);
        }
      }

      return sortDiagnostics(result);
    }

    // Workspace-wide aggregation
    const allDiags: Diagnostic[] = [];
    for (const collection of this.collections.values()) {
      collection.forEach((_fileUri, diags) => {
        allDiags.push(...diags);
      });
    }

    return sortDiagnostics(allDiags);
  }

  /**
   * Convenient alias for getDiagnostics(uri)
   */
  public getDiagnosticsForDocument(uri: string): Diagnostic[] {
    return this.getDiagnostics(uri);
  }

  /**
   * Computes summary metrics across all active collections, optionally for a specific URI.
   */
  public getSummary(uri?: string): DiagnosticSummary {
    const cacheKey = uri ? normalizeDiagnosticUri(uri) : '__all__';
    const cached = this.summaryCache.get(cacheKey);
    if (cached) return cached;

    const diagnostics = this.getDiagnostics(uri);
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    let hintCount = 0;

    for (const d of diagnostics) {
      switch (d.severity) {
        case 'error':
          errorCount++;
          break;
        case 'warning':
          warningCount++;
          break;
        case 'info':
          infoCount++;
          break;
        case 'hint':
          hintCount++;
          break;
      }
    }

    const summary: DiagnosticSummary = {
      total: diagnostics.length,
      errorCount,
      warningCount,
      infoCount,
      hintCount,
    };

    this.summaryCache.set(cacheKey, summary);
    return summary;
  }

  /**
   * Returns fast diagnostic summary for a single resource.
   */
  public getResourceSummary(uri: string): DiagnosticSummary {
    return this.getSummary(uri);
  }

  /**
   * Computes recursive diagnostic summary for all files inside a directory.
   */
  public getDirectorySummary(dirUri: string): DiagnosticSummary {
    if (this.isDisposed) {
      return { total: 0, errorCount: 0, warningCount: 0, infoCount: 0, hintCount: 0 };
    }

    let normalizedDir = normalizeDiagnosticUri(dirUri);
    if (!normalizedDir.endsWith('/')) {
      normalizedDir += '/';
    }

    const cacheKey = `__dir__:${normalizedDir}`;
    const cached = this.summaryCache.get(cacheKey);
    if (cached) return cached;

    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    let hintCount = 0;
    let total = 0;

    for (const collection of this.collections.values()) {
      collection.forEach((uri, diags) => {
        if (uri.startsWith(normalizedDir)) {
          total += diags.length;
          for (const d of diags) {
            switch (d.severity) {
              case 'error':
                errorCount++;
                break;
              case 'warning':
                warningCount++;
                break;
              case 'info':
                infoCount++;
                break;
              case 'hint':
                hintCount++;
                break;
            }
          }
        }
      });
    }

    const summary: DiagnosticSummary = {
      total,
      errorCount,
      warningCount,
      infoCount,
      hintCount,
    };

    this.summaryCache.set(cacheKey, summary);
    return summary;
  }

  /**
   * Queries diagnostics with flexible filters (severity, source, providerId, uri, message text).
   */
  public query(filter: DiagnosticFilter): Diagnostic[] {
    let items = this.getDiagnostics(filter.uri);

    if (filter.severity) {
      const allowed = Array.isArray(filter.severity)
        ? new Set<DiagnosticSeverity>(filter.severity)
        : new Set<DiagnosticSeverity>([filter.severity]);
      items = items.filter((d) => allowed.has(d.severity));
    }

    if (filter.source) {
      const src = filter.source.toLowerCase();
      items = items.filter((d) => d.source.toLowerCase() === src);
    }

    if (filter.providerId) {
      const pid = filter.providerId.toLowerCase();
      items = items.filter((d) => (d.providerId || d.source).toLowerCase() === pid);
    }

    if (filter.search && filter.search.trim()) {
      const query = filter.search.trim().toLowerCase();
      items = items.filter(
        (d) =>
          d.message.toLowerCase().includes(query) ||
          d.uri.toLowerCase().includes(query) ||
          (d.code !== undefined && String(d.code).toLowerCase().includes(query)) ||
          d.source.toLowerCase().includes(query) ||
          (d.detail !== undefined && d.detail.toLowerCase().includes(query))
      );
    }

    return items;
  }

  // ---------------------------------------------------------------------------
  // 4. Resource Lifecycle Hooks
  // ---------------------------------------------------------------------------

  /**
   * Reassigns diagnostics across all collections when a resource is renamed.
   */
  public handleResourceRenamed(oldUri: string, newUri: string): void {
    if (this.isDisposed) return;
    this.summaryCache.clear();

    for (const col of this.collections.values()) {
      col.reassignUri(oldUri, newUri);
    }
  }

  /**
   * Cleans up diagnostics across all collections when a resource is deleted.
   */
  public handleResourceDeleted(uri: string): void {
    if (this.isDisposed) return;
    this.summaryCache.clear();

    const normalizedUri = normalizeDiagnosticUri(uri);
    for (const col of this.collections.values()) {
      col.delete(normalizedUri);
    }
  }

  /**
   * Handles workspace switch or closure by clearing or disposing workspace-scoped diagnostics.
   */
  public handleWorkspaceChanged(_workspaceId?: string, _generation?: number): void {
    if (this.isDisposed) return;
    this.summaryCache.clear();

    // Clear diagnostics across all collections to avoid stale cross-workspace contamination
    for (const col of this.collections.values()) {
      col.clear();
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Navigation Target Validation & Clamping
  // ---------------------------------------------------------------------------

  /**
   * Validates a diagnostic target before navigation, clamping coordinates safely
   * against the document buffer if loaded, preventing crashes on stale positions.
   */
  public validateNavigationTarget(diagnostic: Diagnostic): NavigationTargetValidationResult {
    const uri = normalizeDiagnosticUri(diagnostic.uri);
    if (!uri) {
      return { valid: false, uri: '', line: 1, column: 1, isResourceLevel: true, reason: 'Empty URI' };
    }

    if (!diagnostic.range) {
      return { valid: true, uri, line: 1, column: 1, isResourceLevel: true };
    }

    let line = Math.max(1, diagnostic.range.startLine);
    let column = Math.max(1, diagnostic.range.startColumn);

    // If document is open in DocumentEngine, clamp to actual line count
    const doc = globalDocumentEngine.getByResource(uri) || globalDocumentEngine.getDocument(uri);
    if (doc && doc.content) {
      const lineCount = doc.content.split('\n').length;
      line = Math.min(line, lineCount);
    }

    return {
      valid: true,
      uri,
      line,
      column,
      isResourceLevel: false,
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Clearing & Subscriptions
  // ---------------------------------------------------------------------------

  /**
   * Clears diagnostics across all collections.
   * If uri is specified, clears only that document.
   */
  public clear(uri?: string): void {
    if (this.isDisposed) return;
    this.summaryCache.clear();

    if (uri) {
      const normalizedUri = normalizeDiagnosticUri(uri);
      for (const col of this.collections.values()) {
        col.delete(normalizedUri);
      }
    } else {
      for (const col of this.collections.values()) {
        col.clear();
      }
    }
  }

  public clearDocument(uri: string): void {
    this.clear(uri);
  }

  public clearForOwner(owner: string, uri?: string): void {
    this.summaryCache.clear();
    const col = this.collections.get(owner.trim());
    if (col) {
      if (uri) {
        col.delete(uri);
      } else {
        col.clear();
      }
    }
  }

  public subscribe(listener: DiagnosticChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onCollectionUpdated(
    collection: IDiagnosticCollection,
    type: DiagnosticChangeType,
    affectedUris: string[]
  ): void {
    if (this.isDisposed) return;
    this.summaryCache.clear();

    const summary = this.getSummary();
    const event: DiagnosticChangeEvent = {
      type,
      uris: affectedUris,
      owner: collection.name,
      summary,
      timestamp: Date.now(),
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        logger.error('Error in diagnostic change listener', {
          error: (err as Error).message,
        });
      }
    }
  }

  public onCollectionDisposed(collection: IDiagnosticCollection): void {
    this.summaryCache.clear();
    this.collections.delete(collection.name);
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    for (const provider of Array.from(this.providers.values())) {
      try {
        provider.dispose?.();
      } catch (_) {}
    }
    this.providers.clear();

    for (const collection of Array.from(this.collections.values())) {
      collection.dispose();
    }
    this.collections.clear();
    this.listeners.clear();
    this.summaryCache.clear();
  }
}

export const globalDiagnosticService = DiagnosticService.getInstance();
