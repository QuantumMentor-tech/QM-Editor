/**
 * QM Editor Application Backup, Export, Import & Safe Portability Tests
 * Phase 05, Step 54 — Backup, Export, Import & Safe Data Portability
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BackupCoordinator } from './BackupCoordinator';
import { PackageValidator } from './PackageValidator';
import { PackageMigrator } from './PackageMigrator';
import { StorageService } from '../storage/StorageService';
import { MemoryStorageAdapter } from '../storage/adapters/MemoryStorageAdapter';
import { SettingsRepository } from '../storage/repositories/SettingsRepository';
import { WorkspaceStateRepository } from '../storage/repositories/WorkspaceStateRepository';
import { LocalHistoryRepository } from '../storage/repositories/LocalHistoryRepository';
import { RecentResourceRepository } from '../storage/repositories/RecentResourceRepository';
import { ResourceIndexRepository } from '../storage/repositories/ResourceIndexRepository';
import { DocumentRecoveryRepository } from '../storage/repositories/DocumentRecoveryRepository';
import { StorageSerializer } from '../storage/serialization/StorageSerializer';
import { PackageEnvelopeDTO } from './PortabilityTypes';

describe('Phase 05, Step 54 — Application Backup, Export, Import & Safe Data Portability', () => {
  let storageAdapter: MemoryStorageAdapter;
  let storageService: StorageService;
  let settingsRepo: SettingsRepository;
  let workspaceRepo: WorkspaceStateRepository;
  let historyRepo: LocalHistoryRepository;
  let recentRepo: RecentResourceRepository;
  let indexRepo: ResourceIndexRepository;
  let recoveryRepo: DocumentRecoveryRepository;
  let coordinator: BackupCoordinator;

  beforeEach(async () => {
    storageAdapter = new MemoryStorageAdapter();
    storageService = new StorageService({ adapter: storageAdapter });
    await storageService.initialize();

    settingsRepo = new SettingsRepository(storageService);
    workspaceRepo = new WorkspaceStateRepository(storageService);
    historyRepo = new LocalHistoryRepository(storageService);
    recentRepo = new RecentResourceRepository(storageService);
    indexRepo = new ResourceIndexRepository(storageService);
    recoveryRepo = new DocumentRecoveryRepository(storageService);

    coordinator = new BackupCoordinator({
      storage: storageService,
      settingsRepo,
      workspaceRepo,
      historyRepo,
      recentRepo,
      indexRepo,
    });
    await coordinator.initialize();
  });

  afterEach(async () => {
    await coordinator.dispose();
    await storageService.dispose();
  });

  // ===========================================================================
  // 1. Package Validator & Security Boundary Tests
  // ===========================================================================

  describe('1. Package Validator & Security Boundary Tests', () => {
    it('validates a well-formed package envelope successfully', () => {
      const envelope: PackageEnvelopeDTO = {
        manifest: {
          format: 'qm-editor-package',
          formatVersion: 1,
          packageType: 'settingsExport',
          packageId: 'pkg_test_1',
          createdAt: Date.now(),
          applicationVersion: '0.1.0',
          domains: ['settings'],
          recordCounts: { settings: 1 },
          integrity: {
            manifestChecksum: 'abc',
            filesChecksum: StorageSerializer.computeChecksum('settings/user.json:{"theme":"dark"};'),
            totalBytes: 25,
          },
          compatibility: {
            minAppVersion: '0.1.0',
            schemaVersions: { 'qm.settings.user': 1 },
          },
        },
        files: {
          'settings/user.json': '{"theme":"dark"}',
        },
        checksum: StorageSerializer.computeChecksum('settings/user.json:{"theme":"dark"};'),
      };

      const result = PackageValidator.validateEnvelope(envelope);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('rejects path traversal attacks with ../ or ..\\ in file keys', () => {
      expect(PackageValidator.validateRelativePath('../etc/passwd')).toContain('Path traversal');
      expect(PackageValidator.validateRelativePath('settings/../../system32')).toContain('Path traversal');
      expect(PackageValidator.validateRelativePath('..\\boot.ini')).toContain('Path traversal');
    });

    it('rejects absolute paths and drive letter escapes', () => {
      expect(PackageValidator.validateRelativePath('/root/secret.json')).toContain('Absolute paths');
      expect(PackageValidator.validateRelativePath('\\Windows\\System32')).toContain('Absolute paths');
      expect(PackageValidator.validateRelativePath('C:/Users/config.json')).toContain('Drive letters');
      expect(PackageValidator.validateRelativePath('D:\\Data\\workspace.json')).toContain('Drive letters');
      expect(PackageValidator.validateRelativePath('\\\\attacker\\share\\payload')).toContain('UNC network');
    });

    it('rejects paths outside approved package domain namespaces', () => {
      const err = PackageValidator.validateRelativePath('arbitrary/folder/data.json');
      expect(err).toContain('does not belong to any approved package domain namespace');
    });

    it('detects and flags sensitive plaintext secrets and credential leaks', () => {
      expect(PackageValidator.containsSensitiveSecrets({ apiKey: 'secret_123' })).toBe(true);
      expect(PackageValidator.containsSensitiveSecrets({ userPassword: 'pass' })).toBe(true);
      expect(PackageValidator.containsSensitiveSecrets({ private_key: 'rsa_key' })).toBe(true);
      expect(PackageValidator.containsSensitiveSecrets({ client_secret: 'oauth_secret' })).toBe(true);
      expect(PackageValidator.containsSensitiveSecrets({ editor: { tabSize: 2, theme: 'dark' } })).toBe(false);
    });

    it('enforces archive quota and bomb limits on entry counts and file sizes', () => {
      const hugeEnvelope = {
        manifest: {
          format: 'qm-editor-package',
          formatVersion: 1,
          packageType: 'settingsExport',
          packageId: 'pkg_bomb',
          createdAt: Date.now(),
          applicationVersion: '0.1.0',
          domains: ['settings'],
          recordCounts: {},
          integrity: { manifestChecksum: '', filesChecksum: '', totalBytes: 0 },
          compatibility: { minAppVersion: '0.1.0', schemaVersions: {} },
        },
        files: {
          'settings/giant.json': 'x'.repeat(PackageValidator.MAX_SINGLE_FILE_BYTES + 100),
        },
        checksum: 'invalid',
      };

      const result = PackageValidator.validateEnvelope(hugeEnvelope);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds maximum allowed file size'))).toBe(true);
    });
  });

  // ===========================================================================
  // 2. Export & Backup Generation Tests
  // ===========================================================================

  describe('2. Export & Backup Generation Tests', () => {
    it('creates a full application backup with valid manifest and checksums', async () => {
      // Seed settings
      await settingsRepo.saveUserSettings({
        'editor.tabSize': 4,
        'workbench.theme': 'dark-plus',
      });

      // Seed recent workspaces
      await workspaceRepo.saveRecentWorkspaces([
        {
          name: 'Demo Project',
          path: 'file:///projects/demo',
          lastOpened: Date.now(),
        },
      ]);

      const backup = await coordinator.createBackup({
        label: 'Weekly Auto Backup',
      });

      expect(backup.manifest.format).toBe('qm-editor-package');
      expect(backup.manifest.formatVersion).toBe(1);
      expect(backup.manifest.packageType).toBe('fullBackup');
      expect(backup.manifest.label).toBe('Weekly Auto Backup');
      expect(backup.manifest.domains).toContain('settings');
      expect(backup.manifest.domains).toContain('workspace');

      // Verify files in envelope
      expect(backup.files['settings/user.json']).toBeDefined();
      expect(backup.files['workspaces/recent.json']).toBeDefined();
      expect(backup.files['package-manifest.json']).toBeDefined();

      // Verify integrity checksum
      expect(backup.checksum).toBe(backup.manifest.integrity.filesChecksum);
      expect(backup.manifest.integrity.totalBytes).toBeGreaterThan(0);
    });

    it('exports settings only when exportSettings is called and sanitizes secrets', async () => {
      // Direct sanitization test for sensitive settings
      const rawSettings = {
        'editor.wordWrap': true,
        'editor.fontSize': 14,
        'github.accessToken': 'ghp_secret_token_123',
        'auth.clientSecret': 'shh_secret',
      };
      const sanitized = (coordinator as any).sanitizeSettings(rawSettings);
      expect(sanitized['editor.wordWrap']).toBe(true);
      expect(sanitized['editor.fontSize']).toBe(14);
      expect(sanitized['github.accessToken']).toBeUndefined();
      expect(sanitized['auth.clientSecret']).toBeUndefined();

      // Normal export flow
      await settingsRepo.saveUserSettings({
        'editor.wordWrap': true,
        'editor.fontSize': 14,
      });

      const pkg = await coordinator.exportSettings();

      expect(pkg.manifest.packageType).toBe('settingsExport');
      expect(pkg.manifest.domains).toEqual(['settings']);
      expect(pkg.files['settings/user.json']).toBeDefined();
      expect(pkg.files['workspaces/recent.json']).toBeUndefined();

      const exportedSettings = StorageSerializer.deserialize<Record<string, unknown>>(
        pkg.files['settings/user.json']
      );
      expect(exportedSettings['editor.wordWrap']).toBe(true);
      expect(exportedSettings['editor.fontSize']).toBe(14);
    });

    it('exports Local History when explicitly enabled', async () => {
      // Seed a local history entry
      const snapshotId = 'hist_test_exp_1';
      await historyRepo.saveSnapshot({
        version: 1,
        id: snapshotId,
        content: 'const historicalCode = true;',
        contentHash: StorageSerializer.computeChecksum('const historicalCode = true;'),
        createdAt: Date.now(),
      });
      await historyRepo.saveManifest({
        version: 1,
        resourceUri: 'file:///src/index.ts',
        entries: [
          {
            id: snapshotId,
            resourceUri: 'file:///src/index.ts',
            createdAt: Date.now(),
            source: 'save',
            documentRevision: 1,
            contentHash: StorageSerializer.computeChecksum('const historicalCode = true;'),
            contentSize: 28,
            encoding: 'utf-8',
            lineEnding: 'lf',
            languageId: 'typescript',
          },
        ],
        lastUpdatedAt: Date.now(),
      });

      const pkg = await coordinator.exportHistory();

      expect(pkg.manifest.packageType).toBe('historyExport');
      expect(pkg.manifest.domains).toContain('history');
      expect(pkg.files[`history/snapshots/${snapshotId}.json`]).toBeDefined();

      const restoredSnap = StorageSerializer.deserialize<any>(
        pkg.files[`history/snapshots/${snapshotId}.json`]
      );
      expect(restoredSnap.content).toBe('const historicalCode = true;');
    });
  });

  // ===========================================================================
  // 3. Import Planning & Conflict Detection Tests
  // ===========================================================================

  describe('3. Import Planning & Conflict Detection Tests', () => {
    it('generates an accurate import plan detecting settings conflicts', async () => {
      // Local state has tabSize: 2
      await settingsRepo.saveUserSettings({
        'editor.tabSize': 2,
        'editor.lineNumbers': true,
      });

      // Package has tabSize: 4 (conflict!) and minimap: false (new!)
      const pkg = await coordinator.exportSettings();
      pkg.files['settings/user.json'] = JSON.stringify({
        'editor.tabSize': 4,
        'editor.minimap': false,
      });
      // Recompute checksum for test
      (pkg as any).manifest.integrity.filesChecksum = StorageSerializer.computeChecksum(
        `settings/user.json:${pkg.files['settings/user.json']};`
      );
      pkg.files['package-manifest.json'] = JSON.stringify(pkg.manifest);

      const { plan } = await coordinator.generateImportPlan(pkg);

      expect(plan.canApply).toBe(true);
      expect(plan.domains).toContain('settings');
      expect(plan.domainPlans.settings?.conflicts).toBe(1);
      expect(plan.conflicts.length).toBe(1);
      expect(plan.conflicts[0].key).toBe('editor.tabSize');
      expect(plan.conflicts[0].currentVal).toBe(2);
      expect(plan.conflicts[0].incomingVal).toBe(4);
    });

    it('rejects corrupted package during planning phase with descriptive error', async () => {
      const corruptPkg: PackageEnvelopeDTO = {
        manifest: {
          format: 'qm-editor-package',
          formatVersion: 1,
          packageType: 'fullBackup',
          packageId: 'pkg_bad',
          createdAt: Date.now(),
          applicationVersion: '0.1.0',
          domains: ['settings'],
          recordCounts: {},
          integrity: { manifestChecksum: 'm', filesChecksum: 'tampered', totalBytes: 10 },
          compatibility: { minAppVersion: '0.1.0', schemaVersions: {} },
        },
        files: {
          'settings/user.json': '{"a":1}',
        },
        checksum: 'tampered',
      };

      await expect(coordinator.generateImportPlan(corruptPkg)).rejects.toThrow(
        /checksum verification failed/i
      );
    });
  });

  // ===========================================================================
  // 4. Staged Import Application & Strategy Handling
  // ===========================================================================

  describe('4. Staged Import Application & Strategy Handling', () => {
    it('applies settings import with "merge" strategy (retaining non-conflicting keys)', async () => {
      // Initial state
      await settingsRepo.saveUserSettings({
        'editor.tabSize': 2,
        'workbench.theme': 'dark',
      });

      const incomingPackage = await coordinator.exportSettings();
      incomingPackage.files['settings/user.json'] = JSON.stringify({
        'editor.tabSize': 4, // Overwrites to 4
        'editor.wordWrap': true, // Newly merged
      });
      (incomingPackage as any).manifest.integrity.filesChecksum = StorageSerializer.computeChecksum(
        `settings/user.json:${incomingPackage.files['settings/user.json']};`
      );

      const result = await coordinator.applyImport(incomingPackage, { strategy: 'merge' });

      expect(result.status).toBe('completed');
      expect(result.importedDomains).toContain('settings');

      const updated = await settingsRepo.getUserSettings();
      expect(updated['editor.tabSize']).toBe(4);
      expect(updated['editor.wordWrap']).toBe(true);
      expect(updated['workbench.theme']).toBe('dark'); // Preserved!
    });

    it('applies settings import with "replace" strategy (completely replacing state)', async () => {
      await settingsRepo.saveUserSettings({
        'editor.tabSize': 2,
        'workbench.theme': 'dark',
      });

      const incomingPackage = await coordinator.exportSettings();
      incomingPackage.files['settings/user.json'] = JSON.stringify({
        'editor.tabSize': 8,
      });
      (incomingPackage as any).manifest.integrity.filesChecksum = StorageSerializer.computeChecksum(
        `settings/user.json:${incomingPackage.files['settings/user.json']};`
      );

      const result = await coordinator.applyImport(incomingPackage, { strategy: 'replace' });

      expect(result.status).toBe('completed');
      const updated = await settingsRepo.getUserSettings();
      expect(updated['editor.tabSize']).toBe(8);
      expect(updated['workbench.theme']).toBeUndefined(); // Replaced!
    });
  });

  // ===========================================================================
  // 5. Safe Restoration & Safety Backup Tests
  // ===========================================================================

  describe('5. Safe Restoration & Safety Backup Tests', () => {
    it('creates an automatic safety backup of current state before restoreBackup', async () => {
      await settingsRepo.saveUserSettings({ 'editor.tabSize': 2 });

      const incomingPackage = await coordinator.exportSettings();
      incomingPackage.files['settings/user.json'] = JSON.stringify({ 'editor.tabSize': 4 });
      (incomingPackage as any).manifest.integrity.filesChecksum = StorageSerializer.computeChecksum(
        `settings/user.json:${incomingPackage.files['settings/user.json']};`
      );

      const result = await coordinator.restoreBackup(incomingPackage, {
        createSafetyBackup: true,
      });

      expect(result.status).toBe('completed');
      expect(result.safetyBackupId).toBeDefined();

      // Retrieve safety backup from coordinator
      const safetyBackup = coordinator.getSafetyBackup(result.safetyBackupId!);
      expect(safetyBackup).toBeDefined();
      const savedUser = StorageSerializer.deserialize<any>(safetyBackup!.files['settings/user.json']);
      expect(savedUser['editor.tabSize']).toBe(2); // Preserved previous state!
    });

    it('invalidates derived search/resource indexes upon restore', async () => {
      // Seed a derived index in workspace ws_restore_test
      await indexRepo.saveIndex('ws_restore_test', {
        version: 1,
        formatVersion: 1,
        workspaceId: 'ws_restore_test',
        rootUri: 'file:///d:/test',
        indexGeneration: 1,
        workspaceGeneration: 1,
        entries: [],
        totalFiles: 0,
        status: 'fresh',
        indexedAt: Date.now(),
      });

      const incomingPackage = await coordinator.createBackup();

      const result = await coordinator.restoreBackup(incomingPackage, {
        targetWorkspaceId: 'ws_restore_test',
        rebuildIndexes: true,
      });

      expect(result.status).toBe('completed');

      // The derived index should be invalidated/cleared
      const remainingIndex = await indexRepo.getIndex('ws_restore_test');
      expect(remainingIndex).toBeNull();
    });
  });

  // ===========================================================================
  // 6. Schema Migration & Version Adapter Tests
  // ===========================================================================

  describe('6. Schema Migration & Version Adapter Tests', () => {
    it('migrates legacy formatVersion 0 package to current formatVersion 1', () => {
      const legacyPackage: any = {
        manifest: {
          formatVersion: 0,
          domains: ['settings'],
        },
        files: {
          'settings/user.json': '{"migrated":true}',
        },
      };

      const migrated = PackageMigrator.migrate(legacyPackage);

      expect(migrated.manifest.formatVersion).toBe(1);
      expect(migrated.manifest.format).toBe('qm-editor-package');
      expect(migrated.manifest.integrity).toBeDefined();
      expect(migrated.manifest.integrity.filesChecksum).toBeDefined();
      expect(migrated.checksum).toBe(migrated.manifest.integrity.filesChecksum);
    });

    it('rejects packages from newer unsupported format versions safely', () => {
      const futurePackage: any = {
        manifest: {
          format: 'qm-editor-package',
          formatVersion: 999, // Future version!
          domains: ['settings'],
        },
        files: {},
      };

      expect(() => PackageMigrator.migrate(futurePackage)).toThrow(
        /newer than maximum supported version/i
      );
    });
  });

  // ===========================================================================
  // 7. Isolation from Recovery (Step 52)
  // ===========================================================================

  describe('7. Isolation from Recovery (Step 52)', () => {
    it('does not export or mutate crash recovery snapshots during backup operations', async () => {
      // Seed an active recovery snapshot
      await recoveryRepo.saveSnapshot({
        version: 1,
        recoveryId: 'rec_active_backup_test',
        sessionId: 'session_active',
        documentId: 'doc_1',
        isUntitled: false,
        documentRevision: 1,
        recoveryGeneration: 1,
        content: 'unsaved recovery content',
        encoding: 'utf-8',
        lineEnding: 'lf',
        checksum: StorageSerializer.computeChecksum('unsaved recovery content'),
        createdAt: Date.now(),
      });

      // Normal backup should NOT bundle recovery records
      const backup = await coordinator.createBackup();

      expect(backup.manifest.domains).not.toContain('recovery');
      const recFiles = Object.keys(backup.files).filter((k) => k.startsWith('recovery/'));
      expect(recFiles.length).toBe(0);

      // Verify recovery snapshot remains completely intact and uncorrupted
      const activeRecovery = await recoveryRepo.getSnapshot('rec_active_backup_test');
      expect(activeRecovery).not.toBeNull();
      expect(activeRecovery?.content).toBe('unsaved recovery content');
    });
  });
});
