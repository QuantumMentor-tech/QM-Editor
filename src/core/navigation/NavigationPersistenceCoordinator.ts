/**
 * QM Editor Navigation Persistence Coordinator
 * Phase 05, Step 50 — Persistent Recent Resources, Navigation History & User Activity State
 */

import {
  INavigationHistoryRepository,
  globalNavigationHistoryRepository,
} from '../storage/repositories/NavigationHistoryRepository';
import {
  NavigationHistoryDTO,
  PersistentNavigationLocationDTO,
} from '../storage/StorageTypes';
import { NavigationCoordinator, globalNavigationCoordinator } from './NavigationCoordinator';
import { NavigationService, globalNavigationService } from '../../services/NavigationService';
import { RecentDocumentsService } from '../../services/RecentDocumentsService';
import { globalWorkspaceEngine, WorkspaceEngine } from '../workspace';
import { globalDocumentEngine, DocumentEngine } from '../documents';
import { fileService, FileService } from '../../services/FileService';
import { EditorLocation, NavigationHistoryState } from '../../types';
import { logger } from '../../utils/logger';

export class NavigationPersistenceCoordinator {
  private static instance: NavigationPersistenceCoordinator | null = null;

  private isInitialized: boolean = false;
  private isDisposed: boolean = false;
  private activeWorkspaceGeneration: number = 0;
  private currentWorkspaceId: string = 'default';

  private debounceTimer: any = null;
  private pendingOperations: Set<Promise<any>> = new Set();
  private unregisterNavigationListener: (() => void) | null = null;

  constructor(
    private readonly navigationCoordinator: NavigationCoordinator = globalNavigationCoordinator,
    private readonly navigationService: NavigationService = globalNavigationService,
    private repository: INavigationHistoryRepository = globalNavigationHistoryRepository,
    private readonly workspaceEngine: WorkspaceEngine = globalWorkspaceEngine,
    private readonly documentEngine: DocumentEngine = globalDocumentEngine,
    private readonly files: FileService = fileService
  ) {}

  public static getInstance(): NavigationPersistenceCoordinator {
    if (!NavigationPersistenceCoordinator.instance) {
      NavigationPersistenceCoordinator.instance = new NavigationPersistenceCoordinator();
    }
    return NavigationPersistenceCoordinator.instance;
  }

  /**
   * Initializes the coordinator, connects navigation events, and restores history.
   */
  public async initialize(
    repository: INavigationHistoryRepository = globalNavigationHistoryRepository,
    workspaceId?: string
  ): Promise<void> {
    if (this.isDisposed) {
      this.isDisposed = false;
    }

    this.repository = repository;
    const activeWs = workspaceId || this.workspaceEngine.getWorkspaceId() || 'default';
    this.currentWorkspaceId = activeWs;

    // Attach to navigation completion events to debounce-persist history
    if (!this.unregisterNavigationListener) {
      this.unregisterNavigationListener = this.navigationCoordinator.on(
        'navigation.completed',
        (payload) => {
          this.handleNavigationCompleted(payload);
        }
      );
    }

    this.isInitialized = true;

    // Restore existing history for active workspace
    await this.restore(activeWs);

    logger.info('NavigationPersistenceCoordinator initialized successfully', {
      workspaceId: activeWs,
    });
  }

  public isReady(): boolean {
    return this.isInitialized && !this.isDisposed;
  }

  public getRepository(): INavigationHistoryRepository {
    return this.repository;
  }

  /**
   * Switches workspace context with generation protection.
   * Flushes outgoing history, clears memory stack, and restores incoming workspace history.
   */
  public async switchWorkspace(workspaceId: string): Promise<void> {
    if (this.currentWorkspaceId === workspaceId) return;

    const oldWs = this.currentWorkspaceId;
    // 1. Flush outgoing workspace history
    await this.flush();

    // 2. Clear in-memory stack to prevent cross-workspace contamination
    this.navigationService.clearHistory();

    // 3. Increment generation
    const gen = ++this.activeWorkspaceGeneration;
    this.currentWorkspaceId = workspaceId;

    // 4. Restore new workspace history
    await this.restore(workspaceId, gen);

    logger.info('NavigationPersistenceCoordinator switched workspace context', {
      from: oldWs,
      to: workspaceId,
      generation: gen,
    });
  }

