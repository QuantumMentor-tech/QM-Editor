/**
 * QM Editor Canonical LSP Document Synchronization Coordinator
 * Phase 06, Step 56 — Language Server Protocol Foundation, Server Lifecycle & Client Architecture
 *
 * Bridges the authoritative DocumentEngine lifecycle events to LSP textDocument synchronization
 * notifications (didOpen, didChange, didSave, didClose) with monotonic version mapping and strict ordering.
 */

import {
  DidOpenTextDocumentParams,
  DidChangeTextDocumentParams,
  DidSaveTextDocumentParams,
  DidCloseTextDocumentParams,
} from './LspTypes';
import { LspServerManager, globalLspServerManager } from './LspServerManager';
import { LspUriMapper } from './LspUriMapper';
import { DocumentEngine, globalDocumentEngine } from '../documents/DocumentEngine';
import { DocumentRecord } from '../documents/DocumentTypes';
import { logger } from '../../utils/logger';

interface TrackedDocumentState {
  documentId: string;
  lspUri: string;
  languageId: string;
  lspVersion: number;
  serverSessionId: string;
  pendingSyncPromise?: Promise<void>;
}

export class LspDocumentSync {
  private static instance: LspDocumentSync | null = null;
  private readonly tracked = new Map<string, TrackedDocumentState>();
  private readonly serverManager: LspServerManager;
  private readonly documentEngine: DocumentEngine;
  private unsubscribers: Array<() => void> = [];
  private isDisposed: boolean = false;
  private enabled: boolean = false;

  private constructor(
    serverManager: LspServerManager = globalLspServerManager,
    documentEngine: DocumentEngine = globalDocumentEngine
  ) {
    this.serverManager = serverManager;
    this.documentEngine = documentEngine;

    this.bindDocumentEvents();
  }

