/**
 * QM Editor Workspace Indexing & Derived Data Persistence Test Suite
 * Phase 05, Step 51 — Persistent Workspace Indexes, Search Cache & Derived Data Storage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkspaceIndexCoordinator } from './WorkspaceIndexCoordinator';
import { WorkspaceIndexService } from '../../services/WorkspaceIndexService';
import { ResourceIndexRepository } from '../storage/repositories/ResourceIndexRepository';
import { StorageService } from '../storage/StorageService';
import { MemoryStorageAdapter } from '../storage/adapters/MemoryStorageAdapter';
import { WorkspaceEngine } from '../workspace/WorkspaceEngine';
import { FileService } from '../../services/FileService';
import { ResourceSynchronizationService } from '../watcher/ResourceSynchronizationService';
import { globalSchemaRegistry } from '../storage/schema/SchemaRegistry';
import { WorkspaceIndexDTO, computeResourceFingerprint } from './IndexTypes';

describe('Workspace Indexing & Derived Data Persistence (Step 51)', () => {
  let adapter: MemoryStorageAdapter;
  let storage: StorageService;
  let repository: ResourceIndexRepository;
  let workspaceEngine: WorkspaceEngine;
  let indexService: WorkspaceIndexService;
  let fileServiceMock: FileService;
  let syncService: ResourceSynchronizationService;
  let coordinator: WorkspaceIndexCoordinator;

  const testWorkspaceId = 'ws-test-indexing';
  const testRootUri = 'file:///C:/projects/myapp';

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    storage = new StorageService({ adapter });
    await storage.initialize();

    repository = new ResourceIndexRepository(storage);
    workspaceEngine = new WorkspaceEngine();
    await workspaceEngine.open(testRootUri);

    indexService = new WorkspaceIndexService();

    // Mock FileService for existence checks
    const existingUris = new Set([
      'file:///C:/projects/myapp/src/index.ts',
      'file:///C:/projects/myapp/src/utils.ts',
      'file:///C:/projects/myapp/package.json',
      'file:///C:/projects/myapp/README.md',
    ]);

    fileServiceMock = {
      fileExists: async (uri: string) => existingUris.has(uri),
      stat: async (_uri: string) => ({
        size: 1024,
        modifiedAt: 1700000000000,
      }),
    } as any;

    syncService = new ResourceSynchronizationService();

    coordinator = new WorkspaceIndexCoordinator(
      workspaceEngine,
      indexService,
      repository,
      fileServiceMock,
      syncService
    );
  });

  afterEach(async () => {
    await coordinator.flush();
    coordinator.dispose();
    await storage.dispose();
  });

  // ---------------------------------------------------------------------------
  // 1. DTO Model, Schema Validation & Fingerprints
  // ---------------------------------------------------------------------------

  describe('Model, Schema & Fingerprints', () => {
    it('computes consistent advisory fingerprints from file metadata', () => {
      const fp1 = computeResourceFingerprint(2048, 1710000000000);
      expect(fp1).toBe('2048:1710000000000');

      // Handles undefined / non-numeric gracefully
      const fp2 = computeResourceFingerprint(undefined, undefined);
      expect(fp2).toBe('0:0');
    });

    it('validates schema conformity for qm.workspace.index', () => {
      const validDto: WorkspaceIndexDTO = {
        version: 1,
        formatVersion: 1,
        workspaceId: testWorkspaceId,
        rootUri: testRootUri,
        indexGeneration: 1,
        workspaceGeneration: 1,
        entries: [
          {
            resourceId: 'file:///C:/projects/myapp/src/index.ts',
            workspaceId: testWorkspaceId,
            uri: 'file:///C:/projects/myapp/src/index.ts',
            relativePath: 'src/index.ts',
            name: 'index.ts',
            kind: 'file',
            parentPath: 'src',
            size: 2048,
            modifiedAt: 1710000000000,
            fingerprint: '2048:1710000000000',
            indexedAt: Date.now(),
          },
        ],
        totalFiles: 1,
        status: 'fresh',
        indexedAt: Date.now(),
      };

      const schema = globalSchemaRegistry.get('qm.workspace.index');
      expect(schema).toBeDefined();
      expect(schema?.validate(validDto)).toBe(true);

      // Rejects invalid payload
      expect(schema?.validate({ version: 1, entries: 'not-array' })).toBe(false);
      expect(schema?.validate(null)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Startup Restoration & Acceleration
  // ---------------------------------------------------------------------------

  describe('Startup Restoration & Acceleration', () => {
    it('hydrates in-memory index immediately from persistent storage when fresh', async () => {
      // Pre-populate persistent repository with valid workspace index
      const seedDto: WorkspaceIndexDTO = {
        version: 1,
        formatVersion: 1,
        workspaceId: testWorkspaceId,
        rootUri: testRootUri,
        indexGeneration: 5,
        workspaceGeneration: workspaceEngine.getGeneration(),
        entries: [
          {
            resourceId: 'file:///C:/projects/myapp/src/index.ts',
            workspaceId: testWorkspaceId,
            uri: 'file:///C:/projects/myapp/src/index.ts',
            relativePath: 'src/index.ts',
            name: 'index.ts',
            kind: 'file',
            parentPath: 'src',
            size: 1024,
            modifiedAt: 1700000000000,
            fingerprint: '1024:1700000000000',
            indexedAt: Date.now(),
          },
          {
            resourceId: 'file:///C:/projects/myapp/README.md',
            workspaceId: testWorkspaceId,
            uri: 'file:///C:/projects/myapp/README.md',
            relativePath: 'README.md',
            name: 'README.md',
            kind: 'file',
            parentPath: '',
            size: 512,
            modifiedAt: 1700000000000,
            fingerprint: '512:1700000000000',
            indexedAt: Date.now(),
          },
        ],
        totalFiles: 2,
        status: 'fresh',
        indexedAt: Date.now(),
      };

      await repository.saveIndex(testWorkspaceId, seedDto);

      // Initialize coordinator (simulating app open / workspace open)
      const initialized = await coordinator.initialize(testWorkspaceId, testRootUri);
      expect(initialized).toBe(true);
      expect(coordinator.getStatus()).toBe('ready');

      // Verify in-memory index is warm immediately for Quick Open & Search
      const resources = indexService.getResources();
      expect(resources).toHaveLength(2);
      expect(resources[0].name).toBe('index.ts');
      expect(resources[1].name).toBe('README.md');
      expect(resources[0].fingerprint).toBe('1024:1700000000000');
    });

    it('returns false and marks as uninitialized when no index exists', async () => {
      const initialized = await coordinator.initialize('ws-empty', 'file:///C:/empty');
      expect(initialized).toBe(false);
      expect(coordinator.getStatus()).toBe('uninitialized');
      expect(indexService.getResources()).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Incremental Updates & File Watcher Integration
  // ---------------------------------------------------------------------------

  describe('Incremental Updates & File Watch Integration', () => {
    it('incrementally adds newly created files and coalesces persistence writes', async () => {
      await coordinator.initialize(testWorkspaceId, testRootUri);

      coordinator.handleResourceCreated(
        'file:///C:/projects/myapp/src/newFile.ts',
        'src/newFile.ts',
        'newFile.ts',
        { size: 300, modifiedAt: 1710000001000 }
      );

      const resources = indexService.getResources();
      expect(resources).toHaveLength(1);
      expect(resources[0].name).toBe('newFile.ts');
      expect(resources[0].relativePath).toBe('src/newFile.ts');
      expect(resources[0].fingerprint).toBe('300:1710000001000');

      // Flush debounced write
      await coordinator.flush();

      // Check persistent record
      const persisted = await repository.getIndex(testWorkspaceId);
      expect(persisted).not.toBeNull();
      expect(persisted?.entries).toHaveLength(1);
      expect(persisted?.entries[0].name).toBe('newFile.ts');
    });

    it('incrementally removes deleted files from memory and persistent index', async () => {
      await coordinator.initialize(testWorkspaceId, testRootUri);

      coordinator.handleResourceCreated('file:///C:/projects/myapp/src/fileA.ts');
      coordinator.handleResourceCreated('file:///C:/projects/myapp/src/fileB.ts');
      expect(indexService.getResources()).toHaveLength(2);

      // Delete fileA
      coordinator.handleResourceDeleted('file:///C:/projects/myapp/src/fileA.ts');

      const remaining = indexService.getResources();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].uri).toBe('file:///C:/projects/myapp/src/fileB.ts');

      await coordinator.flush();
      const persisted = await repository.getIndex(testWorkspaceId);
      expect(persisted?.entries).toHaveLength(1);
      expect(persisted?.entries[0].uri).toBe('file:///C:/projects/myapp/src/fileB.ts');
    });

    it('updates resource path and name when a file is renamed', async () => {
      await coordinator.initialize(testWorkspaceId, testRootUri);

      coordinator.handleResourceCreated(
        'file:///C:/projects/myapp/src/oldName.ts',
        'src/oldName.ts',
        'oldName.ts'
      );

      coordinator.handleResourceRenamed(
        'file:///C:/projects/myapp/src/oldName.ts',
        'file:///C:/projects/myapp/src/renamed.ts'
      );

      const resources = indexService.getResources();
      expect(resources).toHaveLength(1);
      expect(resources[0].uri).toBe('file:///C:/projects/myapp/src/renamed.ts');
      expect(resources[0].name).toBe('renamed.ts');
      expect(resources[0].relativePath).toBe('src/renamed.ts');

      await coordinator.flush();
      const persisted = await repository.getIndex(testWorkspaceId);
      expect(persisted?.entries[0].uri).toBe('file:///C:/projects/myapp/src/renamed.ts');
    });

    it('refreshes metadata and fingerprint on resource modification', async () => {
      await coordinator.initialize(testWorkspaceId, testRootUri);

      coordinator.handleResourceCreated(
        'file:///C:/projects/myapp/src/index.ts',
        'src/index.ts',
        'index.ts',
        { size: 100, modifiedAt: 1000 }
      );
      expect(indexService.getResources()[0].fingerprint).toBe('100:1000');

      coordinator.handleResourceModified('file:///C:/projects/myapp/src/index.ts', {
        size: 500,
        modifiedAt: 2000,
      });

      expect(indexService.getResources()[0].fingerprint).toBe('500:2000');
    });

    it('processes external changes emitted from ResourceSynchronizationService', async () => {
      await coordinator.initialize(testWorkspaceId, testRootUri);

      // Simulate external rename event
      await syncService.synchronizeChange({
        uri: 'file:///C:/projects/myapp/src/newExternal.ts',
        oldUri: 'file:///C:/projects/myapp/src/oldExternal.ts',
        type: 'rename',
        classification: 'unopened_resource',
        timestamp: Date.now(),
        workspaceGeneration: 1,
      });

      // Emitting watcher event via syncService
      await syncService.emit('watcher.externalChangeDetected', {
        uri: 'file:///C:/projects/myapp/src/addedFromWatcher.ts',
        type: 'create',
      });

      const resources = indexService.getResources();
      expect(resources.some((r) => r.name === 'addedFromWatcher.ts')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Freshness Evaluation & Rebuild
  // ---------------------------------------------------------------------------

  describe('Freshness Evaluation & Rebuild', () => {
    it('marks index as stale if sampled files no longer exist on disk', async () => {
      const staleDto: WorkspaceIndexDTO = {
        version: 1,
        formatVersion: 1,
        workspaceId: testWorkspaceId,
        rootUri: testRootUri,
        indexGeneration: 1,
        workspaceGeneration: 1,
        entries: [
          {
            resourceId: 'file:///C:/projects/myapp/deleted-file-1.ts',
            workspaceId: testWorkspaceId,
            uri: 'file:///C:/projects/myapp/deleted-file-1.ts', // not in existingUris
            relativePath: 'deleted-file-1.ts',
            name: 'deleted-file-1.ts',
            kind: 'file',
            parentPath: '',
            indexedAt: Date.now(),
          },
        ],
        totalFiles: 1,
        status: 'fresh',
        indexedAt: Date.now(),
      };

      const result = await coordinator.evaluateFreshness(staleDto);
      expect(result.isValid).toBe(false);
      expect(result.freshness).toBe('stale');
    });

    it('performs clean rebuild and replaces persistent index', async () => {
      indexService.addOrUpdateResource({
        id: 'file:///C:/projects/myapp/src/app.ts',
        uri: 'file:///C:/projects/myapp/src/app.ts',
        name: 'app.ts',
        relativePath: 'src/app.ts',
        parentPath: 'src',
        isFolder: false,
      });

      const rebuilt = await coordinator.rebuildIndex(testWorkspaceId, testRootUri);
      expect(rebuilt).not.toBeNull();
      expect(rebuilt?.totalFiles).toBe(1);
      expect(coordinator.getStatus()).toBe('ready');

      const persisted = await repository.getIndex(testWorkspaceId);
      expect(persisted?.entries[0].name).toBe('app.ts');
    });

    it('clears persistent index and in-memory cache on clearIndex()', async () => {
      await coordinator.initialize(testWorkspaceId, testRootUri);
      coordinator.handleResourceCreated('file:///C:/projects/myapp/src/index.ts');
      await coordinator.flush();

      expect(indexService.getResources()).toHaveLength(1);
      expect(await repository.getIndex(testWorkspaceId)).not.toBeNull();

      await coordinator.clearIndex(testWorkspaceId);

      expect(indexService.getResources()).toEqual([]);
      expect(await repository.getIndex(testWorkspaceId)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Workspace Isolation & Generational Safety
  // ---------------------------------------------------------------------------

  describe('Workspace Isolation & Generational Safety', () => {
    it('maintains strict isolation between Workspace A and Workspace B indexes', async () => {
      const wsA = 'ws-project-alpha';
      const wsB = 'ws-project-beta';

      const dtoA: WorkspaceIndexDTO = {
        version: 1,
        formatVersion: 1,
        workspaceId: wsA,
        rootUri: 'file:///C:/alpha',
        indexGeneration: 1,
        workspaceGeneration: 1,
        entries: [
          {
            resourceId: 'file:///C:/alpha/main.ts',
            workspaceId: wsA,
            uri: 'file:///C:/alpha/main.ts',
            relativePath: 'main.ts',
            name: 'main.ts',
            kind: 'file',
            parentPath: '',
            indexedAt: Date.now(),
          },
        ],
        totalFiles: 1,
        status: 'fresh',
        indexedAt: Date.now(),
      };

      const dtoB: WorkspaceIndexDTO = {
        version: 1,
        formatVersion: 1,
        workspaceId: wsB,
        rootUri: 'file:///C:/beta',
        indexGeneration: 1,
        workspaceGeneration: 1,
        entries: [
          {
            resourceId: 'file:///C:/beta/server.go',
            workspaceId: wsB,
            uri: 'file:///C:/beta/server.go',
            relativePath: 'server.go',
            name: 'server.go',
            kind: 'file',
            parentPath: '',
            indexedAt: Date.now(),
          },
        ],
        totalFiles: 1,
        status: 'fresh',
        indexedAt: Date.now(),
      };

      await repository.saveIndex(wsA, dtoA);
      await repository.saveIndex(wsB, dtoB);

      const indexA = await repository.getIndex(wsA);
      const indexB = await repository.getIndex(wsB);

      expect(indexA?.entries[0].name).toBe('main.ts');
      expect(indexB?.entries[0].name).toBe('server.go');
      expect(indexA?.workspaceId).toBe(wsA);
      expect(indexB?.workspaceId).toBe(wsB);
    });

    it('discards late asynchronous rebuild if workspace switches mid-flight', async () => {
      const slowRepo: any = {
        getIndex: async () => null,
        saveIndex: async () => new Promise((resolve) => setTimeout(resolve, 30)),
      };

      const customCoordinator = new WorkspaceIndexCoordinator(
        workspaceEngine,
        indexService,
        slowRepo,
        fileServiceMock
      );

      // Start rebuild for wsA
      const rebuildPromise = customCoordinator.rebuildIndex('ws-A', 'file:///C:/A');

      // Simulate workspace switch before rebuild completes
      await workspaceEngine.open('file:///C:/B');

      const result = await rebuildPromise;
      expect(result).toBeNull(); // Discarded due to generation mismatch
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Storage Failure & Read-Only Resilience
  // ---------------------------------------------------------------------------

  describe('Storage Failure & Resilience', () => {
    it('maintains in-memory indexing functionality even if storage throws write errors', async () => {
      const failingRepo: any = {
        getIndex: async () => null,
        saveIndex: async () => {
          throw new Error('Disk full or storage read-only');
        },
      };

      const resilientCoordinator = new WorkspaceIndexCoordinator(
        workspaceEngine,
        indexService,
        failingRepo,
        fileServiceMock
      );

      await resilientCoordinator.initialize(testWorkspaceId, testRootUri);

      // In-memory indexing must continue without crashing
      resilientCoordinator.handleResourceCreated('file:///C:/projects/myapp/src/resilient.ts');
      expect(indexService.getResources()).toHaveLength(1);
      expect(indexService.getResources()[0].name).toBe('resilient.ts');

      // Persist failure is caught and logged safely
      await expect(resilientCoordinator.persist()).resolves.not.toThrow();
    });

    it('recovers from corrupt storage records without crashing on initialize', async () => {
      const corruptRepo: any = {
        getIndex: async () => ({
          version: 999, // Unrecognized schema version
          entries: 'corrupt',
        }),
      };

      const safeCoordinator = new WorkspaceIndexCoordinator(
        workspaceEngine,
        indexService,
        corruptRepo,
        fileServiceMock
      );

      const initialized = await safeCoordinator.initialize(testWorkspaceId, testRootUri);
      expect(initialized).toBe(false);
      expect(indexService.getResources()).toEqual([]);
      expect(safeCoordinator.getStatus()).toBe('stale');
    });
  });
});