  /**
   * Restores persistent navigation history from storage repository.
   * Validates locations, safely skips missing resources, clamps ranges,
   * and populates NavigationService.
   */
  public async restore(workspaceId?: string, expectedGeneration?: number): Promise<boolean> {
    const targetWs = workspaceId || this.currentWorkspaceId;
    const gen = expectedGeneration !== undefined ? expectedGeneration : this.activeWorkspaceGeneration;

    try {
      let historyDTO = await this.repository.getNavigationHistory(targetWs);
      if (!historyDTO && targetWs && targetWs !== 'default') {
        historyDTO = await this.repository.getNavigationHistory(undefined);
      }
      if (!historyDTO) {
        return false;
      }

      // Generational safety check: discard if workspace changed during async fetch
      if (gen !== this.activeWorkspaceGeneration) {
        logger.warn('Discarded stale navigation history restoration due to concurrent workspace switch', {
          restoredFor: targetWs,
          activeWorkspace: this.currentWorkspaceId,
        });
        return false;
      }

      // Validate backStack and forwardStack locations
      const validatedBackStack = await this.validateLocationDTOs(historyDTO.backStack);
      const validatedForwardStack = await this.validateLocationDTOs(historyDTO.forwardStack);

      let validatedCurrent: EditorLocation | null = null;
      if (historyDTO.currentLocation) {
        const validated = await this.validateLocationDTO(historyDTO.currentLocation);
        if (validated) {
          validatedCurrent = validated;
        }
      }

      // Generational check before applying
      if (gen !== this.activeWorkspaceGeneration) {
        return false;
      }

      const restoredState: NavigationHistoryState = {
        backStack: validatedBackStack,
        forwardStack: validatedForwardStack,
        currentLocation: validatedCurrent,
      };

      this.navigationService.loadHistoryState(restoredState);

      logger.info('Restored persistent navigation history', {
        workspaceId: targetWs,
        backCount: validatedBackStack.length,
        forwardCount: validatedForwardStack.length,
        hasCurrent: Boolean(validatedCurrent),
      });

      return true;
    } catch (err) {
      logger.error('Failed to restore navigation history from repository; keeping empty state', err);
      return false;
    }
  }

  /**
   * Persists current navigation history state to storage repository.
   */
  public async persist(workspaceId?: string): Promise<void> {
    if (this.isDisposed) return;
    const targetWs = workspaceId || this.currentWorkspaceId;

    const state = this.navigationService.getState();

    const historyDTO: NavigationHistoryDTO = {
      version: 1,
      backStack: state.backStack.map((loc) => this.mapLocationToDTO(loc, targetWs)),
      forwardStack: state.forwardStack.map((loc) => this.mapLocationToDTO(loc, targetWs)),
      currentLocation: state.currentLocation
        ? this.mapLocationToDTO(state.currentLocation, targetWs)
        : null,
      updatedAt: Date.now(),
    };

    try {
      await this.repository.saveNavigationHistory(historyDTO, targetWs);
    } catch (err) {
      logger.error('Failed to save navigation history to repository', err);
      throw err;
    }
  }

  /**
   * Handles document/resource rename event by updating locations in memory and storage.
   */
  public async handleResourceRenamed(oldUri: string, newUri: string): Promise<void> {
    this.navigationService.updateResourceUri(oldUri, newUri);
    RecentDocumentsService.updateResourceUri(oldUri, newUri, this.currentWorkspaceId);
    await this.persist(this.currentWorkspaceId);
  }

  /**
   * Handles document/resource deletion event by pruning locations in memory and storage.
   */
  public async handleResourceDeleted(uri: string): Promise<void> {
    this.navigationService.removeDocumentEntries(uri);
    RecentDocumentsService.removeRecentDocument(uri, this.currentWorkspaceId);
    await this.persist(this.currentWorkspaceId);
  }