  public static getInstance(): LspDocumentSync {
    if (!LspDocumentSync.instance) {
      LspDocumentSync.instance = new LspDocumentSync();
    }
    return LspDocumentSync.instance;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isDocumentSynchronized(documentId: string): boolean {
    return this.tracked.has(documentId);
  }

  public getTrackedDocument(documentId: string): TrackedDocumentState | undefined {
    return this.tracked.get(documentId);
  }

  // ---------------------------------------------------------------------------
  // 1. didOpen Synchronization
  // ---------------------------------------------------------------------------

  public async syncOpen(doc: DocumentRecord): Promise<void> {
    if (!this.enabled || this.isDisposed) return;

    const lspUri = LspUriMapper.pathToUri(doc.resourceUri);
    const session = await this.serverManager.getOrCreateSession(
      doc.languageId,
      doc.resource.extension,
      doc.workspaceId
    );

    if (!session || !session.getClient().isReady()) {
      return;
    }

    const state: TrackedDocumentState = {
      documentId: doc.id,
      lspUri,
      languageId: doc.languageId,
      lspVersion: 1,
      serverSessionId: session.sessionId,
    };

    this.tracked.set(doc.id, state);
    session.trackDocument(lspUri);

    const openParams: DidOpenTextDocumentParams = {
      textDocument: {
        uri: lspUri,
        languageId: doc.languageId,
        version: state.lspVersion,
        text: doc.content,
      },
    };

    logger.info(`LspDocumentSync: Sending didOpen for document "${doc.id}"`, {
      uri: lspUri,
      languageId: doc.languageId,
      version: state.lspVersion,
    });

    await session.getClient().sendNotification('textDocument/didOpen', openParams);
  }

  // ---------------------------------------------------------------------------
  // 2. didChange Synchronization
  // ---------------------------------------------------------------------------

  public async syncChange(doc: DocumentRecord): Promise<void> {
    if (!this.enabled || this.isDisposed) return;

    let state = this.tracked.get(doc.id);
    if (!state) {
      // Document not yet opened with server; attempt open
      await this.syncOpen(doc);
      return;
    }

    const session = this.serverManager.getActiveSession(doc.languageId, doc.workspaceId);
    if (!session || !session.getClient().isReady()) {
      return;
    }

    state.lspVersion++;

    const changeParams: DidChangeTextDocumentParams = {
      textDocument: {
        uri: state.lspUri,
        version: state.lspVersion,
      },
      contentChanges: [
        {
          text: doc.content, // Full document synchronization
        },
      ],
    };

    logger.debug(`LspDocumentSync: Sending didChange for document "${doc.id}"`, {
      uri: state.lspUri,
      version: state.lspVersion,
    });

    // Sequential change dispatch queue
    const previousPromise = state.pendingSyncPromise || Promise.resolve();
    state.pendingSyncPromise = previousPromise
      .then(() => session.getClient().sendNotification('textDocument/didChange', changeParams))
      .catch((err) => {
        logger.error(`LspDocumentSync: Error sending didChange for "${doc.id}"`, {
          error: (err as Error).message,
        });
      });

    await state.pendingSyncPromise;
  }

  // ---------------------------------------------------------------------------
  // 3. didSave Synchronization
  // ---------------------------------------------------------------------------

  public async syncSave(doc: DocumentRecord): Promise<void> {
    if (!this.enabled || this.isDisposed) return;

    const state = this.tracked.get(doc.id);
    if (!state) return;

    const session = this.serverManager.getActiveSession(doc.languageId, doc.workspaceId);
    if (!session || !session.getClient().isReady()) {
      return;
    }

    // Only send didSave if server capabilities announce textDocumentSync.save
    const caps = session.getCapabilities();
    const saveOption = caps?.textDocumentSync && typeof caps.textDocumentSync === 'object'
      ? caps.textDocumentSync.save
      : true;

    if (!saveOption) {
      return;
    }

    const saveParams: DidSaveTextDocumentParams = {
      textDocument: {
        uri: state.lspUri,
      },
      text: typeof saveOption === 'object' && saveOption.includeText ? doc.content : undefined,
    };

    logger.info(`LspDocumentSync: Sending didSave for document "${doc.id}"`, {
      uri: state.lspUri,
    });

    await session.getClient().sendNotification('textDocument/didSave', saveParams);
  }

  // ---------------------------------------------------------------------------
  // 4. didClose Synchronization
  // ---------------------------------------------------------------------------

  public async syncClose(docId: string, fallbackLanguageId?: string, workspaceId?: string): Promise<void> {
    const state = this.tracked.get(docId);
    if (!state) return;

    this.tracked.delete(docId);

    const effectiveLang = state.languageId || fallbackLanguageId || 'plaintext';
    const session = this.serverManager.getActiveSession(effectiveLang, workspaceId);
    if (session) {
      session.untrackDocument(state.lspUri);

      if (session.getClient().isReady()) {
        const closeParams: DidCloseTextDocumentParams = {
          textDocument: {
            uri: state.lspUri,
          },
        };

        logger.info(`LspDocumentSync: Sending didClose for document "${docId}"`, {
          uri: state.lspUri,
        });

        await session.getClient().sendNotification('textDocument/didClose', closeParams);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. DocumentEngine Subscriptions
  // ---------------------------------------------------------------------------

  private bindDocumentEvents(): void {
    const unsubOpen = this.documentEngine.on('document.opened', async (event) => {
      const doc = this.documentEngine.getDocument(event.documentId);
      if (doc) {
        await this.syncOpen(doc);
      }
    });

    const unsubChange = this.documentEngine.on('document.changed', async (event) => {
      const doc = this.documentEngine.getDocument(event.documentId);
      if (doc) {
        await this.syncChange(doc);
      }
    });

    const unsubSave = this.documentEngine.on('document.saved', async (event) => {
      const doc = this.documentEngine.getDocument(event.documentId);
      if (doc) {
        await this.syncSave(doc);
      }
    });

    const unsubClose = this.documentEngine.on('document.closed', async (event) => {
      await this.syncClose(event.documentId, undefined, event.workspaceId);
    });

    this.unsubscribers.push(unsubOpen, unsubChange, unsubSave, unsubClose);
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
    this.tracked.clear();
  }
}

export const globalLspDocumentSync = LspDocumentSync.getInstance();
