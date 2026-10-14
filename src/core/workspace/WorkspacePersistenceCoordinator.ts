/**
 * QM Editor Workspace Persistence Coordinator
 * Phase 05, Step 47 — Persistent Workspace State, Metadata & Session Storage
 */

import {
  WorkspaceModel,
  SessionRestoreResult,
  WorkspacePersistenceConfig,
} from './WorkspaceTypes';
import { WorkspaceEngine, globalWorkspaceEngine } from './WorkspaceEngine';
import {
  IWorkspaceStateRepository,
  globalWorkspaceStateRepository,
} from '../storage/repositories/WorkspaceStateRepository';
import {
  ISessionStateRepository,
  globalSessionStateRepository,
} from '../storage/repositories/SessionStateRepository';
import {
  WorkspaceMetadataDTO,
  WorkspaceSessionDTO,
  RecentWorkspaceDTO,
} from '../storage/StorageTypes';
import { DocumentEngine, globalDocumentEngine } from '../documents/DocumentEngine';
import {
  EditorCoordinationService,
  globalEditorCoordinationService,
} from '../editor/EditorCoordinationService';
import { normalizeWorkspacePath } from './WorkspaceResourceBoundary';
import { logger } from '../../utils/logger';

export interface CoordinatorDependencies {
  workspaceEngine?: WorkspaceEngine;
  workspaceRepo?: IWorkspaceStateRepository;
  sessionRepo?: ISessionStateRepository;
  documentEngine?: DocumentEngine;
  editorCoordination?: EditorCoordinationService;
  config?: WorkspacePersistenceConfig;
}

export class WorkspacePersistenceCoordinator {
  private static instance: WorkspacePersistenceCoordinator;

  private workspaceEngine: WorkspaceEngine;
  private workspaceRepo: IWorkspaceStateRepository;
  private sessionRepo: ISessionStateRepository;
  private documentEngine: DocumentEngine;
  private editorCoordination: EditorCoordinationService;

  private config: Required<WorkspacePersistenceConfig>;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isDisposed: boolean = false;
  private unregisterListeners: Array<() => void> = [];

  constructor(deps: CoordinatorDependencies = {}) {
    this.workspaceEngine = deps.workspaceEngine || globalWorkspaceEngine;
    this.workspaceRepo = deps.workspaceRepo || globalWorkspaceStateRepository;
    this.sessionRepo = deps.sessionRepo || globalSessionStateRepository;
    this.documentEngine = deps.documentEngine || globalDocumentEngine;
    this.editorCoordination = deps.editorCoordination || globalEditorCoordinationService;

    this.config = {
      autoSaveSession: deps.config?.autoSaveSession ?? true,
      debounceMs: deps.config?.debounceMs ?? 300,
      maxRecentWorkspaces: deps.config?.maxRecentWorkspaces ?? 10,
    };
  }

  private getWorkspaceEngine(): WorkspaceEngine {
    return this.workspaceEngine || globalWorkspaceEngine;
  }

  private getWorkspaceRepo(): IWorkspaceStateRepository {
    return this.workspaceRepo || globalWorkspaceStateRepository;
  }

  private getSessionRepo(): ISessionStateRepository {
    return this.sessionRepo || globalSessionStateRepository;
  }

  private getDocumentEngine(): DocumentEngine {
    return this.documentEngine || globalDocumentEngine;
  }

  private getEditorCoordination(): EditorCoordinationService {
    return this.editorCoordination || globalEditorCoordinationService;
  }

  public static getInstance(deps?: CoordinatorDependencies): WorkspacePersistenceCoordinator {
    if (!WorkspacePersistenceCoordinator.instance) {
      WorkspacePersistenceCoordinator.instance = new WorkspacePersistenceCoordinator(deps);
    }
    return WorkspacePersistenceCoordinator.instance;
  }

  // ---------------------------------------------------------------------------
  // 1. Initialization & Event Wiring
  // ---------------------------------------------------------------------------

