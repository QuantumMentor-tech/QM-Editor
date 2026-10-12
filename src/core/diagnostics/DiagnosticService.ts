/**
 * QM Editor Canonical Diagnostic Aggregator & Service
 * Phase 04, Step 34 — Core Engine Diagnostics Model, Aggregation & Editor Integration
 */

import {
  Diagnostic,
  DiagnosticCollection as IDiagnosticCollection,
  DiagnosticFilter,
  DiagnosticSummary,
  DiagnosticChangeEvent,
  DiagnosticChangeListener,
  DiagnosticSeverity,
} from './DiagnosticTypes';
import {
  DiagnosticCollection,
  DiagnosticCollectionDelegate,
} from './DiagnosticCollection';
import {
  normalizeDiagnosticUri,
  sortDiagnostics,
} from './DiagnosticValidation';
import { logger } from '../../utils/logger';

export class DiagnosticService implements DiagnosticCollectionDelegate {
  private static instance: DiagnosticService | null = null;

  private readonly collections: Map<string, DiagnosticCollection> = new Map();
  private readonly listeners: Set<DiagnosticChangeListener> = new Set();
  private isDisposed: boolean = false;

  public static getInstance(): DiagnosticService {
    if (!DiagnosticService.instance) {
      DiagnosticService.instance = new DiagnosticService();
    }
    return DiagnosticService.instance;
  }

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

    let existing = this.collections.get(trimmed);
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
   * Computes summary metrics across all active collections.
   */
  public getSummary(uri?: string): DiagnosticSummary {
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

    return {
      total: diagnostics.length,
      errorCount,
      warningCount,
      infoCount,
      hintCount,
    };
  }

  /**
   * Queries diagnostics with flexible filters (severity, source, uri, message text).
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

    if (filter.search && filter.search.trim()) {
      const query = filter.search.trim().toLowerCase();
      items = items.filter(
        (d) =>
          d.message.toLowerCase().includes(query) ||
          d.uri.toLowerCase().includes(query) ||
          (d.code !== undefined && String(d.code).toLowerCase().includes(query)) ||
          d.source.toLowerCase().includes(query)
      );
    }

    return items;
  }

  /**
   * Clears diagnostics across all collections.
   * If uri is specified, clears only that document.
   */
  public clear(uri?: string): void {
    if (this.isDisposed) return;

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

  /**
   * Clears diagnostics for a specific document when closed or deleted.
   */
  public clearDocument(uri: string): void {
    this.clear(uri);
  }

  /**
   * Clears diagnostics owned by a specific source/owner.
   */
  public clearForOwner(owner: string, uri?: string): void {
    const col = this.collections.get(owner.trim());
    if (col) {
      if (uri) {
        col.delete(uri);
      } else {
        col.clear();
      }
    }
  }

  /**
   * Subscribes to diagnostic changes.
   */
  public subscribe(listener: DiagnosticChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Called by DiagnosticCollection when modified.
   */
  public onCollectionUpdated(
    collection: IDiagnosticCollection,
    type: 'set' | 'cleared' | 'deleted',
    affectedUris: string[]
  ): void {
    if (this.isDisposed) return;

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

  /**
   * Called by DiagnosticCollection when disposed.
   */
  public onCollectionDisposed(collection: IDiagnosticCollection): void {
    this.collections.delete(collection.name);
  }

  /**
   * Disposes the DiagnosticService and cleans up all collections and listeners.
   */
  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    for (const collection of Array.from(this.collections.values())) {
      collection.dispose();
    }
    this.collections.clear();
    this.listeners.clear();
  }
}

export const globalDiagnosticService = DiagnosticService.getInstance();
