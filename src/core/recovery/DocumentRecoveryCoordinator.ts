/**
 * QM Editor Document Recovery Coordinator
 * Phase 05, Step 52 — Document Recovery, Autosave & Crash-Safe Unsaved Work Foundation
 */

import {
  RecoveryCandidateEvaluation,
  RecoveryCoordinatorOptions,
  RecoveryDiscoveryResult,
  RecoveryHealthReport,
  RecoveryHealthState,
  RecoveryRestoreResult,
} from './RecoveryTypes';
import {
  RecoveryBaseFileMetadataDTO,
  RecoveryDocumentDTO,
  RecoveryManifestDTO,
  RecoverySessionDTO,
  RecoverySnapshotDTO,
} from '../storage/StorageTypes';
import {
  IDocumentRecoveryRepository,
  globalDocumentRecoveryRepository,
} from '../storage/repositories/DocumentRecoveryRepository';
import { StorageSerializer } from '../storage/serialization/StorageSerializer';
import {
  DocumentEngine,
  globalDocumentEngine,
} from '../documents/DocumentEngine';
import {
  DocumentChangedEventPayload,
  DocumentClosedEventPayload,
  DocumentDirtyChangedEventPayload,
  DocumentRecord,
  DocumentResourceChangedEventPayload,
  DocumentSavedEventPayload,
} from '../documents/DocumentTypes';
import { SettingsService } from '../settings/SettingsService';
import { logger } from '../../utils/logger';

export class DocumentRecoveryCoordinator {
  private static instance: DocumentRecoveryCoordinator | null = null;

  private readonly documentEngine: DocumentEngine;
  private readonly repository: IDocumentRecoveryRepository;
  private readonly settingsService: SettingsService | null;

  private enabled: boolean;
  private autoSaveDelayMs: number;
  private readonly customDelayProvided: boolean;
  private readonly customEnabledProvided: boolean;

  private activeSessionId: string = '';
  private currentWorkspaceId?: string;
  private activeManifest: RecoveryManifestDTO | null = null;
  private healthState: RecoveryHealthState = 'ready';
  private issues: string[] = [];
  private lastSnapshotAt?: number;

  // Timers and Generations
  private readonly autoSaveTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly documentGenerations: Map<string, number> = new Map();
  private readonly inFlightWrites: Map<string, Promise<RecoverySnapshotDTO | null>> = new Map();

  // Event unbinders
  private unbinders: Array<() => void> = [];
  private isDisposed: boolean = false;

  constructor(options: RecoveryCoordinatorOptions = {}) {
    this.documentEngine = (options as any).documentEngine || globalDocumentEngine;
    this.repository = (options as any).repository || globalDocumentRecoveryRepository;
    this.settingsService = (options as any).settingsService || (typeof window !== 'undefined' ? SettingsService.getInstance() : null);

    this.customDelayProvided = options.autoSaveDelayMs !== undefined;
    this.customEnabledProvided = options.enabled !== undefined;

    this.enabled = options.enabled ?? true;
    this.autoSaveDelayMs = options.autoSaveDelayMs ?? 1000;

    this.setupEventListeners();
  }

  public static getInstance(options?: RecoveryCoordinatorOptions): DocumentRecoveryCoordinator {
    if (!DocumentRecoveryCoordinator.instance) {
      DocumentRecoveryCoordinator.instance = new DocumentRecoveryCoordinator(options);
    }
    return DocumentRecoveryCoordinator.instance;
  }

  // ---------------------------------------------------------------------------
  // 1. Session Lifecycle & Clean/Abnormal Termination
  // ---------------------------------------------------------------------------

  /**
   * Initializes the coordinator, inspects previous session for abnormal termination,
   * discovers recovery candidates, and begins a new active session.
   */
  public async initialize(
    sessionId?: string,
    workspaceId?: string
  ): Promise<RecoveryDiscoveryResult> {
    this.currentWorkspaceId = workspaceId;

    // Load user configuration from settings if available
    this.loadSettings();

    // 1. Discover potential candidates from previous unconfirmed sessions
    const discovery = await this.discoverCandidates(workspaceId);

    // 2. Start a fresh runtime recovery session
    await this.startSession(sessionId, workspaceId);

    return discovery;
  }