  public initialize(): void {
    if (this.unregisterListeners.length > 0) return;

    // 1. On Workspace Opened
    const unsubOpen = this.getWorkspaceEngine().on('workspace.opened', async (payload) => {
      try {
        const snapshot = this.getWorkspaceEngine().getSnapshot();
        if (snapshot && snapshot.id === payload.workspaceId) {
          await this.persistWorkspaceMetadata(snapshot);
          const primaryRoot = this.getWorkspaceEngine().getPrimaryRoot();
          if (primaryRoot) {
            await this.addRecentWorkspace(primaryRoot.uri, snapshot.name);
          }
        }
      } catch (err) {
        logger.warn('Failed to persist workspace metadata on open.', err);
      }
    });
    this.unregisterListeners.push(unsubOpen);

    // 2. On Workspace Close Requested / Closing
    const unsubClosing = this.getWorkspaceEngine().on('workspace.closing', async (payload) => {
      try {
        await this.persistCurrentSession(payload.workspaceId);
      } catch (err) {
        logger.warn('Failed to flush session state before workspace close.', err);
      }
    });
    this.unregisterListeners.push(unsubClosing);

    // 3. On Workspace Changing
    const unsubChanging = this.getWorkspaceEngine().on('workspace.changing', async (payload) => {
      try {
        if (payload.fromWorkspaceId && payload.fromWorkspaceId !== 'none') {
          await this.persistCurrentSession(payload.fromWorkspaceId);
        }
      } catch (err) {
        logger.warn('Failed to flush session state before workspace switch.', err);
      }
    });
    this.unregisterListeners.push(unsubChanging);

    logger.info('WorkspacePersistenceCoordinator initialized successfully.');
  }

  // ---------------------------------------------------------------------------
  // 2. Metadata Persistence
  // ---------------------------------------------------------------------------

  public async persistWorkspaceMetadata(workspace: WorkspaceModel): Promise<void> {
    const metadata: WorkspaceMetadataDTO = {
      id: workspace.id,
      name: workspace.name,
      roots: workspace.roots.map((r) => ({
        rootId: r.rootId,
        uri: r.uri,
        name: r.name,
      })),
      createdAt: workspace.createdAt,
      lastActiveAt: Date.now(),
    };

    await this.getWorkspaceRepo().saveWorkspaceMetadata(workspace.id, metadata);
    logger.info(`Persisted workspace metadata for "${workspace.id}".`);
  }

  public async getWorkspaceMetadata(workspaceId: string): Promise<WorkspaceMetadataDTO | null> {
    return this.getWorkspaceRepo().getWorkspaceMetadata(workspaceId);
  }

  // ---------------------------------------------------------------------------
  // 3. Recent Workspaces Bounded Storage
  // ---------------------------------------------------------------------------

  public async getRecentWorkspaces(): Promise<RecentWorkspaceDTO[]> {
    return this.getWorkspaceRepo().getRecentWorkspaces();
  }

  public async addRecentWorkspace(uri: string, name?: string): Promise<RecentWorkspaceDTO[]> {
    if (!uri || uri.trim().length === 0) {
      return this.getRecentWorkspaces();
    }

    const normUri = normalizeWorkspacePath(uri);
    const displayName = name && name.trim().length > 0 ? name.trim() : this.deriveDisplayName(normUri);

    const current = await this.getWorkspaceRepo().getRecentWorkspaces();
    // Deduplicate by normalized URI
    const filtered = current.filter((item) => normalizeWorkspacePath(item.path) !== normUri);

    const newItem: RecentWorkspaceDTO = {
      path: normUri,
      name: displayName,
      lastOpened: Date.now(),
    };

    // Keep bounded history (MRU order)
    const updated = [newItem, ...filtered].slice(0, this.config.maxRecentWorkspaces);
    await this.getWorkspaceRepo().saveRecentWorkspaces(updated);
    logger.info(`Updated recent workspaces list with "${normUri}" (count: ${updated.length}).`);
    return updated;
  }

  public async removeRecentWorkspace(uri: string): Promise<RecentWorkspaceDTO[]> {
    if (!uri) return this.getRecentWorkspaces();
    const normUri = normalizeWorkspacePath(uri);

    const current = await this.getWorkspaceRepo().getRecentWorkspaces();
    const updated = current.filter((item) => normalizeWorkspacePath(item.path) !== normUri);

    await this.getWorkspaceRepo().saveRecentWorkspaces(updated);
    return updated;
  }

  public async clearRecentWorkspaces(): Promise<void> {
    await this.getWorkspaceRepo().saveRecentWorkspaces([]);
  }

  private deriveDisplayName(uri: string): string {
    const parts = uri.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : uri;
  }

  // ---------------------------------------------------------------------------
  // 4. Session State Persistence & Debounced Scheduling
  // ---------------------------------------------------------------------------

