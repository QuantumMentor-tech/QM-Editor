/**
 * QM Editor Persistent Recent Resources & Navigation History Tests
 * Phase 05, Step 50 — Persistent Recent Resources, Navigation History & User Activity State
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  StorageService,
  MemoryStorageAdapter,
  globalSchemaRegistry,
  globalMigrationRegistry,
  RecentResourceRepository,
  NavigationHistoryRepository,
} from '../storage';
import { NavigationCoordinator } from './NavigationCoordinator';
import { NavigationService } from '../../services/NavigationService';
import { NavigationPersistenceCoordinator } from './NavigationPersistenceCoordinator';
import { RecentDocumentsService } from '../../services/RecentDocumentsService';
import { DocumentEngine } from '../documents/DocumentEngine';
import { EditorCoordinationService } from '../editor/EditorCoordinationService';
import { WorkspaceEngine } from '../workspace/WorkspaceEngine';
import { FileService } from '../../services/FileService';

describe('Navigation & Recent Resource Persistence Subsystem (Step 50)', () => {
  let adapter: MemoryStorageAdapter;
  let storage: StorageService;
  let navHistoryRepo: NavigationHistoryRepository;
  let recentRepo: RecentResourceRepository;

  let documentEngine: DocumentEngine;
  let editorCoordination: EditorCoordinationService;
  let navigationService: NavigationService;
  let navigationCoordinator: NavigationCoordinator;
  let workspaceEngine: WorkspaceEngine;
  let fileServiceMock: FileService;
  let persistenceCoordinator: NavigationPersistenceCoordinator;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    storage = new StorageService({ adapter });
    await storage.initialize();

    navHistoryRepo = new NavigationHistoryRepository(storage);
    recentRepo = new RecentResourceRepository(storage);

    workspaceEngine = new WorkspaceEngine();
    await workspaceEngine.open('file:///C:/test-workspace');

    documentEngine = new DocumentEngine();
    editorCoordination = new EditorCoordinationService();
    navigationService = new NavigationService();

    // Mock file service for existence checks
    fileServiceMock = {
      fileExists: async (uri: string) => {
        if (uri.includes('deleted-file.ts') || uri.includes('nonexistent')) {
          return false;
        }
        return true;
      },
    } as any;

    navigationCoordinator = new NavigationCoordinator(
      documentEngine,
      editorCoordination,
      navigationService
    );

    persistenceCoordinator = new NavigationPersistenceCoordinator(
      navigationCoordinator,
      navigationService,
      navHistoryRepo,
      workspaceEngine,
      documentEngine,
      fileServiceMock
    );

    RecentDocumentsService.resetForTesting();
    await RecentDocumentsService.initialize(recentRepo, workspaceEngine.getWorkspaceId() ?? undefined);
    await persistenceCoordinator.initialize(navHistoryRepo, workspaceEngine.getWorkspaceId() ?? undefined);
  });

  afterEach(async () => {
    await persistenceCoordinator.flush();
    persistenceCoordinator.dispose();
    RecentDocumentsService.resetForTesting();
    await storage.dispose();
    globalSchemaRegistry.reset();
    globalMigrationRegistry.reset();
  });

  // ---------------------------------------------------------------------------
  // 1. Recent Resources / Recent Documents Tests
  // ---------------------------------------------------------------------------

  describe('Recent Resources & Recent Documents Persistence', () => {
    it('records, deduplicates, and preserves MRU ordering on repeated access', async () => {
      // Access file A, then file B, then file A
      await RecentDocumentsService.addRecentDocumentAsync('file:///C:/fileA.ts', 'fileA.ts');
      await RecentDocumentsService.addRecentDocumentAsync('file:///C:/fileB.ts', 'fileB.ts');
      await RecentDocumentsService.addRecentDocumentAsync('file:///C:/fileA.ts', 'fileA.ts');

      const recents = RecentDocumentsService.getRecentDocuments();
      expect(recents).toHaveLength(2);
      // Most recent should be fileA
      expect(recents[0].uri).toBe('file:///C:/fileA.ts');
      expect(recents[1].uri).toBe('file:///C:/fileB.ts');

      // Check durable storage
      const stored = await recentRepo.getRecentResources(undefined);
      expect(stored).toHaveLength(2);
      expect(stored[0].resourceUri).toBe('file:///C:/fileA.ts');
      expect(stored[0].accessCount).toBe(2);
      expect(stored[1].resourceUri).toBe('file:///C:/fileB.ts');
      expect(stored[1].accessCount).toBe(1);
    });

    it('enforces bounded retention by trimming older entries', async () => {
      // Record 25 distinct files (exceeding MAX_RECENT_DOCUMENTS = 20)
      for (let i = 1; i <= 25; i++) {
        RecentDocumentsService.addRecentDocument(`file:///C:/file${i}.ts`, `file${i}.ts`);
      }

      const recents = RecentDocumentsService.getRecentDocuments();
      expect(recents).toHaveLength(20);
      expect(recents[0].uri).toBe('file:///C:/file25.ts');
      expect(recents[19].uri).toBe('file:///C:/file6.ts');
    });

    it('isolates workspace recent resources while updating global history', async () => {
      await RecentDocumentsService.addRecentDocumentAsync(
        'file:///C:/ws1/file.ts',
        'file.ts',
        'ws-1'
      );
      await RecentDocumentsService.addRecentDocumentAsync(
        'file:///C:/ws2/file.ts',
        'file.ts',
        'ws-2'
      );

      const ws1Recents = await recentRepo.getRecentResources('ws-1');
      const ws2Recents = await recentRepo.getRecentResources('ws-2');
      const globalRecents = await recentRepo.getRecentResources(undefined);

      expect(ws1Recents).toHaveLength(1);
      expect(ws1Recents[0].resourceUri).toBe('file:///C:/ws1/file.ts');

      expect(ws2Recents).toHaveLength(1);
      expect(ws2Recents[0].resourceUri).toBe('file:///C:/ws2/file.ts');

      expect(globalRecents).toHaveLength(2);
    });

    it('updates recent resource paths when a file is renamed', async () => {
      await RecentDocumentsService.addRecentDocumentAsync('file:///C:/old_name.ts', 'old_name.ts');
      expect(RecentDocumentsService.getRecentDocuments()[0].uri).toBe('file:///C:/old_name.ts');

      RecentDocumentsService.updateResourceUri('file:///C:/old_name.ts', 'file:///C:/new_name.ts');
      await RecentDocumentsService.flush();

      const recents = RecentDocumentsService.getRecentDocuments();
      expect(recents[0].uri).toBe('file:///C:/new_name.ts');
      expect(recents[0].name).toBe('new_name.ts');
    });

    it('removes recent resource when deleted', async () => {
      await RecentDocumentsService.addRecentDocumentAsync('file:///C:/to_delete.ts', 'to_delete.ts');
      expect(RecentDocumentsService.getRecentDocuments()).toHaveLength(1);

      RecentDocumentsService.removeRecentDocument('file:///C:/to_delete.ts');
      await RecentDocumentsService.flush();

      expect(RecentDocumentsService.getRecentDocuments()).toHaveLength(0);
      const stored = await recentRepo.getRecentResources(undefined);
      expect(stored).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Navigation History Persistence & Restoration
  // ---------------------------------------------------------------------------

  describe('Navigation History Persistence & Restoration', () => {
    it('persists and accurately restores back/forward navigation state across restarts', async () => {
      // Simulate navigation journey: file1 -> file2 -> file3
      navigationService.pushLocation({
        documentId: 'file:///C:/file1.ts',
        filePath: 'file:///C:/file1.ts',
        line: 10,
        column: 1,
      });
      navigationService.pushLocation({
        documentId: 'file:///C:/file2.ts',
        filePath: 'file:///C:/file2.ts',
        line: 25,
        column: 5,
      });
      navigationService.pushLocation({
        documentId: 'file:///C:/file3.ts',
        filePath: 'file:///C:/file3.ts',
        line: 40,
        column: 1,
      });

      // Navigate back one step (current = file2, forward = file3, back = file1)
      const backLoc = navigationService.navigateBack();
      expect(backLoc?.filePath).toBe('file:///C:/file2.ts');
      expect(navigationService.canNavigateBack()).toBe(true);
      expect(navigationService.canNavigateForward()).toBe(true);

      // Persist state to storage
      await persistenceCoordinator.persist();

      // Verify persistent record in repository
      const wsId = workspaceEngine.getWorkspaceId() ?? undefined;
      const record = await navHistoryRepo.getNavigationHistory(wsId);
      expect(record).not.toBeNull();
      expect(record?.backStack).toHaveLength(1);
      expect(record?.backStack[0].uri).toBe('file:///C:/file1.ts');
      expect(record?.currentLocation?.uri).toBe('file:///C:/file2.ts');
      expect(record?.forwardStack).toHaveLength(1);
      expect(record?.forwardStack[0].uri).toBe('file:///C:/file3.ts');

      // Reset in-memory state (simulating application restart)
      navigationService.clearHistory();
      expect(navigationService.canNavigateBack()).toBe(false);
      expect(navigationService.canNavigateForward()).toBe(false);

      // Restore from persistent storage
      const restored = await persistenceCoordinator.restore(wsId);
      expect(restored).toBe(true);

      // Verify in-memory state is restored faithfully
      expect(navigationService.canNavigateBack()).toBe(true);
      expect(navigationService.canNavigateForward()).toBe(true);
      expect(navigationService.getState().currentLocation?.filePath).toBe('file:///C:/file2.ts');
      expect(navigationService.getPreviousLocation()?.filePath).toBe('file:///C:/file1.ts');
      expect(navigationService.getNextLocation()?.filePath).toBe('file:///C:/file3.ts');
    });

    it('safely skips missing or deleted files during history restoration without crashing', async () => {
      // Save history containing one valid file and one deleted file
      await navHistoryRepo.saveNavigationHistory({
        version: 1,
        backStack: [
          {
            uri: 'file:///C:/deleted-file.ts', // will fail fileExists check
            line: 5,
            column: 1,
            timestamp: Date.now(),
          },
          {
            uri: 'file:///C:/exists.ts', // passes fileExists check
            line: 12,
            column: 4,
            timestamp: Date.now(),
          },
        ],
        forwardStack: [],
        currentLocation: {
          uri: 'file:///C:/file1.ts',
          line: 1,
          column: 1,
          timestamp: Date.now(),
        },
        updatedAt: Date.now(),
      });

      navigationService.clearHistory();
      const restored = await persistenceCoordinator.restore(workspaceEngine.getWorkspaceId() ?? undefined);
      expect(restored).toBe(true);

      // The deleted file should be filtered out, leaving only the existing file in backStack
      const state = navigationService.getState();
      expect(state.backStack).toHaveLength(1);
      expect(state.backStack[0].filePath).toBe('file:///C:/exists.ts');
      expect(state.currentLocation?.filePath).toBe('file:///C:/file1.ts');
    });

    it('clears forward stack when a new navigation jump occurs', async () => {
      navigationService.pushLocation({
        documentId: 'file:///C:/file1.ts',
        filePath: 'file:///C:/file1.ts',
        line: 10,
        column: 1,
      });
      navigationService.pushLocation({
        documentId: 'file:///C:/file2.ts',
        filePath: 'file:///C:/file2.ts',
        line: 20,
        column: 1,
      });

      navigationService.navigateBack();
      expect(navigationService.canNavigateForward()).toBe(true);

      // New branch jump to file3
      navigationService.pushLocation({
        documentId: 'file:///C:/file3.ts',
        filePath: 'file:///C:/file3.ts',
        line: 30,
        column: 1,
      });

      // Forward stack must be cleared
      expect(navigationService.canNavigateForward()).toBe(false);
    });

    it('retrieves distinct recent locations via getLocations()', () => {
      navigationService.pushLocation({
        documentId: 'file:///C:/file1.ts',
        filePath: 'file:///C:/file1.ts',
        line: 10,
        column: 1,
      });
      navigationService.pushLocation({
        documentId: 'file:///C:/file1.ts',
        filePath: 'file:///C:/file1.ts',
        line: 10, // Duplicate line jump
        column: 1,
      });
      navigationService.pushLocation({
        documentId: 'file:///C:/file2.ts',
        filePath: 'file:///C:/file2.ts',
        line: 50,
        column: 1,
      });

      const locs = navigationService.getLocations();
      expect(locs).toHaveLength(2);
      expect(locs[0].filePath).toBe('file:///C:/file2.ts');
      expect(locs[1].filePath).toBe('file:///C:/file1.ts');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Workspace Isolation & Generational Protection
  // ---------------------------------------------------------------------------

  describe('Workspace Isolation & Generational Safety', () => {
    it('maintains strict isolation between Workspace A and Workspace B navigation history', async () => {
      // 1. In Workspace A, record navigation
      await persistenceCoordinator.switchWorkspace('ws-A');
      navigationService.pushLocation({
        documentId: 'file:///C:/wsA-doc.ts',
        filePath: 'file:///C:/wsA-doc.ts',
        line: 15,
        column: 1,
      });
      await persistenceCoordinator.flush();

      // 2. Switch to Workspace B
      await persistenceCoordinator.switchWorkspace('ws-B');
      expect(navigationService.canNavigateBack()).toBe(false);

      navigationService.pushLocation({
        documentId: 'file:///C:/wsB-doc.ts',
        filePath: 'file:///C:/wsB-doc.ts',
        line: 99,
        column: 1,
      });
      await persistenceCoordinator.flush();

      // 3. Switch back to Workspace A
      await persistenceCoordinator.switchWorkspace('ws-A');
      expect(navigationService.getState().currentLocation?.filePath).toBe('file:///C:/wsA-doc.ts');

      // 4. Switch back to Workspace B
      await persistenceCoordinator.switchWorkspace('ws-B');
      expect(navigationService.getState().currentLocation?.filePath).toBe('file:///C:/wsB-doc.ts');
    });

    it('discards late asynchronous history restorations if workspace switches mid-flight', async () => {
      let resolveSlowFetch: (val: any) => void;
      const slowPromise = new Promise((res) => {
        resolveSlowFetch = res;
      });

      const originalGet = navHistoryRepo.getNavigationHistory.bind(navHistoryRepo);
      navHistoryRepo.getNavigationHistory = async (wsId?: string) => {
        if (wsId === 'slow-ws') {
          await slowPromise;
          return {
            version: 1,
            backStack: [
              { uri: 'file:///C:/file1.ts', line: 1, column: 1, timestamp: Date.now() },
            ],
            forwardStack: [],
            currentLocation: null,
            updatedAt: Date.now(),
          };
        }
        return originalGet(wsId);
      };

      // Start restore on slow-ws
      const slowRestore = persistenceCoordinator.restore('slow-ws', (persistenceCoordinator as any).activeWorkspaceGeneration);

      // Rapidly switch to fast-ws
      await persistenceCoordinator.switchWorkspace('fast-ws');
      navigationService.pushLocation({
        documentId: 'file:///C:/fast.ts',
        filePath: 'file:///C:/fast.ts',
        line: 42,
        column: 1,
      });

      // Now resolve slow fetch
      resolveSlowFetch!({});
      await slowRestore;

      // Active workspace must NOT be contaminated by slow-ws
      expect(navigationService.getState().currentLocation?.filePath).toBe('file:///C:/fast.ts');
      expect(navigationService.getState().backStack).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Resource Renaming & Deletion Synchronization
  // ---------------------------------------------------------------------------

  describe('Resource Lifecycle Synchronization', () => {
    it('updates navigation history references when a file is renamed', async () => {
      navigationService.pushLocation({
        documentId: 'file:///C:/old.ts',
        filePath: 'file:///C:/old.ts',
        line: 20,
        column: 1,
      });

      await persistenceCoordinator.handleResourceRenamed(
        'file:///C:/old.ts',
        'file:///C:/renamed.ts'
      );

      const state = navigationService.getState();
      expect(state.currentLocation?.filePath).toBe('file:///C:/renamed.ts');

      const stored = await navHistoryRepo.getNavigationHistory(workspaceEngine.getWorkspaceId() ?? undefined);
      expect(stored?.currentLocation?.uri).toBe('file:///C:/renamed.ts');
    });

    it('clears navigation history references when a file is deleted', async () => {
      navigationService.pushLocation({
        documentId: 'file:///C:/delete-me.ts',
        filePath: 'file:///C:/delete-me.ts',
        line: 20,
        column: 1,
      });

      await persistenceCoordinator.handleResourceDeleted('file:///C:/delete-me.ts');

      const state = navigationService.getState();
      expect(state.currentLocation).toBeNull();
      expect(state.backStack).toHaveLength(0);

      const stored = await navHistoryRepo.getNavigationHistory(workspaceEngine.getWorkspaceId() ?? undefined);
      expect(stored?.currentLocation).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Failure Handling, Storage Read-Only & Schema Migration
  // ---------------------------------------------------------------------------

  describe('Failure Handling & Schema Migration', () => {
    it('retains in-memory navigation function when storage is read-only', async () => {
      adapter.setReadOnly(true);

      // In-memory navigation still works cleanly
      navigationService.pushLocation({
        documentId: 'file:///C:/file1.ts',
        filePath: 'file:///C:/file1.ts',
        line: 10,
        column: 1,
      });
      expect(navigationService.getState().currentLocation?.line).toBe(10);

      // Persistence throws or fails safely without breaking runtime navigation
      await expect(persistenceCoordinator.persist()).rejects.toThrow();
      expect(navigationService.getState().currentLocation?.line).toBe(10);
    });

    it('migrates navigation history across schema versions via MigrationRegistry', async () => {
      // Register a v1 -> v2 migration
      globalMigrationRegistry.registerMigration({
        schemaId: 'qm.navigation.history',
        fromVersion: 1,
        toVersion: 2,
        description: 'Upgrade navigation history to v2 with added breadcrumb field',
        migrate: (from: any) => {
          return {
            ...from,
            version: 2,
            backStack: from.backStack.map((item: any) => ({
              ...item,
              breadcrumb: item.documentTitle || 'File',
            })),
          };
        },
      });

      // Write a v1 record to storage
      await storage.write(
        'navigation_history',
        'qm.navigation.history',
        {
          version: 1,
          backStack: [{ uri: 'file:///C:/file1.ts', line: 10, column: 1, timestamp: Date.now() }],
          forwardStack: [],
          currentLocation: null,
          updatedAt: Date.now(),
        },
        'application'
      );

      const record = await storage.read<any>('app:navigation_history', 'qm.navigation.history');
      expect(record?.schemaVersion).toBe(1);

      // Migrate record to v2
      const migrated = await globalMigrationRegistry.migrateRecord<any>(record!, 2);
      expect(migrated.schemaVersion).toBe(2);
      expect(migrated.payload.backStack[0].breadcrumb).toBe('File');
    });
  });
});