  /**
   * Clears all navigation history for a workspace or globally.
   */
  public async clearHistory(workspaceId?: string): Promise<void> {
    const targetWs = workspaceId || this.currentWorkspaceId;
    this.navigationService.clearHistory();
    await this.repository.clearNavigationHistory(targetWs);
  }

  /**
   * Flushes any pending debounced writes immediately.
   */
  public async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    try {
      await this.persist(this.currentWorkspaceId);
    } catch {
      // non-fatal during flush
    }

    await Promise.allSettled(Array.from(this.pendingOperations));
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.unregisterNavigationListener) {
      this.unregisterNavigationListener();
      this.unregisterNavigationListener = null;
    }

    this.pendingOperations.clear();
    this.isInitialized = false;
  }

  public resetForTesting(): void {
    this.dispose();
    this.activeWorkspaceGeneration = 0;
    this.currentWorkspaceId = 'default';
    this.navigationService.clearHistory();
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers & Validation
  // ---------------------------------------------------------------------------

  private handleNavigationCompleted(payload: {
    location: { uri: string; range?: { startLine: number; startColumn: number } };
    documentId: string;
  }): void {
    const uri = payload.location.uri;
    const line = payload.location.range?.startLine || 1;
    const col = payload.location.range?.startColumn || 1;

    // Record into recent documents
    RecentDocumentsService.addRecentDocument(
      uri,
      undefined,
      this.currentWorkspaceId,
      line,
      col
    );

    // Debounce persistent history write (300ms)
    this.queueDebouncedPersist();
  }

  private queueDebouncedPersist(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      const op = this.persist(this.currentWorkspaceId).catch((err) => {
        logger.error('Background navigation history persistence failed', err);
      });
      this.trackOperation(op);
    }, 300);
  }

  private trackOperation(op: Promise<any>): void {
    this.pendingOperations.add(op);
    op.finally(() => {
      this.pendingOperations.delete(op);
    });
  }

  private async validateLocationDTOs(
    dtos: PersistentNavigationLocationDTO[]
  ): Promise<EditorLocation[]> {
    if (!Array.isArray(dtos)) return [];
    const valid: EditorLocation[] = [];

    for (const dto of dtos) {
      const loc = await this.validateLocationDTO(dto);
      if (loc) {
        valid.push(loc);
      }
    }

    return valid;
  }

  private async validateLocationDTO(
    dto: PersistentNavigationLocationDTO
  ): Promise<EditorLocation | null> {
    if (!dto || typeof dto !== 'object' || !dto.uri || typeof dto.uri !== 'string') {
      return null;
    }

    const uri = dto.uri.trim();
    if (uri.length === 0) return null;

    // Verify resource existence safely
    try {
      const openDoc = this.documentEngine.getByResource(uri);
      if (!openDoc && !uri.startsWith('untitled:')) {
        const exists = await this.files.fileExists(uri);
        if (!exists) {
          // File deleted or moved on disk: skip location safely
          return null;
        }
      }
    } catch {
      // Inaccessible disk: skip location safely
      return null;
    }

    return {
      documentId: uri,
      filePath: uri,
      documentTitle: dto.documentTitle || uri.split('/').pop() || 'Document',
      line: typeof dto.line === 'number' && dto.line >= 1 ? dto.line : 1,
      column: typeof dto.column === 'number' && dto.column >= 1 ? dto.column : 1,
      timestamp: typeof dto.timestamp === 'number' ? dto.timestamp : Date.now(),
    };
  }

  private mapLocationToDTO(
    loc: EditorLocation,
    workspaceId?: string
  ): PersistentNavigationLocationDTO {
    const uri = loc.filePath || loc.documentId;
    return {
      uri,
      line: loc.line,
      column: loc.column,
      documentTitle: loc.documentTitle,
      workspaceId,
      timestamp: loc.timestamp || Date.now(),
    };
  }
}

export const globalNavigationPersistenceCoordinator =
  NavigationPersistenceCoordinator.getInstance();