  /**
   * Schedules a debounced session write. Coalesces rapid sequential edits or tab switches.
   */
  public scheduleSessionSave(): void {
    if (this.isDisposed || !this.config.autoSaveSession) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      this.debounceTimer = null;
      try {
        await this.persistCurrentSession();
      } catch (err) {
        logger.warn('Debounced session save failed.', err);
      }
    }, this.config.debounceMs);
  }

  /**
   * Immediately commits current session state to persistent storage.
   */
  public async persistCurrentSession(explicitWorkspaceId?: string): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const wsId = explicitWorkspaceId || this.getWorkspaceEngine().getWorkspaceId();
    if (!wsId || wsId === 'no-workspace') {
      return;
    }

    // Capture open documents from DocumentEngine
    const openDocs = this.getDocumentEngine().getAllDocuments();
    const openFilePaths: string[] = [];

    const toCleanPath = (uri: string): string => {
      if (uri.startsWith('file:///')) {
        const after = uri.slice('file:///'.length);
        return /^[a-zA-Z]:/.test(after) ? after : `/${after}`;
      }
      return uri;
    };

    const hasRoots = this.getWorkspaceEngine().getRoots().length > 0;

    for (const doc of openDocs) {
      // Exclude untitled in-memory buffers without real filesystem paths
      if (doc.resourceUri.startsWith('untitled:') || doc.resource.scheme === 'untitled') {
        continue;
      }
      // Ensure workspace isolation: only persist resources belonging to the active workspace
      if (hasRoots && !this.getWorkspaceEngine().containsResource(doc.resourceUri)) {
        continue;
      }
      openFilePaths.push(toCleanPath(doc.resourceUri));
    }

    const activeDoc = this.getDocumentEngine().getActiveDocument();
    let activeFilePath: string | undefined = undefined;
    if (activeDoc && !activeDoc.resourceUri.startsWith('untitled:') && activeDoc.resource.scheme !== 'untitled') {
      if (!hasRoots || this.getWorkspaceEngine().containsResource(activeDoc.resourceUri)) {
        activeFilePath = toCleanPath(activeDoc.resourceUri);
      }
    }

    // Capture locations from active editor coordination
    const lastLocations: Record<string, { line: number; column: number }> = {};
    const cursorPos = this.getEditorCoordination().getCursorPosition();
    if (activeFilePath && cursorPos) {
      lastLocations[activeFilePath] = {
        line: cursorPos.line,
        column: cursorPos.column,
      };
    }

    const sessionDTO: WorkspaceSessionDTO = {
      version: 1,
      openFilePaths,
      activeFilePath,
      lastLocations,
      timestamp: Date.now(),
    };

    await this.getSessionRepo().saveWorkspaceSession(wsId, sessionDTO);
    logger.info(`Persisted session for workspace "${wsId}" (${openFilePaths.length} file(s)).`);
  }

  // ---------------------------------------------------------------------------
  // 5. Safe & Resilient Session Restoration
  // ---------------------------------------------------------------------------

  /**
   * Restores previously open resources and view states for the workspace.
   * Tolerates missing, moved, or deleted files without throwing or failing.
   */
  public async restoreSession(
    workspaceId: string,
    expectedGeneration?: number
  ): Promise<SessionRestoreResult> {
    // 1. Generation Check to prevent stale async restoration
    const currentGeneration = this.getWorkspaceEngine().getGeneration();
    if (expectedGeneration !== undefined && expectedGeneration !== currentGeneration) {
      logger.warn(
        `Session restore aborted: generation mismatch (expected ${expectedGeneration}, current ${currentGeneration}).`
      );
      return {
        status: 'stale_generation',
        workspaceId,
        generation: currentGeneration,
        restoredCount: 0,
        skippedPaths: [],
        activeRestored: false,
      };
    }

    // 2. Fetch Stored Session
    const session = await this.getSessionRepo().getWorkspaceSession(workspaceId);
    if (!session || !Array.isArray(session.openFilePaths) || session.openFilePaths.length === 0) {
      return {
        status: 'no_session',
        workspaceId,
        generation: currentGeneration,
        restoredCount: 0,
        skippedPaths: [],
        activeRestored: false,
      };
    }

    logger.info(
      `Restoring session for "${workspaceId}" (${session.openFilePaths.length} stored file(s)).`
    );

    let restoredCount = 0;
    const skippedPaths: string[] = [];
    let activeDocId: string | null = null;

    const toCleanPath = (uri: string): string => {
      let p = normalizeWorkspacePath(uri);
      if (p.startsWith('file:///')) {
        const after = p.slice('file:///'.length);
        p = /^[a-zA-Z]:/.test(after) ? after : `/${after}`;
      }
      return p.toLowerCase();
    };

    // 3. Restore Open Resources with Individual Safety Shields
    for (const rawPath of session.openFilePaths) {
      // Recheck generation before each async file open to detect mid-restore workspace switches
      if (this.getWorkspaceEngine().getGeneration() !== currentGeneration) {
        logger.warn('Session restore interrupted by workspace switch.');
        return {
          status: 'stale_generation',
          workspaceId,
          generation: this.getWorkspaceEngine().getGeneration(),
          restoredCount,
          skippedPaths,
          activeRestored: false,
        };
      }

      if (!rawPath || typeof rawPath !== 'string') continue;
      const normalizedUri = normalizeWorkspacePath(rawPath);

      // Verify containment within workspace boundary
      if (!this.getWorkspaceEngine().containsResource(normalizedUri)) {
        logger.warn(`Skipping out-of-boundary resource during session restore: "${normalizedUri}".`);
        skippedPaths.push(normalizedUri);
        continue;
      }

      try {
        // Open document through canonical DocumentEngine
        const { document: doc } = await this.getDocumentEngine().openResource(normalizedUri);
        restoredCount++;

        // Restore cursor/view state if available
        if (session.lastLocations && session.lastLocations[rawPath]) {
          const loc = session.lastLocations[rawPath];
          const lineCount = (doc.content.match(/\n/g) || []).length + 1;
          const clampedLine = Math.max(1, Math.min(lineCount, Math.round(loc.line)));
          const clampedCol = Math.max(1, Math.round(loc.column));
          this.getEditorCoordination().setCursorPosition({ line: clampedLine, column: clampedCol });
        }

        if (session.activeFilePath && toCleanPath(session.activeFilePath) === toCleanPath(rawPath)) {
          activeDocId = doc.id;
        }
      } catch (err) {
        // Safe skip: missing/deleted files do not block other resources
        logger.warn(`Failed to restore session resource "${normalizedUri}"; safely skipped.`, err);
        skippedPaths.push(normalizedUri);
      }
    }

    // 4. Restore Active Document
    let activeRestored = false;
    if (activeDocId) {
      try {
        this.getDocumentEngine().activateDocument(activeDocId);
        activeRestored = true;
      } catch (err) {
        logger.warn(`Failed to restore active document "${activeDocId}".`, err);
      }
    }

    logger.info(
      `Session restore complete for "${workspaceId}": ${restoredCount} restored, ${skippedPaths.length} skipped.`
    );

    return {
      status: 'restored',
      workspaceId,
      generation: currentGeneration,
      restoredCount,
      skippedPaths,
      activeRestored,
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Legacy Storage Migration
  // ---------------------------------------------------------------------------

  public async migrateLegacyStorage(): Promise<void> {
    try {
      // Migrate legacy recent workspaces
      if (typeof localStorage !== 'undefined') {
        const legacyRecentRaw = localStorage.getItem('qm_editor_recent_workspaces_v1');
        if (legacyRecentRaw) {
          try {
            const parsed = JSON.parse(legacyRecentRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const current = await this.getWorkspaceRepo().getRecentWorkspaces();
              if (current.length === 0) {
                await this.getWorkspaceRepo().saveRecentWorkspaces(parsed);
                logger.info('Migrated legacy recent workspaces to Phase 05 storage repository.');
              }
            }
          } catch {
            // Malformed legacy data, skip
          }
          localStorage.removeItem('qm_editor_recent_workspaces_v1');
        }

        // Migrate legacy session
        const legacySessionRaw = localStorage.getItem('qm_editor_session_v1');
        if (legacySessionRaw) {
          try {
            const parsed = JSON.parse(legacySessionRaw);
            if (parsed && Array.isArray(parsed.openFilePaths)) {
              const currentWsId = this.getWorkspaceEngine().getWorkspaceId();
              if (currentWsId && currentWsId !== 'no-workspace') {
                const existing = await this.getSessionRepo().getWorkspaceSession(currentWsId);
                if (!existing) {
                  await this.getSessionRepo().saveWorkspaceSession(currentWsId, {
                    version: 1,
                    openFilePaths: parsed.openFilePaths,
                    activeFilePath: parsed.activeFilePath,
                    lastLocations: parsed.lastLocations,
                    timestamp: parsed.timestamp || Date.now(),
                  });
                  logger.info('Migrated legacy session to Phase 05 workspace session repository.');
                }
              }
            }
          } catch {
            // Malformed legacy data, skip
          }
          localStorage.removeItem('qm_editor_session_v1');
        }
      }
    } catch (err) {
      logger.warn('Legacy storage migration check completed with warnings.', err);
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Lifecycle, Flush & Reset
  // ---------------------------------------------------------------------------

  public async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.persistCurrentSession();
  }

  public async dispose(): Promise<void> {
    this.isDisposed = true;
    await this.flush();

    for (const unsub of this.unregisterListeners) {
      unsub();
    }
    this.unregisterListeners = [];
    logger.info('WorkspacePersistenceCoordinator disposed.');
  }

  public reset(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isDisposed = false;
  }
}

export const globalWorkspacePersistenceCoordinator =
  WorkspacePersistenceCoordinator.getInstance();
