/**
 * QM Editor Local History Coordinator
 * Phase 05, Step 53 — Local History, Document Snapshots & Versioned Content Persistence
 */

import {
  HistoryPreview,
  HistoryRestoreOptions,
  HistoryRestoreResult,
  LocalHistoryEntryDTO,
  LocalHistoryHealthReport,
  LocalHistoryHealthState,
  LocalHistoryManifestDTO,
  LocalHistoryOptions,
  LocalHistorySnapshotDTO,
  LocalHistorySource,
} from './LocalHistoryTypes';
import {
  ILocalHistoryRepository,
  globalLocalHistoryRepository,
} from '../storage/repositories/LocalHistoryRepository';
import { StorageSerializer } from '../storage/serialization/StorageSerializer';
import {
  DocumentEngine,
  globalDocumentEngine,
} from '../documents/DocumentEngine';
import {
  DocumentRecord,
  DocumentResourceChangedEventPayload,
  DocumentSavedEventPayload,
} from '../documents/DocumentTypes';
import { SettingsService } from '../settings/SettingsService';
import {
  FeedbackService,
  globalFeedbackService,
} from '../feedback/FeedbackService';
import { logger } from '../../utils/logger';

export class LocalHistoryCoordinator {
  private static instance: LocalHistoryCoordinator | null = null;

  private readonly documentEngine: DocumentEngine;
  private readonly repository: ILocalHistoryRepository;
  private readonly settingsService: SettingsService | null;
  private readonly feedbackService: FeedbackService;

  private enabled: boolean;
  private maxEntriesPerFile: number;
  private retentionDays: number;
  private maxStorageBytes: number;

  private readonly customOptionsProvided: boolean;

  private healthState: LocalHistoryHealthState = 'ready';
  private issues: string[] = [];
  private unbinders: Array<() => void> = [];
  private isDisposed: boolean = false;

  constructor(options: LocalHistoryOptions = {}) {
    this.documentEngine = (options as any).documentEngine || globalDocumentEngine;
    this.repository = (options as any).repository || globalLocalHistoryRepository;
    this.settingsService = (options as any).settingsService || null;
    this.feedbackService = (options as any).feedbackService || globalFeedbackService;

    this.customOptionsProvided =
      options.enabled !== undefined ||
      options.maxEntriesPerFile !== undefined ||
      options.retentionDays !== undefined ||
      options.maxStorageBytes !== undefined;

    this.enabled = options.enabled ?? true;
    this.maxEntriesPerFile = options.maxEntriesPerFile ?? 50;
    this.retentionDays = options.retentionDays ?? 30;
    this.maxStorageBytes = options.maxStorageBytes ?? 100 * 1024 * 1024; // 100 MB default

    this.loadSettings();
    this.setupEventListeners();

    logger.info('LocalHistoryCoordinator initialized', {
      enabled: this.enabled,
      maxEntriesPerFile: this.maxEntriesPerFile,
      retentionDays: this.retentionDays,
      maxStorageBytes: this.maxStorageBytes,
    });
  }

  public static getInstance(options?: LocalHistoryOptions): LocalHistoryCoordinator {
    if (!LocalHistoryCoordinator.instance) {
      LocalHistoryCoordinator.instance = new LocalHistoryCoordinator(options);
    }
    return LocalHistoryCoordinator.instance;
  }

  public async initialize(): Promise<void> {
    // Already configured via constructor; satisfies async service lifecycle contracts
    return Promise.resolve();
  }

  // ---------------------------------------------------------------------------
  // Resource & Identity Resolution Helper
  // ---------------------------------------------------------------------------

