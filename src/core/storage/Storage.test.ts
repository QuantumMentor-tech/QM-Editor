/**
 * QM Editor Storage & Persistence Subsystem Test Suite
 * Phase 05, Step 46 — Data & Storage Architecture Foundation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  StorageService,
  MemoryStorageAdapter,
  LocalStorageAdapter,
  StorageSerializer,
  globalSchemaRegistry,
  globalMigrationRegistry,
  SettingsRepository,
  WorkspaceStateRepository,
  SessionStateRepository,
  StorageNotReadyError,
  StorageDisposedError,
  StorageReadOnlyError,
  StorageCorruptDataError,
  StorageVersionConflictError,
  StorageValidationError,
  StorageMigrationError,
  StorageSerializationError,
  StorageSensitiveDataError,
} from './index';

describe('Storage & Persistence Subsystem (Step 46)', () => {
  let memoryAdapter: MemoryStorageAdapter;
  let storage: StorageService;

  beforeEach(async () => {
    memoryAdapter = new MemoryStorageAdapter();
    storage = new StorageService({ adapter: memoryAdapter });
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.dispose();
    globalSchemaRegistry.reset();
    globalMigrationRegistry.reset();
  });

  // ---------------------------------------------------------------------------
  // 1. Serialization & Runtime Boundary Tests
  // ---------------------------------------------------------------------------
  describe('StorageSerializer', () => {
    it('serializes and deserializes plain objects correctly', () => {
      const data = { name: 'QM Editor', active: true, count: 42, tags: ['code', 'editor'] };
      const serialized = StorageSerializer.serialize(data);
      expect(typeof serialized).toBe('string');

      const parsed = StorageSerializer.deserialize<typeof data>(serialized);
      expect(parsed).toEqual(data);
    });

    it('rejects live runtime functions from serialization', () => {
      const badData = {
        name: 'test',
        handler: () => {
          /* live function */
        },
      };

      expect(() => StorageSerializer.serialize(badData)).toThrow(StorageSerializationError);
    });

    it('rejects symbol values from serialization', () => {
      const badData = { id: 'test', sym: Symbol('bad') };
      expect(() => StorageSerializer.serialize(badData)).toThrow(StorageSerializationError);
    });

    it('rejects circular structures from serialization', () => {
      const circular: any = { name: 'circle' };
      circular.self = circular;

      expect(() => StorageSerializer.serialize(circular)).toThrow(StorageSerializationError);
    });

    it('detects and rejects plaintext sensitive credentials', () => {
      const secretPayload = {
        username: 'developer',
        api_secret: 'super_secret_token_12345',
      };

      expect(() => StorageSerializer.serialize(secretPayload, true)).toThrow(
        StorageSensitiveDataError
      );
    });

    it('computes deterministic checksums', () => {
      const hash1 = StorageSerializer.computeChecksum('content_a');
      const hash2 = StorageSerializer.computeChecksum('content_a');
      const hash3 = StorageSerializer.computeChecksum('content_b');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Schema Governance & Validation Tests
  // ---------------------------------------------------------------------------
  describe('Schema Registry & Validation', () => {
    it('validates standard built-in schemas', () => {
      expect(globalSchemaRegistry.has('qm.settings.user')).toBe(true);
      expect(globalSchemaRegistry.has('qm.settings.workspace')).toBe(true);
      expect(globalSchemaRegistry.has('qm.workspace.metadata')).toBe(true);
      expect(globalSchemaRegistry.has('qm.session.workspace')).toBe(true);
      expect(globalSchemaRegistry.has('qm.navigation.recent')).toBe(true);
    });

    it('rejects writes with unregistered schemas', async () => {
      await expect(
        storage.write('unreg_key', 'qm.unregistered.schema', { foo: 'bar' }, 'application')
      ).rejects.toThrow(StorageValidationError);
    });

    it('rejects payload that fails schema validation', async () => {
      // Workspace metadata requires id, name, roots array, createdAt number
      const invalidWsMetadata = {
        id: 'ws-1',
        name: 12345, // invalid type: should be string
      };

      await expect(
        storage.write('ws_bad', 'qm.workspace.metadata', invalidWsMetadata, 'workspace', 'ws-1')
      ).rejects.toThrow(StorageValidationError);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Schema Migrations Pipeline Tests
  // ---------------------------------------------------------------------------
  describe('Schema Migrations', () => {
    it('executes ordered migration from v1 to v2 on read', async () => {
      // 1. Register a v2 schema
      globalSchemaRegistry.register({
        schemaId: 'qm.test.config',
        currentVersion: 2,
        description: 'Test schema v2',
        validate: (d: any): d is any => typeof d?.fontSize === 'number',
      });

      // 2. Register migration from v1 -> v2 (e.g. size -> fontSize)
      globalMigrationRegistry.registerMigration({
        schemaId: 'qm.test.config',
        fromVersion: 1,
        toVersion: 2,
        description: 'Rename size to fontSize',
        migrate: (from: any) => ({ fontSize: from.size ?? 14 }),
      });

      // 3. Manually store a v1 record directly into adapter
      await memoryAdapter.set({
        key: 'app:test_cfg',
        schemaId: 'qm.test.config',
        schemaVersion: 1,
        recordVersion: 1,
        scope: 'application',
        payload: { size: 16 },
        createdAt: 1000,
        updatedAt: 1000,
      });

      // 4. Read record through StorageService - should auto-migrate to v2
      const readRecord = await storage.read<any>('app:test_cfg', 'qm.test.config');
      expect(readRecord).not.toBeNull();
      expect(readRecord!.schemaVersion).toBe(2);
      expect(readRecord!.payload).toEqual({ fontSize: 16 });

      // 5. Verify the migrated record was persisted back to adapter
      const storedInAdapter = await memoryAdapter.get<any>('app:test_cfg');
      expect(storedInAdapter!.schemaVersion).toBe(2);
      expect(storedInAdapter!.payload).toEqual({ fontSize: 16 });
    });

    it('rejects schema downgrade', async () => {
      await memoryAdapter.set({
        key: 'app:future_cfg',
        schemaId: 'qm.settings.user',
        schemaVersion: 5, // higher than v1
        recordVersion: 1,
        scope: 'application',
        payload: { theme: 'dark' },
        createdAt: 1000,
        updatedAt: 1000,
      });

      await expect(
        storage.read('app:future_cfg', 'qm.settings.user', { expectedSchemaVersion: 1 })
      ).rejects.toThrow(StorageMigrationError);
    });

    it('safely aborts and reports error on failed migration step', async () => {
      globalSchemaRegistry.register({
        schemaId: 'qm.test.fail',
        currentVersion: 2,
        description: 'Failing schema',
        validate: (_d: unknown): _d is any => true,
      });

      globalMigrationRegistry.registerMigration({
        schemaId: 'qm.test.fail',
        fromVersion: 1,
        toVersion: 2,
        description: 'Buggy migration',
        migrate: () => {
          throw new Error('Exploding migration step');
        },
      });

      await memoryAdapter.set({
        key: 'app:fail_rec',
        schemaId: 'qm.test.fail',
        schemaVersion: 1,
        recordVersion: 1,
        scope: 'application',
        payload: { ok: true },
        createdAt: 1000,
        updatedAt: 1000,
      });

      await expect(storage.read('app:fail_rec', 'qm.test.fail')).rejects.toThrow(
        StorageMigrationError
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Concurrency & Optimistic Record Versioning Tests
  // ---------------------------------------------------------------------------
  describe('Concurrency & Versioning', () => {
    it('increments recordVersion monotonically on subsequent writes', async () => {
      const rec1 = await storage.write(
        'counter',
        'qm.settings.user',
        { count: 1 },
        'application'
      );
      expect(rec1.recordVersion).toBe(1);

      const rec2 = await storage.write(
        'counter',
        'qm.settings.user',
        { count: 2 },
        'application'
      );
      expect(rec2.recordVersion).toBe(2);
    });

    it('rejects stale write when expectedRecordVersion conflicts', async () => {
      // Current version is 1
      await storage.write('concurrency_test', 'qm.settings.user', { val: 'A' }, 'application');

      // Update with matching expectedRecordVersion (1) -> succeeds, becomes version 2
      await storage.write(
        'concurrency_test',
        'qm.settings.user',
        { val: 'B' },
        'application',
        undefined,
        { expectedRecordVersion: 1 }
      );

      // Attempt another write expecting stale version 1 -> rejected!
      await expect(
        storage.write(
          'concurrency_test',
          'qm.settings.user',
          { val: 'C_stale' },
          'application',
          undefined,
          { expectedRecordVersion: 1 }
        )
      ).rejects.toThrow(StorageVersionConflictError);
    });

    it('serializes simultaneous concurrent writes safely', async () => {
      const promises = [
        storage.write('queue_key', 'qm.settings.user', { order: 1 }, 'application'),
        storage.write('queue_key', 'qm.settings.user', { order: 2 }, 'application'),
        storage.write('queue_key', 'qm.settings.user', { order: 3 }, 'application'),
      ];

      const results = await Promise.all(promises);
      expect(results.length).toBe(3);

      const finalRecord = await storage.read<any>('app:queue_key', 'qm.settings.user');
      expect(finalRecord!.recordVersion).toBe(3);
      expect(finalRecord!.payload.order).toBe(3);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Workspace Storage Isolation Tests
  // ---------------------------------------------------------------------------
  describe('Workspace Storage Isolation', () => {
    it('isolates Workspace A from Workspace B', async () => {
      await storage.write('local_config', 'qm.settings.workspace', { tabSize: 2 }, 'workspace', 'ws-alpha');
      await storage.write('local_config', 'qm.settings.workspace', { tabSize: 4 }, 'workspace', 'ws-beta');

      const recAlpha = await storage.read<any>('ws:ws-alpha:local_config', 'qm.settings.workspace');
      const recBeta = await storage.read<any>('ws:ws-beta:local_config', 'qm.settings.workspace');

      expect(recAlpha!.payload.tabSize).toBe(2);
      expect(recBeta!.payload.tabSize).toBe(4);
    });

    it('clears Workspace A without affecting Workspace B or Application settings', async () => {
      await storage.write('user_pref', 'qm.settings.user', { theme: 'dark' }, 'application');
      await storage.write('ws_pref', 'qm.settings.workspace', { tabSize: 2 }, 'workspace', 'ws-alpha');
      await storage.write('ws_pref', 'qm.settings.workspace', { tabSize: 4 }, 'workspace', 'ws-beta');

      await storage.clearWorkspace('ws-alpha');

      expect(await storage.read('ws:ws-alpha:ws_pref', 'qm.settings.workspace')).toBeNull();
      expect(await storage.read('ws:ws-beta:ws_pref', 'qm.settings.workspace')).not.toBeNull();
      expect(await storage.read('app:user_pref', 'qm.settings.user')).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Corruption Detection & Health Reporting Tests
  // ---------------------------------------------------------------------------
  describe('Corruption Detection & Health', () => {
    it('detects checksum corruption and marks health as recoveryRequired', async () => {
      // 1. Write valid record
      await storage.write('tamper_test', 'qm.settings.user', { valid: true }, 'application');

      // 2. Tamper with payload directly in adapter while keeping old checksum
      const raw = await memoryAdapter.get<any>('app:tamper_test');
      await memoryAdapter.set({
        ...raw!,
        payload: { valid: false, tampered: true },
      });

      // 3. Read should detect mismatch and throw StorageCorruptDataError
      await expect(storage.read('app:tamper_test', 'qm.settings.user')).rejects.toThrow(
        StorageCorruptDataError
      );

      // 4. Verify health report
      const health = storage.getHealth();
      expect(health.state).toBe('recoveryRequired');
      expect(health.corruptedRecordCount).toBeGreaterThan(0);
      expect(health.issues.length).toBeGreaterThan(0);
    });

    it('LocalStorageAdapter automatically quarantines corrupted unparseable JSON', async () => {
      const mockStorage = new Map<string, string>();
      const originalLocalStorage = (globalThis as any).localStorage;

      (globalThis as any).localStorage = {
        getItem: (k: string) => mockStorage.get(k) ?? null,
        setItem: (k: string, v: string) => mockStorage.set(k, v),
        removeItem: (k: string) => mockStorage.delete(k),
        get length() {
          return mockStorage.size;
        },
        key: (idx: number) => Array.from(mockStorage.keys())[idx] ?? null,
        clear: () => mockStorage.clear(),
      };

      try {
        const localAdapter = new LocalStorageAdapter('qm_test_');
        await localAdapter.initialize();

        // Simulate corrupted data in localStorage
        (globalThis as any).localStorage.setItem('qm_test_corrupt_rec', '{ bad json, broken: 123');

        // Adapter get should return null, quarantine the corrupted data, and delete original
        const result = await localAdapter.get('corrupt_rec');
        expect(result).toBeNull();
        expect((globalThis as any).localStorage.getItem('qm_test_corrupt_rec')).toBeNull();

        // Check quarantine key exists
        let quarantineFound = false;
        for (let i = 0; i < (globalThis as any).localStorage.length; i++) {
          if ((globalThis as any).localStorage.key(i)?.startsWith('qm_corrupted_corrupt_rec_')) {
            quarantineFound = true;
            break;
          }
        }
        expect(quarantineFound).toBe(true);

        await localAdapter.dispose();
      } finally {
        (globalThis as any).localStorage = originalLocalStorage;
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Read-Only Mode & Lifecycle Disposal Tests
  // ---------------------------------------------------------------------------
  describe('Read-Only & Lifecycle', () => {
    it('rejects writes and clears when adapter is in read-only mode', async () => {
      memoryAdapter.setReadOnly(true);

      await expect(
        storage.write('ro_test', 'qm.settings.user', { test: true }, 'application')
      ).rejects.toThrow(StorageReadOnlyError);

      await expect(storage.delete('ro_test')).rejects.toThrow(StorageReadOnlyError);
      await expect(storage.clearWorkspace('ws-1')).rejects.toThrow(StorageReadOnlyError);
    });

    it('rejects operations after disposal', async () => {
      await storage.dispose();

      expect(storage.getHealth().state).toBe('disposed');

      await expect(
        storage.write('post_dispose', 'qm.settings.user', {}, 'application')
      ).rejects.toThrow(StorageDisposedError);

      await expect(storage.read('app:post_dispose', 'qm.settings.user')).rejects.toThrow(
        StorageDisposedError
      );
    });

    it('rejects operations before initialization', () => {
      const uninitStorage = new StorageService({ adapter: new MemoryStorageAdapter() });
      expect(() => (uninitStorage as any).ensureReady()).toThrow(StorageNotReadyError);
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Repository Contracts Tests
  // ---------------------------------------------------------------------------
  describe('Repositories', () => {
    it('SettingsRepository gets and saves user and workspace settings', async () => {
      const repo = new SettingsRepository(storage);

      await repo.saveUserSettings({ 'editor.fontSize': 16, 'editor.wordWrap': true });
      const userSettings = await repo.getUserSettings();
      expect(userSettings['editor.fontSize']).toBe(16);
      expect(userSettings['editor.wordWrap']).toBe(true);

      await repo.saveWorkspaceSettings('ws-repo-test', { 'editor.tabSize': 2 });
      const wsSettings = await repo.getWorkspaceSettings('ws-repo-test');
      expect(wsSettings['editor.tabSize']).toBe(2);
    });

    it('WorkspaceStateRepository saves and retrieves metadata and recent workspaces', async () => {
      const repo = new WorkspaceStateRepository(storage);

      const metadata = {
        id: 'ws-meta-1',
        name: 'Project Alpha',
        roots: [{ rootId: 'r1', uri: 'file:///projects/alpha', name: 'alpha' }],
        createdAt: 100000,
        lastActiveAt: 100500,
      };

      await repo.saveWorkspaceMetadata('ws-meta-1', metadata);
      const retrieved = await repo.getWorkspaceMetadata('ws-meta-1');
      expect(retrieved).toEqual(metadata);

      const recent = [
        { path: 'C:/projects/alpha', name: 'Alpha', lastOpened: 1000 },
        { path: 'C:/projects/beta', name: 'Beta', lastOpened: 900 },
      ];

      await repo.saveRecentWorkspaces(recent);
      const recentRetrieved = await repo.getRecentWorkspaces();
      expect(recentRetrieved).toEqual(recent);
    });

    it('SessionStateRepository persists and clears workspace session continuity', async () => {
      const repo = new SessionStateRepository(storage);

      const session = {
        version: 1,
        openFilePaths: ['src/index.ts', 'src/App.tsx'],
        activeFilePath: 'src/index.ts',
        lastLocations: { 'src/index.ts': { line: 10, column: 5 } },
        timestamp: Date.now(),
      };

      await repo.saveWorkspaceSession('ws-sess-1', session);
      const loaded = await repo.getWorkspaceSession('ws-sess-1');
      expect(loaded).toEqual(session);

      await repo.clearWorkspaceSession('ws-sess-1');
      const cleared = await repo.getWorkspaceSession('ws-sess-1');
      expect(cleared).toBeNull();
    });
  });
});