  public async startSession(
    sessionId?: string,
    workspaceId?: string
  ): Promise<void> {
    this.activeSessionId =
      sessionId ||
      `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.currentWorkspaceId = workspaceId;

    const sessionRecord: RecoverySessionDTO = {
      sessionId: this.activeSessionId,
      workspaceId,
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      state: 'active',
      schemaVersion: 1,
    };

    this.activeManifest = {
      version: 1,
      sessionId: this.activeSessionId,
      workspaceId,
      startedAt: sessionRecord.startedAt,
      lastUpdatedAt: sessionRecord.lastUpdatedAt,
      state: 'active',
      documents: [],
    };

    try {
      // Record unconfirmed active session in storage
      await this.repository.setActiveSession(sessionRecord);
      await this.repository.saveManifest(this.activeManifest);
      logger.info(
        `DocumentRecoveryCoordinator: started active session "${this.activeSessionId}".`
      );
    } catch (err) {
      this.recordIssue(
        `Failed to record active recovery session: ${(err as Error).message}`
      );
    }
  }

  public getActiveSessionId(): string {
    return this.activeSessionId;
  }

  /**
   * Marks current session as clean on normal shutdown.
   */
  public async markSessionClean(): Promise<void> {
    if (!this.activeSessionId) return;

    // Clear all pending autosave timers
    for (const timer of this.autoSaveTimers.values()) {
      clearTimeout(timer);
    }
    this.autoSaveTimers.clear();

    // Wait for in-flight snapshot writes to complete
    if (this.inFlightWrites.size > 0) {
      await Promise.allSettled(Array.from(this.inFlightWrites.values()));
    }

    try {
      if (this.activeManifest) {
        // Obsolete snapshot cleanup: Remove snapshots for documents that are clean
        const dirtyDocs = this.documentEngine.getDirtyDocuments();
        const dirtyDocIds = new Set(dirtyDocs.map((d) => d.id));

        const updatedDocs: RecoveryDocumentDTO[] = [];
        for (const doc of this.activeManifest.documents) {
          if (!dirtyDocIds.has(doc.documentId)) {
            // Clean document: delete obsolete temporary snapshot
            await this.repository.deleteSnapshot(doc.recoveryId);
          } else {
            updatedDocs.push(doc);
          }
        }

        // If no dirty docs remain, manifest state is clean
        const finalState = updatedDocs.length === 0 ? 'clean' : 'active';
        this.activeManifest = {
          ...this.activeManifest,
          state: finalState,
          lastUpdatedAt: Date.now(),
          documents: updatedDocs,
        };
        await this.repository.saveManifest(this.activeManifest);
      }

      // Mark active session pointer as clean
      const currentActive = await this.repository.getActiveSession();
      if (currentActive && currentActive.sessionId === this.activeSessionId) {
        await this.repository.setActiveSession({
          ...currentActive,
          state: 'clean',
          lastUpdatedAt: Date.now(),
        });
      }

      logger.info(
        `DocumentRecoveryCoordinator: marked session "${this.activeSessionId}" clean.`
      );
    } catch (err) {
      this.recordIssue(
        `Failed to mark session clean: ${(err as Error).message}`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Autosave Scheduling, Coalescing & Race Protection
  // ---------------------------------------------------------------------------

  public scheduleAutoSave(doc: DocumentRecord): void {
    if (!this.enabled || this.isDisposed) return;

    // Coalesce rapid edits: Cancel existing timer for this document
    this.cancelAutoSaveTimer(doc.id);

    // Monotonically advance recovery generation for concurrency safety
    const nextGen = (this.documentGenerations.get(doc.id) || 0) + 1;
    this.documentGenerations.set(doc.id, nextGen);

    const timer = setTimeout(async () => {
      this.autoSaveTimers.delete(doc.id);
      try {
        await this.createRecoverySnapshot(doc.id, nextGen);
      } catch (err) {
        this.recordIssue(
          `Autosave snapshot failed for doc "${doc.id}": ${
            (err as Error).message
          }`
        );
      }
    }, this.autoSaveDelayMs);

    this.autoSaveTimers.set(doc.id, timer);
  }

  public cancelAutoSaveTimer(documentId: string): void {
    const existing = this.autoSaveTimers.get(documentId);
    if (existing) {
      clearTimeout(existing);
      this.autoSaveTimers.delete(documentId);
    }
  }

  /**
   * Generates and writes an atomic recovery snapshot for an unsaved document.
   * Concurrency-safe: If a newer generation began, older generation writes are aborted.
   */
  public async createRecoverySnapshot(
    documentId: string,
    generation?: number
  ): Promise<RecoverySnapshotDTO | null> {
    if (!this.enabled || this.isDisposed) return null;

    const doc = this.documentEngine.getDocument(documentId);
    if (!doc) return null;

    // Only unsaved / dirty documents require recovery safety snapshots
    if (!doc.isDirty) {
      return null;
    }

    const targetGen =
      generation ?? (this.documentGenerations.get(documentId) || 1);

    // Concurrency Check 1: Check if already superseded
    const currentGen = this.documentGenerations.get(documentId);
    if (currentGen !== undefined && currentGen > targetGen) {
      logger.debug(
        `DocumentRecoveryCoordinator: snapshot gen ${targetGen} superseded by gen ${currentGen} for doc "${documentId}".`
      );
      return null;
    }

    // Wrap write operation in in-flight tracking
    const writeOp = (async () => {
      const isUntitled =
        doc.resource.scheme === 'untitled' ||
        doc.resourceUri.startsWith('untitled:');
      const recoveryId = `rec_${this.activeSessionId}_${doc.id}`;

      const baseFileMetadata: RecoveryBaseFileMetadataDTO | undefined = isUntitled
        ? undefined
        : {
            path: doc.resourceUri,
            size: doc.resource.size ?? doc.metadata.fileSize,
            modifiedAt:
              doc.resource.modifiedTime ??
              doc.metadata.modifiedTime ??
              doc.lastSavedTimestamp,
            fingerprint: `${doc.resource.size ?? doc.metadata.fileSize}_${
              doc.resource.modifiedTime ??
              doc.metadata.modifiedTime ??
              doc.lastSavedTimestamp
            }`,
          };

      // Content integrity checksum
      const checksum = StorageSerializer.computeChecksum(doc.content);

      const snapshot: RecoverySnapshotDTO = {
        version: 1,
        recoveryId,
        sessionId: this.activeSessionId,
        documentId: doc.id,
        resourceUri: isUntitled ? undefined : doc.resourceUri,
        isUntitled,
        documentRevision: doc.contentRevision,
        recoveryGeneration: targetGen,
        content: doc.content,
        encoding: doc.metadata.encoding || 'utf-8',
        lineEnding:
          String(doc.metadata.lineEnding).toLowerCase() === 'crlf'
            ? 'crlf'
            : String(doc.metadata.lineEnding).toLowerCase() === 'cr'
            ? 'cr'
            : 'lf',
        baseFileMetadata,
        checksum,
        createdAt: Date.now(),
      };

      try {
        // Concurrency Check 2: Pre-write race protection
        if (
          this.documentGenerations.get(documentId) !== undefined &&
          this.documentGenerations.get(documentId)! > targetGen
        ) {
          return null;
        }

        // 1. Commit snapshot first
        await this.repository.saveSnapshot(snapshot);

        // Concurrency Check 3: Post-snapshot race protection
        if (
          this.documentGenerations.get(documentId) !== undefined &&
          this.documentGenerations.get(documentId)! > targetGen
        ) {
          return null;
        }

        // 2. Update active manifest
        const recoveryDoc: RecoveryDocumentDTO = {
          recoveryId,
          sessionId: this.activeSessionId,
          workspaceId: doc.workspaceId || this.currentWorkspaceId,
          documentId: doc.id,
          resourceUri: isUntitled ? undefined : doc.resourceUri,
          isUntitled,
          documentTitle: doc.title,
          documentRevision: doc.contentRevision,
          recoveryGeneration: targetGen,
          dirty: true,
          baseFileMetadata,
          createdAt: snapshot.createdAt,
          updatedAt: Date.now(),
        };

        if (this.activeManifest) {
          const filtered = this.activeManifest.documents.filter(
            (d) => d.recoveryId !== recoveryId
          );
          this.activeManifest = {
            ...this.activeManifest,
            lastUpdatedAt: Date.now(),
            documents: [...filtered, recoveryDoc],
          };
          await this.repository.saveManifest(this.activeManifest);
        }

        this.lastSnapshotAt = Date.now();
        logger.info(
          `DocumentRecoveryCoordinator: saved recovery snapshot for "${doc.title}" (rev: ${doc.contentRevision}, gen: ${targetGen}).`
        );
        return snapshot;
      } catch (err) {
        this.recordIssue(
          `Failed writing recovery snapshot for "${doc.title}": ${
            (err as Error).message
          }`
        );
        return null;
      }
    })();

    this.inFlightWrites.set(documentId, writeOp);
    try {
      return await writeOp;
    } finally {
      if (this.inFlightWrites.get(documentId) === writeOp) {
        this.inFlightWrites.delete(documentId);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Event Listeners (Document Engine Integration)
  // ---------------------------------------------------------------------------

  private setupEventListeners(): void {
    // 1. Content Changed
    this.unbinders.push(
      this.documentEngine.on(
        'document.changed',
        async (payload: DocumentChangedEventPayload) => {
          const doc = this.documentEngine.getDocument(payload.documentId);
          if (!doc) return;
          if (doc.isDirty) {
            this.scheduleAutoSave(doc);
          } else {
            this.cancelAutoSaveTimer(doc.id);
          }
        }
      )
    );

    // 2. Dirty Changed
    this.unbinders.push(
      this.documentEngine.on(
        'document.dirtyChanged',
        async (payload: DocumentDirtyChangedEventPayload) => {
          const doc = this.documentEngine.getDocument(payload.documentId);
          if (!doc) return;
          if (payload.isDirty) {
            this.scheduleAutoSave(doc);
          } else {
            this.cancelAutoSaveTimer(doc.id);
          }
        }
      )
    );

    // 3. Document Saved: Successful normal Save supersedes obsolete recovery snapshot
    this.unbinders.push(
      this.documentEngine.on(
        'document.saved',
        async (payload: DocumentSavedEventPayload) => {
          this.cancelAutoSaveTimer(payload.documentId);
          await this.handleDocumentSaved(payload.documentId);
        }
      )
    );

    // 4. Document Closed
    this.unbinders.push(
      this.documentEngine.on(
        'document.closed',
        async (payload: DocumentClosedEventPayload) => {
          this.cancelAutoSaveTimer(payload.documentId);
          // If document was not dirty when closed, clean up snapshot
          await this.handleDocumentSaved(payload.documentId);
        }
      )
    );

    // 5. Document Resource Changed (e.g. Save As)
    this.unbinders.push(
      this.documentEngine.on(
        'document.resourceChanged',
        async (payload: DocumentResourceChangedEventPayload) => {
          // Re-evaluate or remove old resource snapshot
          const recoveryId = `rec_${this.activeSessionId}_${payload.documentId}`;
          await this.repository.deleteSnapshot(recoveryId);
          if (this.activeManifest) {
            this.activeManifest = {
              ...this.activeManifest,
              documents: this.activeManifest.documents.filter(
                (d) => d.recoveryId !== recoveryId
              ),
            };
            await this.repository.saveManifest(this.activeManifest);
          }
        }
      )
    );
  }

  private async handleDocumentSaved(documentId: string): Promise<void> {
    const recoveryId = `rec_${this.activeSessionId}_${documentId}`;
    try {
      await this.repository.deleteSnapshot(recoveryId);
      if (this.activeManifest) {
        const remaining = this.activeManifest.documents.filter(
          (d) => d.recoveryId !== recoveryId
        );
        this.activeManifest = {
          ...this.activeManifest,
          lastUpdatedAt: Date.now(),
          documents: remaining,
        };
        await this.repository.saveManifest(this.activeManifest);
      }
    } catch (err) {
      logger.warn(
        `DocumentRecoveryCoordinator: failed to clean obsolete snapshot for doc "${documentId}": ${
          (err as Error).message
        }`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Recovery Candidate Discovery & Evaluation
  // ---------------------------------------------------------------------------

  public async discoverCandidates(
    workspaceId?: string
  ): Promise<RecoveryDiscoveryResult> {
    const lastSession = await this.repository.getActiveSession();
    const allManifests = await this.repository.listManifests();

    const candidates: RecoveryCandidateEvaluation[] = [];
    let wasAbnormalTermination = false;

    // Abnormal termination check:
    // If last recorded session was not clean, or previous session has dirty documents
    if (lastSession && lastSession.state !== 'clean') {
      wasAbnormalTermination = true;
    }

    for (const manifest of allManifests) {
      // Exclude current active session
      if (manifest.sessionId === this.activeSessionId) {
        continue;
      }

      // Check if session had unconfirmed work
      if (manifest.state !== 'clean' && manifest.documents.length > 0) {
        wasAbnormalTermination = true;
      }

      // Workspace Isolation: If workspaceId is specified, only evaluate candidates
      // associated with that workspace (or untitled docs without workspace constraints)
      for (const candidateDoc of manifest.documents) {
        if (
          workspaceId &&
          candidateDoc.workspaceId &&
          candidateDoc.workspaceId !== workspaceId
        ) {
          continue;
        }

        const evaluation = await this.evaluateCandidate(candidateDoc);
        candidates.push(evaluation);
      }
    }

    return {
      previousSessionId: lastSession?.sessionId,
      previousSessionState: lastSession?.state,
      wasAbnormalTermination,
      candidates,
    };
  }

  public async evaluateCandidate(
    candidate: RecoveryDocumentDTO
  ): Promise<RecoveryCandidateEvaluation> {
    // 1. Fetch snapshot
    const snapshot = await this.repository.getSnapshot(candidate.recoveryId);
    if (!snapshot) {
      return {
        candidate,
        decision: 'corrupt',
        explanation: 'Recovery snapshot payload missing from storage.',
      };
    }

    // 2. Validate snapshot integrity
    const computedChecksum = StorageSerializer.computeChecksum(snapshot.content);
    if (computedChecksum !== snapshot.checksum) {
      return {
        candidate,
        decision: 'corrupt',
        explanation: 'Snapshot integrity checksum mismatch. Data may be corrupted.',
        snapshot,
      };
    }

    // 3. Untitled Document Evaluation
    if (candidate.isUntitled || !candidate.resourceUri) {
      return {
        candidate,
        decision: 'untitled_recovery',
        explanation: 'Unsaved untitled document candidate from previous session.',
        snapshot,
      };
    }

    // 4. Existing File Evaluation
    const targetUri = candidate.resourceUri;
    const existingDoc = this.documentEngine.getByResource(targetUri);

    // If currently open and clean with identical content
    if (existingDoc && !existingDoc.isDirty && existingDoc.content === snapshot.content) {
      return {
        candidate,
        decision: 'no_recovery_needed',
        explanation: 'Document content is already present and matches snapshot.',
        snapshot,
      };
    }

    // Compare base filesystem metadata vs current state
    const base = candidate.baseFileMetadata;
    const currentDoc = this.documentEngine.getByResource(targetUri);
    const diskExists = currentDoc ? currentDoc.resource.exists : true;
    const diskSize = currentDoc?.resource.size;
    const diskModifiedAt =
      currentDoc?.resource.modifiedTime ?? currentDoc?.metadata.modifiedTime;

    if (!diskExists) {
      return {
        candidate,
        decision: 'original_missing',
        explanation: 'Original filesystem resource no longer exists on disk.',
        snapshot,
        diskStats: { exists: false },
      };
    }

    if (base && diskModifiedAt !== undefined && base.modifiedAt !== undefined) {
      if (diskModifiedAt > base.modifiedAt) {
        // Disk changed after snapshot base
        if (currentDoc && currentDoc.content === snapshot.content) {
          return {
            candidate,
            decision: 'no_recovery_needed',
            explanation: 'Disk was updated with the same content as the snapshot.',
            snapshot,
            diskStats: {
              exists: true,
              size: diskSize,
              modifiedAt: diskModifiedAt,
            },
          };
        }
        return {
          candidate,
          decision: 'conflict',
          explanation:
            'Both recovery snapshot and disk file were modified after base state.',
          snapshot,
          diskStats: {
            exists: true,
            size: diskSize,
            modifiedAt: diskModifiedAt,
          },
        };
      }
    }

    // Normal safe recovery candidate: snapshot is newer than disk baseline
    return {
      candidate,
      decision: 'recovery_available',
      explanation: 'Unsaved work detected that is newer than the disk version.',
      snapshot,
      diskStats: {
        exists: true,
        size: diskSize,
        modifiedAt: diskModifiedAt,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Safe Restoration & Safe Discard
  // ---------------------------------------------------------------------------

  /**
   * Safely restores an unsaved recovery candidate through DocumentEngine.
   * - Never touches or overwrites the original disk file.
   * - Marks restored document as dirty.
   * - Explicit manual Save is required to persist restored content.
   */
  public async restoreCandidate(
    recoveryId: string
  ): Promise<RecoveryRestoreResult> {
    const snapshot = await this.repository.getSnapshot(recoveryId);
    if (!snapshot) {
      return {
        recoveryId,
        restoredTitle: 'Unknown',
        isUntitled: false,
        isDirty: false,
        status: 'failed',
        error: `Recovery snapshot "${recoveryId}" not found in storage.`,
      };
    }

    // Verify integrity before restore
    const checksum = StorageSerializer.computeChecksum(snapshot.content);
    if (checksum !== snapshot.checksum) {
      return {
        recoveryId,
        restoredTitle: 'Corrupt',
        isUntitled: snapshot.isUntitled,
        isDirty: false,
        status: 'failed',
        error: 'Cannot restore corrupt snapshot (checksum verification failed).',
      };
    }

    try {
      if (snapshot.isUntitled || !snapshot.resourceUri) {
        // 1. Untitled document restoration: create untitled document with recovered content
        const restoredDoc = await this.documentEngine.createUntitled({
          title: `Recovered ${new Date(snapshot.createdAt).toLocaleTimeString()}`,
          content: snapshot.content,
          workspaceId: this.currentWorkspaceId,
        });

        // Delete recovery snapshot once safely loaded into DocumentEngine
        await this.discardCandidate(recoveryId);

        return {
          recoveryId,
          documentId: restoredDoc.id,
          restoredTitle: restoredDoc.title,
          isUntitled: true,
          isDirty: true,
          status: 'restored',
        };
      } else {
        // 2. Existing file restoration:
        // Open resource (reads original base from disk)
        const openResult = await this.documentEngine.openResource(
          snapshot.resourceUri,
          { activate: true }
        );
        const doc = openResult.document;

        // Apply recovered text through DocumentEngine updateText API
        // This ensures the disk file remains UNTOUCHED, savedBaseline remains disk content,
        // and document is marked dirty!
        await this.documentEngine.updateText(doc.id, snapshot.content, 'recovery');

        // Delete recovery snapshot once restored
        await this.discardCandidate(recoveryId);

        return {
          recoveryId,
          documentId: doc.id,
          restoredTitle: doc.title,
          isUntitled: false,
          isDirty: true,
          status: 'restored',
        };
      }
    } catch (err) {
      return {
        recoveryId,
        restoredTitle: 'Error',
        isUntitled: snapshot.isUntitled,
        isDirty: false,
        status: 'failed',
        error: `Restoration failed: ${(err as Error).message}`,
      };
    }
  }

  /**
   * Safely discards a recovery candidate.
   * Deletes temporary snapshot, leaves original disk file untouched.
   */
  public async discardCandidate(recoveryId: string): Promise<boolean> {
    try {
      const deleted = await this.repository.deleteSnapshot(recoveryId);

      // Clean manifest references
      const manifests = await this.repository.listManifests();
      for (const m of manifests) {
        const hasDoc = m.documents.some((d) => d.recoveryId === recoveryId);
        if (hasDoc) {
          const updated = {
            ...m,
            lastUpdatedAt: Date.now(),
            documents: m.documents.filter((d) => d.recoveryId !== recoveryId),
          };
          await this.repository.saveManifest(updated);
        }
      }

      logger.info(
        `DocumentRecoveryCoordinator: discarded recovery candidate "${recoveryId}".`
      );
      return deleted;
    } catch (err) {
      logger.warn(
        `Failed to discard recovery candidate "${recoveryId}": ${
          (err as Error).message
        }`
      );
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Subsystem Health & Diagnostics
  // ---------------------------------------------------------------------------

  public getHealth(): RecoveryHealthReport {
    return {
      state: !this.enabled ? 'disabled' : this.healthState,
      activeSessionId: this.activeSessionId,
      pendingSnapshotsCount: this.autoSaveTimers.size,
      activeCandidatesCount: this.activeManifest?.documents.length || 0,
      lastSnapshotAt: this.lastSnapshotAt,
      issues: [...this.issues],
    };
  }

  private recordIssue(message: string): void {
    logger.warn(`DocumentRecoveryCoordinator issue: ${message}`);
    this.issues.push(`[${new Date().toISOString()}] ${message}`);
    if (this.issues.length > 50) {
      this.issues.shift();
    }
    this.healthState = 'degraded';
  }

  private loadSettings(): void {
    if (!this.settingsService) return;
    try {
      if (!this.customEnabledProvided) {
        const isEnabled = this.settingsService.get<boolean>('files.recoveryEnabled');
        if (typeof isEnabled === 'boolean') {
          this.enabled = isEnabled;
        }
      }
      if (!this.customDelayProvided) {
        const delay = this.settingsService.get<number>('files.autoSaveDelay');
        if (typeof delay === 'number' && delay >= 200 && delay <= 30000) {
          this.autoSaveDelayMs = delay;
        }
      }
    } catch {
      // Fallback to constructor defaults
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Disposal
  // ---------------------------------------------------------------------------

  public async dispose(): Promise<void> {
    this.isDisposed = true;

    // Clear all pending timers
    for (const timer of this.autoSaveTimers.values()) {
      clearTimeout(timer);
    }
    this.autoSaveTimers.clear();

    // Drain in-flight snapshot writes
    if (this.inFlightWrites.size > 0) {
      await Promise.allSettled(Array.from(this.inFlightWrites.values()));
    }
    this.inFlightWrites.clear();

    // Unbind document listeners
    for (const unbind of this.unbinders) {
      try {
        unbind();
      } catch {
        // ignore
      }
    }
    this.unbinders = [];

    DocumentRecoveryCoordinator.instance = null;
    logger.info('DocumentRecoveryCoordinator disposed.');
  }
}

export const globalDocumentRecoveryCoordinator = DocumentRecoveryCoordinator.getInstance();
