/**
 * QM Editor In-Memory Document Registry
 * Phase 04, Step 36 — Core Application Engine
 */

import { DocumentRecord, NormalizedResource } from './DocumentTypes';
import { normalizeResourceUri } from './ResourceIdentity';

export class DocumentRegistry {
  private documentsById = new Map<string, DocumentRecord>();
  private docIdByResourceUri = new Map<string, string>();
  private openDocIds: string[] = [];
  private activeDocId: string | null = null;
  private untitledCounter = 1;

  // ---------------------------------------------------------------------------
  // 1. Queries & Lookups
  // ---------------------------------------------------------------------------

  public get(documentId: string): DocumentRecord | undefined {
    return this.documentsById.get(documentId);
  }

  public getByResource(rawUriOrPath: string): DocumentRecord | undefined {
    if (!rawUriOrPath) return undefined;
    const normalized = normalizeResourceUri(rawUriOrPath);
    const docId = this.docIdByResourceUri.get(normalized);
    if (!docId) return undefined;
    return this.documentsById.get(docId);
  }

  public has(documentId: string): boolean {
    return this.documentsById.has(documentId);
  }

  public hasResource(rawUriOrPath: string): boolean {
    if (!rawUriOrPath) return false;
    const normalized = normalizeResourceUri(rawUriOrPath);
    return this.docIdByResourceUri.has(normalized);
  }

  public getAll(): DocumentRecord[] {
    return this.openDocIds
      .map((id) => this.documentsById.get(id))
      .filter((doc): doc is DocumentRecord => Boolean(doc));
  }

  public getOpenIds(): string[] {
    return [...this.openDocIds];
  }

  public getActive(): DocumentRecord | null {
    if (!this.activeDocId) return null;
    return this.documentsById.get(this.activeDocId) || null;
  }

  public getActiveId(): string | null {
    return this.activeDocId;
  }

  public getNextUntitledSequence(): number {
    return this.untitledCounter++;
  }

  public count(): number {
    return this.documentsById.size;
  }

  // ---------------------------------------------------------------------------
  // 2. Mutations
  // ---------------------------------------------------------------------------

  /**
   * Registers a new open document record into the registry.
   * If activate is true or if it's the first document, sets it active.
   */
  public add(record: DocumentRecord, activate: boolean = true): void {
    this.documentsById.set(record.id, record);
    this.docIdByResourceUri.set(record.resourceUri, record.id);

    if (!this.openDocIds.includes(record.id)) {
      this.openDocIds.push(record.id);
    }

    if (activate || this.activeDocId === null) {
      this.activeDocId = record.id;
    }
  }

  /**
   * Activates an existing document in the registry.
   */
  public activate(documentId: string): DocumentRecord | undefined {
    const doc = this.documentsById.get(documentId);
    if (!doc) return undefined;
    this.activeDocId = documentId;
    return doc;
  }

  /**
   * Reassigns a document to a new resource URI (e.g. on Save As or rename).
   */
  public reassignResource(
    documentId: string,
    newResource: NormalizedResource,
    newTitle?: string
  ): void {
    const doc = this.documentsById.get(documentId);
    if (!doc) return;

    // Remove old mapping
    this.docIdByResourceUri.delete(doc.resourceUri);

    // Update document record
    doc.resourceUri = newResource.uri;
    doc.resource = newResource;
    if (newTitle) {
      doc.title = newTitle;
    } else {
      doc.title = newResource.name;
    }
    if (newResource.scheme === 'file') {
      doc.filePath = newResource.uri.replace(/^file:\/\/\/?/, '');
    }

    // Register new mapping
    this.docIdByResourceUri.set(newResource.uri, documentId);
  }

  /**
   * Removes a document from the registry and computes next adjacent active ID.
   */
  public remove(documentId: string): { removed?: DocumentRecord; nextActiveId: string | null } {
    const doc = this.documentsById.get(documentId);
    if (!doc) {
      return { nextActiveId: this.activeDocId };
    }

    const index = this.openDocIds.indexOf(documentId);
    this.documentsById.delete(documentId);
    this.docIdByResourceUri.delete(doc.resourceUri);
    this.openDocIds = this.openDocIds.filter((id) => id !== documentId);

    let nextActiveId = this.activeDocId;

    if (this.activeDocId === documentId) {
      if (this.openDocIds.length === 0) {
        nextActiveId = null;
      } else if (index < this.openDocIds.length) {
        nextActiveId = this.openDocIds[index]; // adjacent right
      } else {
        nextActiveId = this.openDocIds[this.openDocIds.length - 1]; // adjacent left
      }
      this.activeDocId = nextActiveId;
    }

    return { removed: doc, nextActiveId };
  }

  /**
   * Clears all documents and resets state.
   */
  public clear(): void {
    this.documentsById.clear();
    this.docIdByResourceUri.clear();
    this.openDocIds = [];
    this.activeDocId = null;
    this.untitledCounter = 1;
  }
}
