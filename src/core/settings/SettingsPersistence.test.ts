/**
 * QM Editor Persistent Settings, Preferences & Configuration Storage Tests
 * Phase 05, Step 49 — Persistent Settings, Preferences & Configuration Storage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SettingsService } from './SettingsService';
import { settingsRegistry } from './SettingsRegistry';
import {
  StorageService,
  MemoryStorageAdapter,
  SettingsRepository,
  globalSchemaRegistry,
  globalMigrationRegistry,
  StorageVersionConflictError,
} from '../storage';

describe('Settings Persistence & Durable Storage Layer (Step 49)', () => {
  let adapter: MemoryStorageAdapter;
  let storage: StorageService;
  let repository: SettingsRepository;
  let service: SettingsService;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    storage = new StorageService({ adapter });
    await storage.initialize();
    repository = new SettingsRepository(storage);

    service = SettingsService.getInstance();
    service.resetForTesting();
    await service.initialize(repository);
  });

  afterEach(async () => {
    await service.flush();
    service.resetForTesting();
    await storage.dispose();
    globalSchemaRegistry.reset();
    globalMigrationRegistry.reset();
  });

  // ---------------------------------------------------------------------------
  // 1. Settings Repository Tests
  // ---------------------------------------------------------------------------

  describe('SettingsRepository Direct Operations', () => {
    it('saves and reads user settings record with versioning', async () => {
      await repository.saveUserSettings({ 'editor.fontSize': 16 });

      const record = await repository.getUserSettingsRecord();
      expect(record).not.toBeNull();
      expect(record?.recordVersion).toBe(1);
      expect(record?.settings['editor.fontSize']).toBe(16);

      const payload = await repository.getUserSettings();
      expect(payload['editor.fontSize']).toBe(16);
    });

    it('enforces optimistic concurrency protection with expectedRecordVersion', async () => {
      await repository.saveUserSettings({ 'editor.fontSize': 16 });
      const record = await repository.getUserSettingsRecord();
      expect(record?.recordVersion).toBe(1);

      // Stale update with wrong expected version should throw StorageVersionConflictError
      await expect(
        repository.saveUserSettings({ 'editor.fontSize': 18 }, 999)
      ).rejects.toThrow(StorageVersionConflictError);

      // Successful update with matching version
      await repository.saveUserSettings({ 'editor.fontSize': 18 }, 1);
      const updated = await repository.getUserSettingsRecord();
      expect(updated?.recordVersion).toBe(2);
      expect(updated?.settings['editor.fontSize']).toBe(18);
    });

    it('clears user settings record cleanly', async () => {
      await repository.saveUserSettings({ 'editor.fontSize': 16 });
      expect(await repository.getUserSettingsRecord()).not.toBeNull();

      await repository.clearUserSettings();
      expect(await repository.getUserSettingsRecord()).toBeNull();
      expect(await repository.getUserSettings()).toEqual({});
    });

    it('saves, reads, and clears workspace-scoped settings isolated by workspace ID', async () => {
      await repository.saveWorkspaceSettings('ws-1', { 'editor.tabSize': 4 });
      await repository.saveWorkspaceSettings('ws-2', { 'editor.tabSize': 8 });

      const ws1 = await repository.getWorkspaceSettings('ws-1');
      const ws2 = await repository.getWorkspaceSettings('ws-2');

      expect(ws1['editor.tabSize']).toBe(4);
      expect(ws2['editor.tabSize']).toBe(8);

      await repository.clearWorkspaceSettings('ws-1');
      expect(await repository.getWorkspaceSettings('ws-1')).toEqual({});
      // ws-2 remains unaffected
      expect(await repository.getWorkspaceSettings('ws-2')).toEqual({ 'editor.tabSize': 8 });
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Settings Service & Durable Precedence
  // ---------------------------------------------------------------------------

  describe('SettingsService Scope Precedence & Persistence', () => {
    it('resolves deterministic default values when unconfigured without writing to storage', async () => {
      expect(service.get('editor.fontSize')).toBe(14);
      expect(service.get('appearance.theme')).toBe('dark');
      expect(service.hasOverride('editor.fontSize', 'user')).toBe(false);
      expect(service.hasOverride('editor.fontSize', 'workspace')).toBe(false);

      // Crucial requirement: storage must have no record when using defaults
      const record = await repository.getUserSettingsRecord();
      expect(record).toBeNull();
    });

    it('persists user overrides durably via setAsync', async () => {
      const res = await service.setAsync('editor.fontSize', 18, 'user');
      expect(res.success).toBe(true);
      expect(service.get('editor.fontSize')).toBe(18);
      expect(service.getUserValue('editor.fontSize')).toBe(18);

      const stored = await repository.getUserSettings();
      expect(stored['editor.fontSize']).toBe(18);
    });

    it('enforces precedence: Workspace Override -> User Override -> Registry Default', async () => {
      // 1. Default is 2
      expect(service.get('editor.tabSize')).toBe(2);

      // 2. Set user override to 4
      await service.setAsync('editor.tabSize', 4, 'user');
      expect(service.get('editor.tabSize')).toBe(4);

      // 3. Set workspace override to 8
      await service.setAsync('editor.tabSize', 8, 'workspace');
      expect(service.get('editor.tabSize')).toBe(8);

      // 4. Reset workspace override -> reverts to user override (4)
      await service.resetAsync('editor.tabSize', 'workspace');
      expect(service.get('editor.tabSize')).toBe(4);
      const wsStored = await repository.getWorkspaceSettings('default');
      expect(wsStored['editor.tabSize']).toBeUndefined();

      // 5. Reset user override -> reverts to default (2)
      await service.resetAsync('editor.tabSize', 'user');
      expect(service.get('editor.tabSize')).toBe(2);
      const userStored = await repository.getUserSettings();
      expect(userStored['editor.tabSize']).toBeUndefined();
    });

    it('resetAllAsync clears all overrides in scope and restores lower-precedence values', async () => {
      await service.setAsync('editor.fontSize', 20, 'user');
      await service.setAsync('appearance.theme', 'light', 'user');

      expect(service.get('editor.fontSize')).toBe(20);
      expect(service.get('appearance.theme')).toBe('light');

      await service.resetAllAsync('user');

      expect(service.get('editor.fontSize')).toBe(14);
      expect(service.get('appearance.theme')).toBe('dark');

      const userStored = await repository.getUserSettings();
      expect(Object.keys(userStored)).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Validation on Write & Validation on Load
  // ---------------------------------------------------------------------------

  describe('Validation on Write & Validation on Load', () => {
    it('rejects invalid runtime values before persistence', async () => {
      const initial = service.get('editor.fontSize');
      expect(initial).toBe(14);

      // Value exceeds max of 32
      const res = await service.setAsync('editor.fontSize', 99, 'user');
      expect(res.success).toBe(false);
      expect(res.error).toContain('between 8 and 32');

      // Value in memory and repository remains unchanged
      expect(service.get('editor.fontSize')).toBe(14);
      const stored = await repository.getUserSettings();
      expect(stored['editor.fontSize']).toBeUndefined();
    });

    it('rejects invalid enum options on write', async () => {
      const res = await service.setAsync('appearance.theme', 'neon-cyberpunk', 'user');
      expect(res.success).toBe(false);
      expect(res.error).toContain('must be "dark" or "light"');
      expect(service.get('appearance.theme')).toBe('dark');
    });

    it('discards invalid stored values on load and safely falls back to defaults', async () => {
      // Directly write corrupt/invalid setting into repository
      await repository.saveUserSettings({
        'editor.fontSize': 999, // Invalid: exceeds max 32
        'appearance.theme': 'invalid-theme', // Invalid enum
        'editor.tabSize': 4, // Valid
      });

      // Restart / Re-initialize SettingsService
      service.resetForTesting();
      await service.initialize(repository);

      // Invalid values safely discarded, falling back to registry defaults
      expect(service.get('editor.fontSize')).toBe(14);
      expect(service.get('appearance.theme')).toBe('dark');
      // Valid value preserved
      expect(service.get('editor.tabSize')).toBe(4);
    });

    it('preserves unknown stored settings without crashing or polluting registry lookups', async () => {
      await repository.saveUserSettings({
        'custom.plugin.foo': 'bar',
        'editor.fontSize': 16,
      });

      service.resetForTesting();
      await service.initialize(repository);

      expect(service.get('editor.fontSize')).toBe(16);
      // Unregistered key safely returns undefined from get()
      expect(service.get('custom.plugin.foo')).toBeUndefined();

      // But the unknown setting is preserved in userSettings for export and future migrations
      const exported = service.exportSettings();
      expect(exported.userSettings['custom.plugin.foo']).toBe('bar');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Secret & Sensitive Settings Boundary
  // ---------------------------------------------------------------------------

  describe('Sensitive & Secret Settings Protection', () => {
    it('identifies sensitive settings and refuses plaintext persistence', async () => {
      // Register a sensitive setting
      settingsRegistry.register({
        key: 'ai.apiKey',
        title: 'OpenAI API Key',
        description: 'Secret API key for AI assistant',
        category: 'General',
        type: 'string',
        defaultValue: '',
        scope: 'user',
        sensitive: true,
      });

      expect(settingsRegistry.isSensitive('ai.apiKey')).toBe(true);

      const res = await service.setAsync('ai.apiKey', 'sk-super-secret-12345', 'user');
      expect(res.success).toBe(false);
      expect(res.error).toContain('classified as sensitive and cannot be persisted');

      // Verify nothing reached storage
      const stored = await repository.getUserSettings();
      expect(stored['ai.apiKey']).toBeUndefined();
    });

    it('redacts sensitive keys from exportSettings', async () => {
      // Inject sensitive key into in-memory state manually
      (service as any).userSettings['ai.apiKey'] = 'sk-secret';
      (service as any).userSettings['editor.fontSize'] = 16;

      const exported = service.exportSettings();
      expect(exported.userSettings['editor.fontSize']).toBe(16);
      expect(exported.userSettings['ai.apiKey']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Failure Handling, Rollback & Read-Only Storage
  // ---------------------------------------------------------------------------

  describe('Storage Failure & Rollback Semantics', () => {
    it('rolls back in-memory state and returns error when storage is read-only', async () => {
      expect(service.get('editor.fontSize')).toBe(14);

      // Lock storage as read-only
      adapter.setReadOnly(true);

      const res = await service.setAsync('editor.fontSize', 18, 'user');
      expect(res.success).toBe(false);
      expect(res.error).toContain('READ_ONLY');

      // State is rolled back to 14
      expect(service.get('editor.fontSize')).toBe(14);
      expect(service.getUserValue('editor.fontSize')).toBeUndefined();
    });

    it('preserves defaults when storage is completely unavailable on initialize', async () => {
      const mockFailingRepo: any = {
        getUserSettingsRecord: async () => {
          throw new Error('Disk unreadable');
        },
        getWorkspaceSettingsRecord: async () => {
          throw new Error('Disk unreadable');
        },
      };

      service.resetForTesting();
      // Should not throw or crash
      await expect(service.initialize(mockFailingRepo)).resolves.not.toThrow();

      // Defaults remain intact
      expect(service.get('editor.fontSize')).toBe(14);
      expect(service.get('appearance.theme')).toBe('dark');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Rapid Consecutive Changes, Debouncing & Flush
  // ---------------------------------------------------------------------------

  describe('Rapid Consecutive Changes & Flush Coalescing', () => {
    it('coalesces rapid setting changes and flushes final value to storage', async () => {
      service.set('editor.fontSize', 16, 'user');
      service.set('editor.fontSize', 18, 'user');
      service.set('editor.fontSize', 20, 'user');

      // Immediate in-memory value is updated for UI responsiveness
      expect(service.get('editor.fontSize')).toBe(20);

      // Flush forces pending coalesced writes to commit to repository
      await service.flush();

      const stored = await repository.getUserSettings();
      expect(stored['editor.fontSize']).toBe(20);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Workspace Switch & Generation Protection
  // ---------------------------------------------------------------------------

  describe('Workspace Context Isolation & Generation Protection', () => {
    it('maintains strict isolation between Workspace A and Workspace B', async () => {
      // Configure Workspace Alpha
      await service.setWorkspaceId('ws-alpha');
      await service.setAsync('editor.tabSize', 4, 'workspace');
      expect(service.get('editor.tabSize')).toBe(4);

      // Configure Workspace Beta
      await service.setWorkspaceId('ws-beta');
      await service.setAsync('editor.tabSize', 8, 'workspace');
      expect(service.get('editor.tabSize')).toBe(8);

      // Switch back to Workspace Alpha
      await service.setWorkspaceId('ws-alpha');
      expect(service.get('editor.tabSize')).toBe(4);

      // Switch back to Workspace Beta
      await service.setWorkspaceId('ws-beta');
      expect(service.get('editor.tabSize')).toBe(8);
    });

    it('emits change events when effective values change across workspace switch', async () => {
      await service.setWorkspaceId('ws-alpha');
      await service.setAsync('editor.tabSize', 4, 'workspace');

      await service.setWorkspaceId('ws-beta');
      await service.setAsync('editor.tabSize', 8, 'workspace');

      const events: any[] = [];
      const unsub = service.subscribe('editor.tabSize', (e) => events.push(e));

      // Switch from Beta (8) to Alpha (4)
      await service.setWorkspaceId('ws-alpha');

      expect(events).toHaveLength(1);
      expect(events[0].previousValue).toBe(8);
      expect(events[0].currentValue).toBe(4);

      unsub();
    });

    it('protects against stale asynchronous loads during rapid workspace switches', async () => {
      // Mock slow repository load for workspace A
      let resolveSlowLoad: (value: any) => void;
      const slowPromise = new Promise((resolve) => {
        resolveSlowLoad = resolve;
      });

      const originalGetWorkspaceRecord = repository.getWorkspaceSettingsRecord.bind(repository);
      repository.getWorkspaceSettingsRecord = async (wsId: string) => {
        if (wsId === 'slow-ws') {
          await slowPromise;
          return { settings: { 'editor.tabSize': 8 }, recordVersion: 1 };
        }
        return originalGetWorkspaceRecord(wsId);
      };

      // 1. Start switch to slow workspace
      const switch1 = service.setWorkspaceId('slow-ws');

      // 2. Rapidly switch to fast workspace before slow switch finishes
      await service.setWorkspaceId('fast-ws');
      await service.setAsync('editor.tabSize', 2, 'workspace');
      expect(service.get('editor.tabSize')).toBe(2);

      // 3. Now resolve the slow workspace load
      resolveSlowLoad!({ settings: { 'editor.tabSize': 8 }, recordVersion: 1 });
      await switch1;

      // 4. Active workspace fast-ws MUST NOT be contaminated by slow-ws!
      expect(service.get('editor.tabSize')).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Settings Migration via MigrationRegistry
  // ---------------------------------------------------------------------------

  describe('Settings Schema Versioning & Migrations', () => {
    it('migrates older user settings records across versions', async () => {
      // Register a migration from v1 to v2 that renames a legacy key
      globalMigrationRegistry.registerMigration({
        schemaId: 'qm.settings.user',
        fromVersion: 1,
        toVersion: 2,
        description: 'Rename legacy editor.renderWhitespace to editor.whitespace',
        migrate: (from: any) => {
          const to = { ...from };
          if (to['editor.renderWhitespace'] !== undefined) {
            to['editor.whitespace'] = to['editor.renderWhitespace'];
            delete to['editor.renderWhitespace'];
          }
          return to;
        },
      });

      // Write a v1 record directly to storage
      await storage.write(
        'user_settings',
        'qm.settings.user',
        { 'editor.renderWhitespace': 'all', 'editor.fontSize': 16 },
        'application'
      );

      // Migrate record to v2
      const storedRecord = await storage.read<any>('app:user_settings', 'qm.settings.user');
      expect(storedRecord?.schemaVersion).toBe(1);

      const migrated = await globalMigrationRegistry.migrateRecord<any>(storedRecord!, 2);
      expect(migrated.schemaVersion).toBe(2);
      expect(migrated.payload['editor.whitespace']).toBe('all');
      expect(migrated.payload['editor.renderWhitespace']).toBeUndefined();
      expect(migrated.payload['editor.fontSize']).toBe(16);
    });
  });
});
