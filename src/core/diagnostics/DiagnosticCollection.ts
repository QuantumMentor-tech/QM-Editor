/**
 * QM Editor Diagnostic Collection Implementation
 * Phase 04, Step 34 — Core Engine Diagnostics Model, Aggregation & Editor Integration
 */

import {
  Diagnostic,
  DiagnosticCollection as IDiagnosticCollection,
} from './DiagnosticTypes';
import {
  normalizeDiagnosticUri,
  validateDiagnostic,
  sortDiagnostics,
} from './DiagnosticValidation';

export interface DiagnosticCollectionDelegate {
  onCollectionUpdated(
    collection: IDiagnosticCollection,
    type: 'set' | 'cleared' | 'deleted',
    affectedUris: string[]
  ): void;
  onCollectionDisposed(collection: IDiagnosticCollection): void;
}

export class DiagnosticCollection implements IDiagnosticCollection {
  public readonly name: string;
  private readonly store: Map<string, Diagnostic[]> = new Map();
  private readonly delegate: DiagnosticCollectionDelegate;
  private isDisposed: boolean = false;

  constructor(name: string, delegate: DiagnosticCollectionDelegate) {
    this.name = name;
    this.delegate = delegate;
  }

  public set(uri: string, rawDiagnostics: Diagnostic[]): void {
    if (this.isDisposed) return;

    const normalizedUri = normalizeDiagnosticUri(uri);
    if (!normalizedUri) return;

    if (!Array.isArray(rawDiagnostics) || rawDiagnostics.length === 0) {
      this.delete(normalizedUri);
      return;
    }

    const validated: Diagnostic[] = rawDiagnostics.map((d) =>
      validateDiagnostic({ ...d, uri: normalizedUri }, this.name)
    );

    const sorted = sortDiagnostics(validated);
    this.store.set(normalizedUri, sorted);

    this.delegate.onCollectionUpdated(this, 'set', [normalizedUri]);
  }

  public delete(uri: string): void {
    if (this.isDisposed) return;

    const normalizedUri = normalizeDiagnosticUri(uri);
    if (!normalizedUri) return;

    const existed = this.store.delete(normalizedUri);
    if (existed) {
      this.delegate.onCollectionUpdated(this, 'deleted', [normalizedUri]);
    }
  }

  public clear(): void {
    if (this.isDisposed || this.store.size === 0) return;

    const affectedUris = Array.from(this.store.keys());
    this.store.clear();
    this.delegate.onCollectionUpdated(this, 'cleared', affectedUris);
  }

  public get(uri: string): readonly Diagnostic[] {
    if (this.isDisposed) return [];
    const normalizedUri = normalizeDiagnosticUri(uri);
    return this.store.get(normalizedUri) || [];
  }

  public has(uri: string): boolean {
    if (this.isDisposed) return false;
    const normalizedUri = normalizeDiagnosticUri(uri);
    const entries = this.store.get(normalizedUri);
    return Boolean(entries && entries.length > 0);
  }

  public forEach(
    callback: (uri: string, diagnostics: readonly Diagnostic[], collection: IDiagnosticCollection) => void
  ): void {
    if (this.isDisposed) return;
    for (const [uri, diags] of this.store.entries()) {
      callback(uri, diags, this);
    }
  }

  public getAll(): Map<string, Diagnostic[]> {
    return new Map(this.store);
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    const affectedUris = Array.from(this.store.keys());
    this.store.clear();
    this.delegate.onCollectionUpdated(this, 'cleared', affectedUris);
    this.delegate.onCollectionDisposed(this);
  }
}