  private resolveResourceUriAndWorkspace(
    resourceUriOrDocId: string,
    workspaceId?: string
  ): { resourceUri: string; workspaceId?: string; doc?: DocumentRecord } {
    let doc = this.documentEngine.getDocument(resourceUriOrDocId);
    if (!doc) {
      doc = this.documentEngine.getByResource(resourceUriOrDocId);
    }
    if (doc) {
      return {
        resourceUri: doc.resourceUri,
        workspaceId: workspaceId || doc.workspaceId,
        doc,
      };
    }
    return { resourceUri: resourceUriOrDocId, workspaceId };
  }

  // ---------------------------------------------------------------------------
  // 1. Event Listeners & Save Boundary Integration
  // ---------------------------------------------------------------------------

  private setupEventListeners(): void {
    // 1. Document Saved: Successful normal Save creates a Local History snapshot
    this.unbinders.push(
      this.documentEngine.on(
        'document.saved',
        async (payload: DocumentSavedEventPayload) => {
          if (!this.enabled || this.isDisposed) return;
          try {
            await this.handleDocumentSaved(payload.documentId, payload.resourceUri);
          } catch (err) {
            this.recordIssue(
              `Failed creating save snapshot for "${payload.resourceUri}": ${
                (err as Error).message
              }`
            );
          }
        }
      )
    );

    // 2. Document Resource Changed (e.g. Save As / Rename)
    this.unbinders.push(
      this.documentEngine.on(
        'document.resourceChanged',
        async (payload: DocumentResourceChangedEventPayload) => {
          if (!this.enabled || this.isDisposed) return;
          try {
            await this.handleResourceChanged(
              payload.oldResourceUri,
              payload.newResourceUri,
              payload.documentId
            );
          } catch (err) {
            this.recordIssue(
              `Failed handling resource change for "${payload.newResourceUri}": ${
                (err as Error).message
              }`
            );
          }
        }
      )
    );
  }

  /**
   * Invoked strictly after a confirmed filesystem save.
   * Performs deduplication and coalescing: if the saved content matches the
   * latest history entry for this resource, redundant snapshots are suppressed.
   */
  private async handleDocumentSaved(
    documentId: string,
    _resourceUri: string
  ): Promise<void> {
    const doc = this.documentEngine.getDocument(documentId);
    if (!doc) return;

    // Coalescing check: do not create redundant duplicate snapshot if unchanged
    const content = doc.content;
    const contentHash = StorageSerializer.computeChecksum(content);
    const manifest = await this.repository.getManifest(
      doc.resourceUri,
      doc.workspaceId
    );

    if (manifest && manifest.entries.length > 0) {
      const latest = manifest.entries[0];
      if (latest.contentHash === contentHash) {
        logger.debug(
          `LocalHistoryCoordinator: skipping save snapshot for "${doc.title}" (content identical to rev ${latest.documentRevision}).`
        );
        return;
      }
    }

    await this.createSnapshotInternal(doc, { source: 'save' });
  }

