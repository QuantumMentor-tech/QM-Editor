/**
 * QM Editor Diagnostic Collection Implementation
 * Phase 04, Step 34 & Step 40 — Core Engine Diagnostics Model, Aggregation & Editor Integration
 */

import {
  Diagnostic,
  DiagnosticCollection as IDiagnosticCollection,
  SetDiagnosticsOptions,
  DiagnosticChangeType,
} from './DiagnosticTypes';
import {
  normalizeDiagnosticUri,
  validateDiagnostic,
  sortDiagnostics,
  areDiagnosticArraysEqual,
} from './DiagnosticValidation';
import { globalDocumentEngine } from '../documents/DocumentEngine';
import { globalWorkspaceEngine } from '../workspace/WorkspaceEngine';
import { logger } from '../../utils/logger';

export interface DiagnosticCollectionDelegate {
  onCollectionUpdated(
    collection: IDiagnosticCollection,
    type: DiagnosticChangeType,
    affectedUris: string[]
  ): void;
  onCollectionDisposed(collection: IDiagnosticCollection): void;
}

export class DiagnosticCollection implements IDiagnosticCollection {
  public readonly name: string;
  private readonly store: Map<string, Diagnostic[]> = new Map();
  private readonly generations: Map<string, number> = new Map();
  private readonly delegate: DiagnosticCollectionDelegate;
  private isDisposed: boolean = false;

  constructor(name: string, delegate: DiagnosticCollectionDelegate) {
    this.name = name;
    this.delegate = delegate;
  }

  public getGeneration(uri: string): number {
    const normalizedUri = normalizeDiagnosticUri(uri);
    return this.generations.get(normalizedUri) ?? 0;
  }

  public set(
    uri: string,
    rawDiagnostics: Diagnostic[],
    options?: SetDiagnosticsOptions
  ): void {
    if (this.isDisposed) return;

    const normalizedUri = normalizeDiagnosticUri(uri);
    if (!normalizedUri) return;

    // 1. Workspace generation check
    if (typeof options?.workspaceGeneration === 'number') {
      const activeWorkspaceGen = globalWorkspaceEngine.getGeneration();
      if (options.workspaceGeneration !== activeWorkspaceGen) {
        logger.warn('Stale diagnostic update rejected: workspace generation mismatch', {
          collection: this.name,
          uri: normalizedUri,
          expectedGen: options.workspaceGeneration,
          activeWorkspaceGen,
        });
        return;
      }
    }

    // 2. Provider generation check
    const currentGen = this.generations.get(normalizedUri) ?? 0;
    if (typeof options?.generation === 'number') {
      if (options.generation < currentGen) {
        logger.warn('Stale diagnostic update rejected: incoming generation is older than active', {
          collection: this.name,
          uri: normalizedUri,
          incomingGen: options.generation,
          currentGen,
        });
        return;
      }
    }

    // 3. Document revision check
    if (typeof options?.documentRevision === 'number') {
      const doc =
        globalDocumentEngine.getByResource(normalizedUri) ||
        globalDocumentEngine.getDocument(normalizedUri);
      if (doc && doc.contentRevision !== options.documentRevision) {
        logger.warn('Stale diagnostic update rejected: document revision mismatch', {
          collection: this.name,
          uri: normalizedUri,
          diagnosticRevision: options.documentRevision,
          documentRevision: doc.contentRevision,
        });
        return;
      }
    }

    // 4. Handle empty/removal
    if (!Array.isArray(rawDiagnostics) || rawDiagnostics.length === 0) {
      if (typeof options?.generation === 'number') {
        this.generations.set(normalizedUri, options.generation);
      }
      this.delete(normalizedUri);
      return;
    }

    // 5. Validation and sorting
    const validated: Diagnostic[] = rawDiagnostics.map((d) =>
      validateDiagnostic(
        {
          ...d,
          uri: normalizedUri,
          providerId: d.providerId || this.name,
          generation: options?.generation ?? d.generation,
        },
        this.name,
        { allowResourceLevel: true }
      )
    );

    const sorted = sortDiagnostics(validated);

    // 6. Equality check to prevent unnecessary churn
    const existing = this.store.get(normalizedUri);
    if (existing && areDiagnosticArraysEqual(existing, sorted)) {
      if (typeof options?.generation === 'number') {
        this.generations.set(normalizedUri, options.generation);
      }
      return;
    }

    // 7. Store update
    this.store.set(normalizedUri, sorted);
    const nextGen = options?.generation !== undefined ? options.generation : currentGen + 1;
    this.generations.set(normalizedUri, nextGen);

    this.delegate.onCollectionUpdated(this, 'set', [normalizedUri]);
  }

  public delete(uri: string): void {
    if (this.isDisposed) return;

    const normalizedUri = normalizeDiagnosticUri(uri);
    if (!normalizedUri) return;

    this.generations.delete(normalizedUri);
    const existed = this.store.delete(normalizedUri);
    if (existed) {
      this.delegate.onCollectionUpdated(this, 'deleted', [normalizedUri]);
    }
  }

  public clear(): void {
    if (this.isDisposed || this.store.size === 0) return;

    const affectedUris = Array.from(this.store.keys());
    this.store.clear();
    this.generations.clear();
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

  public reassignUri(oldUri: string, newUri: string): void {
    if (this.isDisposed) return;

    const oldNorm = normalizeDiagnosticUri(oldUri);
    const newNorm = normalizeDiagnosticUri(newUri);
    if (!oldNorm || !newNorm || oldNorm === newNorm) return;

    if (this.store.has(oldNorm)) {
      const diags = this.store.get(oldNorm)!;
      const gen = this.generations.get(oldNorm) ?? 0;

      this.store.delete(oldNorm);
      this.generations.delete(oldNorm);

      const reassigned = diags.map((d) => ({
        ...d,
        uri: newNorm,
      }));

      this.store.set(newNorm, reassigned);
      this.generations.set(newNorm, gen);

      this.delegate.onCollectionUpdated(this, 'reassigned', [oldNorm, newNorm]);
    }
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    const affectedUris = Array.from(this.store.keys());
    this.store.clear();
    this.generations.clear();
    this.delegate.onCollectionUpdated(this, 'cleared', affectedUris);
    this.delegate.onCollectionDisposed(this);
  }
}