  private async handleResourceChanged(
    _oldUri: string,
    _newUri: string,
    documentId: string
  ): Promise<void> {
    const doc = this.documentEngine.getDocument(documentId);
    if (!doc) return;

    // Create a snapshot under new resource identity to start new lineage
    await this.createSnapshotInternal(doc, {
      source: 'save',
      label: `Saved as ${doc.title}`,
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Snapshot Creation & Retention Management
  // ---------------------------------------------------------------------------

  public async createSnapshot(
    documentIdOrUri: string,
    sourceOrOptions?: LocalHistorySource | { source?: LocalHistorySource; label?: string },
    options: { label?: string } = {}
  ): Promise<LocalHistoryEntryDTO | null> {
    if (!this.enabled || this.isDisposed) return null;

    let doc = this.documentEngine.getDocument(documentIdOrUri);
    if (!doc) {
      doc = this.documentEngine.getByResource(documentIdOrUri);
    }

    if (!doc) {
      this.recordIssue(
        `Cannot create history snapshot: document "${documentIdOrUri}" not found.`
      );
      return null;
    }

    const resolvedOptions =
      typeof sourceOrOptions === 'string'
        ? { source: sourceOrOptions, label: options.label }
        : sourceOrOptions || {};

    return this.createSnapshotInternal(doc, resolvedOptions);
  }

  private async createSnapshotInternal(
    doc: DocumentRecord,
    options: { source?: LocalHistorySource; label?: string } = {}
  ): Promise<LocalHistoryEntryDTO | null> {
    const source: LocalHistorySource = options.source || 'manual';
    const content = doc.content;
    const contentHash = StorageSerializer.computeChecksum(content);
    const entryId = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const normalizedLineEnding: 'lf' | 'crlf' | 'cr' =
      String(doc.metadata.lineEnding).toLowerCase() === 'crlf'
        ? 'crlf'
        : String(doc.metadata.lineEnding).toLowerCase() === 'cr'
        ? 'cr'
        : 'lf';

    const entry: LocalHistoryEntryDTO = {
      id: entryId,
      historyEntryId: entryId,
      resourceUri: doc.resourceUri,
      workspaceId: doc.workspaceId,
      documentId: doc.id,
      createdAt: Date.now(),
      source,
      documentRevision: doc.contentRevision,
      contentHash,
      contentSize: content.length,
      encoding: doc.metadata.encoding || 'utf-8',
      lineEnding: normalizedLineEnding,
      languageId: doc.languageId || 'plaintext',
      label: options.label,
    };

    const snapshot: LocalHistorySnapshotDTO = {
      version: 1,
      id: entryId,
      content,
      contentHash,
      createdAt: entry.createdAt,
    };

    try {
      // 1. Write snapshot content first atomically
      await this.repository.saveSnapshot(snapshot);

      // 2. Load existing manifest or initialize new one
      const existing = await this.repository.getManifest(
        doc.resourceUri,
        doc.workspaceId
      );

      const entries = existing ? [...existing.entries] : [];
      // Prepend newest entry
      entries.unshift(entry);

      // 3. Enforce bounded retention
      const prunedEntries: LocalHistoryEntryDTO[] = [];
      const retainedEntries: LocalHistoryEntryDTO[] = [];

      // A. Maximum entries per file limit
      for (let i = 0; i < entries.length; i++) {
        if (i < this.maxEntriesPerFile) {
          retainedEntries.push(entries[i]);
        } else {
          prunedEntries.push(entries[i]);
        }
      }

      // B. Retention days limit
      const cutoffTime = Date.now() - this.retentionDays * 86400 * 1000;
      const finalRetained: LocalHistoryEntryDTO[] = [];
      for (const e of retainedEntries) {
        if (e.createdAt >= cutoffTime || finalRetained.length === 0) {
          // Always keep at least the newest 1 entry regardless of age
          finalRetained.push(e);
        } else {
          prunedEntries.push(e);
        }
      }

      // 4. Save updated manifest
      const manifest: LocalHistoryManifestDTO = {
        version: 1,
        resourceUri: doc.resourceUri,
        workspaceId: doc.workspaceId,
        entries: finalRetained,
        lastUpdatedAt: Date.now(),
      };
      await this.repository.saveManifest(manifest);

      // 5. Clean up pruned snapshots asynchronously
      for (const pruned of prunedEntries) {
        this.repository.deleteSnapshot(pruned.id).catch((err) => {
          logger.warn(
            `LocalHistoryCoordinator: failed to delete pruned snapshot "${pruned.id}": ${
              (err as Error).message
            }`
          );
        });
      }

      logger.info(
        `LocalHistoryCoordinator: recorded ${source} snapshot "${entryId}" for "${doc.title}".`
      );
      return entry;
    } catch (err) {
      this.recordIssue(
        `Failed writing local history snapshot for "${doc.title}": ${
          (err as Error).message
        }`
      );
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Query & Content Inspection
  // ---------------------------------------------------------------------------

  public async getHistory(
    resourceUriOrDocId: string,
    workspaceId?: string
  ): Promise<LocalHistoryEntryDTO[]> {
    if (!this.enabled || !resourceUriOrDocId) return [];

    const resolved = this.resolveResourceUriAndWorkspace(
      resourceUriOrDocId,
      workspaceId
    );
    const manifest = await this.repository.getManifest(
      resolved.resourceUri,
      resolved.workspaceId
    );
    if (!manifest) return [];

    // Return entries sorted newest first
    return [...manifest.entries].sort((a, b) => b.createdAt - a.createdAt);
  }

  public async getSnapshotContent(entryId: string): Promise<string | null> {
    if (!entryId) return null;
    const snapshot = await this.repository.getSnapshot(entryId);
    return snapshot ? snapshot.content : null;
  }

  public async previewEntry(
    resourceUriOrDocId: string,
    entryId: string,
    workspaceId?: string
  ): Promise<HistoryPreview> {
    const resolved = this.resolveResourceUriAndWorkspace(
      resourceUriOrDocId,
      workspaceId
    );
    const manifest = await this.repository.getManifest(
      resolved.resourceUri,
      resolved.workspaceId
    );
    if (!manifest) {
      return {
        valid: false,
        error: `No local history manifest found for "${resolved.resourceUri}".`,
      };
    }

    const entry = manifest.entries.find(
      (e) => e.id === entryId || (e as any).historyEntryId === entryId
    );
    if (!entry) {
      return {
        valid: false,
        error: `History entry "${entryId}" not found.`,
      };
    }

    const snapshot = await this.repository.getSnapshot(entryId);
    if (!snapshot) {
      return {
        valid: false,
        entry,
        error: `Snapshot content for entry "${entryId}" not found in storage.`,
      };
    }

    // Check integrity checksum
    const computed = StorageSerializer.computeChecksum(snapshot.content);
    if (computed !== snapshot.contentHash) {
      this.recordIssue(
        `Snapshot "${entryId}" failed integrity checksum check during preview.`
      );
      return {
        valid: false,
        entry,
        snapshot,
        error: `Checksum mismatch for historical snapshot "${entryId}". Expected ${snapshot.contentHash}, got ${computed}.`,
      };
    }

    const currentDoc = resolved.doc || this.documentEngine.getByResource(resolved.resourceUri);
    const currentContent = currentDoc?.content;
    const isIdenticalToCurrent = currentContent === snapshot.content;

    return {
      valid: true,
      entry,
      snapshot,
      historicalContent: snapshot.content,
      currentContent,
      isIdenticalToCurrent,
      hasDifference: !isIdenticalToCurrent,
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Safe Restoration Semantics
  // ---------------------------------------------------------------------------

  /**
   * Safely restores a historical version into the active document.
   * - Uses EditTransaction to apply content.
   * - Restored document becomes dirty (filesystem is UNTOUCHED).
   * - Undo/Redo is preserved: Ctrl+Z reverses the restore.
   * - Creates an optional safety pre-restore snapshot of current live content.
   */
  public async restoreEntry(
    resourceUriOrDocId: string,
    entryId: string,
    options: HistoryRestoreOptions = {}
  ): Promise<HistoryRestoreResult> {
    if (!this.enabled || this.isDisposed) {
      return {
        success: false,
        status: 'rejected',
        entryId,
        error: 'Local history is disabled or disposed.',
      };
    }

    // 1. Resolve Document
    const resolved = this.resolveResourceUriAndWorkspace(resourceUriOrDocId);
    let doc = resolved.doc || this.documentEngine.getByResource(resolved.resourceUri);
    if (!doc) {
      try {
        const openResult = await this.documentEngine.openResource(resolved.resourceUri, {
          activate: true,
        });
        doc = openResult.document;
      } catch (err) {
        return {
          success: false,
          status: 'failed',
          entryId,
          error: `Could not open target resource for restore: ${(err as Error).message}`,
        };
      }
    }

    // 2. Validate Writable State
    const isReadOnly =
      doc.metadata.isReadOnly ||
      (doc as any).isReadOnly ||
      (doc.capabilities && !doc.capabilities.canWrite);
    if (isReadOnly) {
      const reason = doc.metadata.readOnlyReason || 'Document is read-only.';
      this.feedbackService.showError(`Cannot restore history: ${reason}`);
      return {
        success: false,
        status: 'rejected',
        entryId,
        documentId: doc.id,
        error: reason,
      };
    }

    // 3. Load & Verify Snapshot
    const snapshot = await this.repository.getSnapshot(entryId);
    if (!snapshot) {
      const err = `Historical snapshot "${entryId}" not found in storage.`;
      this.feedbackService.showError(err);
      return { success: false, status: 'failed', entryId, documentId: doc.id, error: err };
    }

    const computedHash = StorageSerializer.computeChecksum(snapshot.content);
    if (computedHash !== snapshot.contentHash) {
      const err = 'Cannot restore corrupt historical snapshot (checksum mismatch).';
      this.feedbackService.showError(err);
      return { success: false, status: 'failed', entryId, documentId: doc.id, error: err };
    }

    // 4. Pre-Restore Safety Protection
    let preRestoreEntryId: string | undefined;
    if (options.createPreRestoreSnapshot !== false) {
      try {
        const preRestoreEntry = await this.createSnapshotInternal(doc, {
          source: 'preRestore',
          label:
            options.label ||
            `Before restore of ${new Date(snapshot.createdAt).toLocaleTimeString()}`,
        });
        preRestoreEntryId = preRestoreEntry?.id;
      } catch (err) {
        logger.warn(
          `LocalHistoryCoordinator: pre-restore snapshot failed: ${
            (err as Error).message
          }`
        );
      }
    }

    // 5. Apply Historical Content via Edit Transaction
    try {
      const currentLength = doc.content.length;
      await this.documentEngine.applyTransaction(doc.id, {
        documentId: doc.id,
        baseRevision: doc.contentRevision,
        changes: [
          {
            from: 0,
            to: currentLength,
            insertText: snapshot.content,
            deletedText: doc.content,
          },
        ],
        origin: 'programmatic',
      });

      const dateStr = new Date(snapshot.createdAt).toLocaleString();
      this.feedbackService.show({
        severity: 'info',
        title: 'Local History Restored',
        message: `Restored version from ${dateStr}. Document is unsaved until you save it.`,
        duration: 5000,
      });

      logger.info(
        `LocalHistoryCoordinator: restored version "${entryId}" for "${doc.title}".`
      );

      return {
        success: true,
        status: 'restored',
        entryId,
        documentId: doc.id,
        preRestoreEntryId,
        preRestoreSnapshotId: preRestoreEntryId,
      };
    } catch (err) {
      const msg = `Restore failed: ${(err as Error).message}`;
      this.feedbackService.showError(msg);
      return {
        success: false,
        status: 'failed',
        entryId,
        documentId: doc.id,
        error: msg,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Management: Delete & Clear Operations
  // ---------------------------------------------------------------------------

  public async deleteEntry(
    resourceUriOrDocId: string,
    entryId: string,
    workspaceId?: string
  ): Promise<boolean> {
    const resolved = this.resolveResourceUriAndWorkspace(
      resourceUriOrDocId,
      workspaceId
    );
    const manifest = await this.repository.getManifest(
      resolved.resourceUri,
      resolved.workspaceId
    );
    if (!manifest) return false;

    const remaining = manifest.entries.filter(
      (e) => e.id !== entryId && (e as any).historyEntryId !== entryId
    );
    if (remaining.length === manifest.entries.length) {
      return false;
    }

    try {
      // 1. Delete snapshot content
      await this.repository.deleteSnapshot(entryId);

      // 2. Update manifest
      const updated: LocalHistoryManifestDTO = {
        ...manifest,
        entries: remaining,
        lastUpdatedAt: Date.now(),
      };
      await this.repository.saveManifest(updated);

      logger.info(
        `LocalHistoryCoordinator: deleted history entry "${entryId}" for "${resolved.resourceUri}".`
      );
      return true;
    } catch (err) {
      this.recordIssue(
        `Failed deleting history entry "${entryId}": ${(err as Error).message}`
      );
      return false;
    }
  }

  public async clearHistory(
    resourceUriOrDocId: string,
    workspaceId?: string
  ): Promise<boolean> {
    const resolved = this.resolveResourceUriAndWorkspace(
      resourceUriOrDocId,
      workspaceId
    );
    try {
      await this.repository.clearResourceHistory(
        resolved.resourceUri,
        resolved.workspaceId
      );
      logger.info(
        `LocalHistoryCoordinator: cleared all history for "${resolved.resourceUri}".`
      );
      return true;
    } catch (err) {
      this.recordIssue(
        `Failed clearing history for "${resolved.resourceUri}": ${(err as Error).message}`
      );
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Diagnostics, Settings & Disposal
  // ---------------------------------------------------------------------------

  public async getHealth(): Promise<LocalHistoryHealthReport> {
    const manifests = await this.repository.listManifests();
    let totalEntries = 0;
    let totalBytes = 0;
    for (const m of manifests) {
      totalEntries += m.entries.length;
      for (const e of m.entries) {
        totalBytes += e.contentSize || 0;
      }
    }
    const state: LocalHistoryHealthState = !this.enabled ? 'disabled' : this.healthState;
    return {
      state,
      enabled: this.enabled,
      healthy: state === 'ready',
      entryCount: totalEntries,
      totalEntriesCount: totalEntries,
      totalResourcesCount: manifests.length,
      storageBytesUsed: totalBytes,
      issues: [...this.issues],
    };
  }

  public getRetentionDays(): number {
    return this.retentionDays;
  }

  public getMaxStorageBytes(): number {
    return this.maxStorageBytes;
  }

  public getMaxEntriesPerFile(): number {
    return this.maxEntriesPerFile;
  }

  private recordIssue(message: string): void {
    logger.warn(`LocalHistoryCoordinator issue: ${message}`);
    this.issues.push(`[${new Date().toISOString()}] ${message}`);
    if (this.issues.length > 50) {
      this.issues.shift();
    }
    this.healthState = 'degraded';
  }

  private loadSettings(): void {
    if (!this.settingsService || this.customOptionsProvided) return;
    try {
      const isEnabled = this.settingsService.get<boolean>('history.enabled');
      if (typeof isEnabled === 'boolean') {
        this.enabled = isEnabled;
      }
      const maxEntries = this.settingsService.get<number>('history.maxEntriesPerFile');
      if (typeof maxEntries === 'number' && maxEntries >= 5 && maxEntries <= 200) {
        this.maxEntriesPerFile = maxEntries;
      }
      const retentionDays = this.settingsService.get<number>('history.retentionDays');
      if (typeof retentionDays === 'number' && retentionDays >= 1 && retentionDays <= 365) {
        this.retentionDays = retentionDays;
      }
      const maxStorage = this.settingsService.get<number>('history.maxStorageBytes');
      if (typeof maxStorage === 'number' && maxStorage > 0) {
        this.maxStorageBytes = maxStorage;
      }
    } catch {
      // Fallback to constructor defaults
    }
  }

  public async dispose(): Promise<void> {
    this.isDisposed = true;

    for (const unbind of this.unbinders) {
      try {
        unbind();
      } catch {
        // ignore
      }
    }
    this.unbinders = [];

    LocalHistoryCoordinator.instance = null;
    logger.info('LocalHistoryCoordinator disposed.');
  }
}

export const globalLocalHistoryCoordinator = LocalHistoryCoordinator.getInstance();
