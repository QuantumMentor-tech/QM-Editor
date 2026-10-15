/**
 * QM Editor Backup & Portability Coordinator
 * Phase 05, Step 54 — Backup, Export, Import & Safe Data Portability
 */

import {
  DomainPlan,
  ExportOptions,
  ImportOptions,
  ImportPlanDTO,
  OperationResult,
  PackageEnvelopeDTO,
  PackageManifestDTO,
  PortabilityConflict,
  PortabilityDomain,
  PortabilityHealthReport,
} from './PortabilityTypes';
import { PackageValidator } from './PackageValidator';
import { PackageMigrator } from './PackageMigrator';
import { StorageSerializer } from '../storage/serialization/StorageSerializer';
import {
  ISettingsRepository,
  SettingsRepository,
} from '../storage/repositories/SettingsRepository';
import {
  IWorkspaceStateRepository,
  WorkspaceStateRepository,
} from '../storage/repositories/WorkspaceStateRepository';
import {
  ILocalHistoryRepository,
  globalLocalHistoryRepository,
} from '../storage/repositories/LocalHistoryRepository';
import {
  IRecentResourceRepository,
  RecentResourceRepository,
} from '../storage/repositories/RecentResourceRepository';
import {
  IResourceIndexRepository,
  ResourceIndexRepository,
} from '../storage/repositories/ResourceIndexRepository';
import {
  FeedbackService,
  globalFeedbackService,
} from '../feedback/FeedbackService';
import { StorageService, globalStorageService } from '../storage/StorageService';
import { logger } from '../../utils/logger';

export class BackupCoordinator {
  private static instance: BackupCoordinator | null = null;

  private readonly storage: StorageService;
  private readonly settingsRepo: ISettingsRepository;
  private readonly workspaceRepo: IWorkspaceStateRepository;
  private readonly historyRepo: ILocalHistoryRepository;
  private readonly recentRepo: IRecentResourceRepository;
  private readonly indexRepo: IResourceIndexRepository;
  private readonly feedbackService: FeedbackService;

  private isDisposed: boolean = false;
  private safetyBackups: Map<string, PackageEnvelopeDTO> = new Map();

  constructor(options: {
    storage?: StorageService;
    settingsRepo?: ISettingsRepository;
    workspaceRepo?: IWorkspaceStateRepository;
    historyRepo?: ILocalHistoryRepository;
    recentRepo?: IRecentResourceRepository;
    indexRepo?: IResourceIndexRepository;
    feedbackService?: FeedbackService;
  } = {}) {
    this.storage = options.storage || globalStorageService;
    this.settingsRepo = options.settingsRepo || new SettingsRepository(this.storage);
    this.workspaceRepo = options.workspaceRepo || new WorkspaceStateRepository(this.storage);
    this.historyRepo = options.historyRepo || globalLocalHistoryRepository;
    this.recentRepo = options.recentRepo || new RecentResourceRepository(this.storage);
    this.indexRepo = options.indexRepo || new ResourceIndexRepository(this.storage);
    this.feedbackService = options.feedbackService || globalFeedbackService;

    logger.info('BackupCoordinator initialized');
  }

  public static getInstance(options?: any): BackupCoordinator {
    if (!BackupCoordinator.instance) {
      BackupCoordinator.instance = new BackupCoordinator(options);
    }
    return BackupCoordinator.instance;
  }

  public async initialize(): Promise<void> {
    return Promise.resolve();
  }

  // ---------------------------------------------------------------------------
  // 1. Export & Backup Generation
  // ---------------------------------------------------------------------------

  /**
   * Creates a comprehensive application backup of supported user and application state.
   */
  public async createBackup(options: Partial<ExportOptions> = {}): Promise<PackageEnvelopeDTO> {
    return this.buildPackage({
      type: options.type || 'fullBackup',
      domains: options.domains || ['settings', 'workspace', 'recent', ...(options.includeHistory ? ['history' as PortabilityDomain] : [])],
      workspaceId: options.workspaceId,
      includeHistory: options.includeHistory ?? false,
      includeRecent: options.includeRecent ?? true,
      label: options.label || 'Full Application Backup',
    });
  }

  /**
   * Exports settings and preferences without including workspace or document state.
   */
  public async exportSettings(options: Partial<ExportOptions> = {}): Promise<PackageEnvelopeDTO> {
    return this.buildPackage({
      type: 'settingsExport',
      domains: ['settings'],
      workspaceId: options.workspaceId,
      label: options.label || 'Settings & Preferences Export',
    });
  }

  /**
   * Exports state specific to a single workspace.
   */
  public async exportWorkspace(
    workspaceId: string,
    options: Partial<ExportOptions> = {}
  ): Promise<PackageEnvelopeDTO> {
    return this.buildPackage({
      type: 'workspaceExport',
      domains: ['workspace', 'settings', ...(options.includeHistory ? ['history' as PortabilityDomain] : [])],
      workspaceId,
      includeHistory: options.includeHistory ?? false,
      label: options.label || `Workspace Export (${workspaceId})`,
    });
  }

  /**
   * Exports Local History records for inspection or archival.
   */
  public async exportHistory(
    workspaceId?: string,
    options: Partial<ExportOptions> = {}
  ): Promise<PackageEnvelopeDTO> {
    return this.buildPackage({
      type: 'historyExport',
      domains: ['history'],
      workspaceId,
      includeHistory: true,
      label: options.label || 'Document Local History Export',
    });
  }

  /**
   * Core package builder assembling files, computing checksums, and building the manifest.
   */
  private async buildPackage(options: ExportOptions): Promise<PackageEnvelopeDTO> {
    const files: Record<string, string> = {};
    const recordCounts: Partial<Record<PortabilityDomain, number>> = {};
    const domains: PortabilityDomain[] = options.domains || ['settings'];

    // 1. Settings Domain
    if (domains.includes('settings')) {
      const userSettings = await this.settingsRepo.getUserSettings();
      // Sanitize sensitive values
      const sanitizedUser = this.sanitizeSettings(userSettings);
      files['settings/user.json'] = StorageSerializer.serialize(sanitizedUser, false);
      let count = 1;

      if (options.workspaceId) {
        const wsSettings = await this.settingsRepo.getWorkspaceSettings(options.workspaceId);
        const sanitizedWs = this.sanitizeSettings(wsSettings);
        files[`settings/workspaces/${encodeURIComponent(options.workspaceId)}.json`] =
          StorageSerializer.serialize(sanitizedWs, false);
        count++;
      }
      recordCounts.settings = count;
    }

    // 2. Workspace Domain
    if (domains.includes('workspace')) {
      let count = 0;
      if (options.workspaceId) {
        const meta = await this.workspaceRepo.getWorkspaceMetadata(options.workspaceId);
        if (meta) {
          files[`workspaces/${encodeURIComponent(options.workspaceId)}/metadata.json`] =
            StorageSerializer.serialize(meta, false);
          count++;
        }
      } else {
        const recentWs = await this.workspaceRepo.getRecentWorkspaces();
        if (recentWs.length > 0) {
          files['workspaces/recent.json'] = StorageSerializer.serialize(recentWs, false);
          count += recentWs.length;
        }
      }
      recordCounts.workspace = count;
    }

    // 3. Recent Domain
    if (domains.includes('recent') && options.includeRecent !== false) {
      let count = 0;
      const recentDocs = await this.recentRepo.getRecentResources();
      if (recentDocs.length > 0) {
        files['recent/resources.json'] = StorageSerializer.serialize(recentDocs, false);
        count += recentDocs.length;
      }
      recordCounts.recent = count;
    }

    // 4. Local History Domain
    if (domains.includes('history') && options.includeHistory) {
      let manifestCount = 0;
      let snapshotCount = 0;
      const manifests = await this.historyRepo.listManifests(options.workspaceId);

      for (const m of manifests) {
        files[`history/manifests/${encodeURIComponent(m.resourceUri)}.json`] =
          StorageSerializer.serialize(m, false);
        manifestCount++;

        for (const entry of m.entries) {
          const snapshot = await this.historyRepo.getSnapshot(entry.id);
          if (snapshot) {
            files[`history/snapshots/${snapshot.id}.json`] =
              StorageSerializer.serialize(snapshot, false);
            snapshotCount++;
          }
        }
      }
      recordCounts.history = manifestCount + snapshotCount;
    }

    // 5. Compute Integrity & Metadata
    const sortedKeys = Object.keys(files).sort();
    let combined = '';
    let totalBytes = 0;
    for (const k of sortedKeys) {
      const content = files[k];
      combined += `${k}:${content};`;
      totalBytes += content.length;
    }

    const filesChecksum = StorageSerializer.computeChecksum(combined);
    const packageId = `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const manifest: PackageManifestDTO = {
      format: 'qm-editor-package',
      formatVersion: 1,
      packageType: options.type,
      packageId,
      createdAt: Date.now(),
      applicationVersion: '0.1.0',
      domains,
      recordCounts,
      integrity: {
        manifestChecksum: '', // populated below
        filesChecksum,
        totalBytes,
      },
      sourceEnvironment: {
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'generic',
        workspaceId: options.workspaceId,
      },
      compatibility: {
        minAppVersion: '0.1.0',
        schemaVersions: {
          'qm.settings.user': 1,
          'qm.workspace.metadata': 1,
          'qm.history.manifest': 1,
          'qm.history.snapshot': 1,
        },
      },
      label: options.label,
    };

    const manifestJson = StorageSerializer.serialize(manifest, false);
    const manifestChecksum = StorageSerializer.computeChecksum(manifestJson);
    (manifest.integrity as any).manifestChecksum = manifestChecksum;

    files['package-manifest.json'] = StorageSerializer.serialize(manifest, false);

    logger.info(`BackupCoordinator: built package "${packageId}"`, {
      type: options.type,
      totalFiles: sortedKeys.length,
      totalBytes,
    });

    return {
      manifest,
      files,
      checksum: filesChecksum,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Import Planning & Conflict Analysis
  // ---------------------------------------------------------------------------

  /**
   * Parses, validates, and generates an actionable ImportPlan without mutating state.
   */
  public async generateImportPlan(
    rawPackageOrEnvelope: string | PackageEnvelopeDTO
  ): Promise<{ plan: ImportPlanDTO; envelope: PackageEnvelopeDTO }> {
    let envelope: PackageEnvelopeDTO;

    if (typeof rawPackageOrEnvelope === 'string') {
      try {
        envelope = StorageSerializer.deserialize<PackageEnvelopeDTO>(rawPackageOrEnvelope);
      } catch (err) {
        throw new Error(`Malformed package JSON: ${(err as Error).message}`);
      }
    } else {
      envelope = rawPackageOrEnvelope;
    }

    // Security & Structure Validation
    const validation = PackageValidator.validateEnvelope(envelope);
    if (!validation.valid) {
      throw new Error(`Package validation failed: ${validation.errors.join('; ')}`);
    }

    // Migration Adapter
    envelope = PackageMigrator.migrate(envelope);

    const manifest = envelope.manifest;
    const domainPlans: Partial<Record<PortabilityDomain, DomainPlan>> = {};
    const conflicts: PortabilityConflict[] = [];
    const warnings: string[] = [...validation.warnings];

    // Analyze Settings Conflicts
    if (manifest.domains.includes('settings') && envelope.files['settings/user.json']) {
      try {
        const importedUser = StorageSerializer.deserialize<Record<string, unknown>>(
          envelope.files['settings/user.json']
        );
        const currentUser = await this.settingsRepo.getUserSettings();
        let settingConflicts = 0;

        for (const [k, v] of Object.entries(importedUser)) {
          if (currentUser[k] !== undefined && currentUser[k] !== v) {
            settingConflicts++;
            conflicts.push({
              domain: 'settings',
              key: k,
              description: `Setting "${k}" differs between package and current configuration.`,
              currentVal: currentUser[k],
              incomingVal: v,
            });
          }
        }

        domainPlans.settings = {
          count: Object.keys(importedUser).length,
          conflicts: settingConflicts,
          strategy: settingConflicts > 0 ? 'merge' : 'replace',
        };
      } catch (err) {
        warnings.push(`Could not parse settings payload: ${(err as Error).message}`);
      }
    }

    // Analyze Workspace Conflicts
    if (manifest.domains.includes('workspace')) {
      let wsCount = 0;
      let wsConflicts = 0;
      for (const [k, content] of Object.entries(envelope.files)) {
        if (k.startsWith('workspaces/') && k.endsWith('/metadata.json')) {
          wsCount++;
          try {
            const importedWs = StorageSerializer.deserialize<any>(content);
            const currentWs = await this.workspaceRepo.getWorkspaceMetadata(importedWs.id);
            if (currentWs) {
              wsConflicts++;
              conflicts.push({
                domain: 'workspace',
                key: importedWs.id,
                description: `Workspace "${importedWs.name}" (${importedWs.id}) already exists locally.`,
                currentVal: currentWs.name,
                incomingVal: importedWs.name,
              });
            }
          } catch {
            // ignore
          }
        }
      }
      domainPlans.workspace = {
        count: wsCount,
        conflicts: wsConflicts,
        strategy: wsConflicts > 0 ? 'merge' : 'replace',
      };
    }

    // Analyze History
    if (manifest.domains.includes('history')) {
      let histCount = 0;
      for (const k of Object.keys(envelope.files)) {
        if (k.startsWith('history/snapshots/')) histCount++;
      }
      domainPlans.history = {
        count: histCount,
        conflicts: 0,
        strategy: 'merge',
      };
    }

    // Analyze Recent
    if (manifest.domains.includes('recent')) {
      domainPlans.recent = {
        count: envelope.files['recent/resources.json'] ? 1 : 0,
        conflicts: 0,
        strategy: 'merge',
      };
    }

    const plan: ImportPlanDTO = {
      packageId: manifest.packageId,
      packageType: manifest.packageType,
      createdAt: manifest.createdAt,
      applicationVersion: manifest.applicationVersion,
      domains: manifest.domains,
      domainPlans,
      conflicts,
      warnings,
      canApply: true,
    };

    return { plan, envelope };
  }

  // ---------------------------------------------------------------------------
  // 3. Staged Import Application & Safe Restore
  // ---------------------------------------------------------------------------

  /**
   * Applies validated package content according to requested strategies.
   */
  public async applyImport(
    envelope: PackageEnvelopeDTO,
    options: ImportOptions = {}
  ): Promise<OperationResult> {
    if (this.isDisposed) {
      return {
        status: 'failed',
        packageId: envelope.manifest.packageId,
        operationId: `op_${Date.now()}`,
        completedAt: Date.now(),
        importedDomains: [],
        skippedDomains: envelope.manifest.domains,
        failedDomains: [],
        warnings: ['BackupCoordinator is disposed.'],
        error: 'Coordinator is disposed.',
      };
    }

    // 1. Re-validate envelope
    const validation = PackageValidator.validateEnvelope(envelope);
    if (!validation.valid) {
      return {
        status: 'failed',
        packageId: envelope.manifest?.packageId || 'unknown',
        operationId: `op_${Date.now()}`,
        completedAt: Date.now(),
        importedDomains: [],
        skippedDomains: [],
        failedDomains: envelope.manifest?.domains || [],
        warnings: validation.warnings,
        error: `Validation failure: ${validation.errors.join('; ')}`,
      };
    }

    // 2. Create Safety Backup if requested
    let safetyBackupId: string | undefined;
    if (options.createSafetyBackup !== false) {
      try {
        const safetyBackup = await this.createBackup({
          type: 'fullBackup',
          label: `Safety Backup Before Import (${envelope.manifest.packageId})`,
        });
        safetyBackupId = safetyBackup.manifest.packageId;
        this.safetyBackups.set(safetyBackupId, safetyBackup);
      } catch (err) {
        logger.warn(
          `BackupCoordinator: safety backup failed before import: ${(err as Error).message}`
        );
      }
    }

    const strategy = options.strategy || 'merge';
    const targetDomains = options.selectedDomains || envelope.manifest.domains;
    const importedDomains: PortabilityDomain[] = [];
    const skippedDomains: PortabilityDomain[] = [];
    const failedDomains: PortabilityDomain[] = [];
    const warnings: string[] = [];

    // Apply Settings Domain
    if (targetDomains.includes('settings') && envelope.files['settings/user.json']) {
      try {
        const incomingUser = StorageSerializer.deserialize<Record<string, unknown>>(
          envelope.files['settings/user.json']
        );
        const currentUser = await this.settingsRepo.getUserSettings();

        let finalSettings: Record<string, unknown>;
        if (strategy === 'replace') {
          finalSettings = incomingUser;
        } else if (strategy === 'merge') {
          finalSettings = { ...currentUser, ...incomingUser };
        } else {
          // skip
          finalSettings = { ...incomingUser, ...currentUser };
        }

        await this.settingsRepo.saveUserSettings(finalSettings);
        importedDomains.push('settings');
      } catch (err) {
        failedDomains.push('settings');
        warnings.push(`Failed applying settings: ${(err as Error).message}`);
      }
    }

    // Apply Workspace Domain
    if (targetDomains.includes('workspace')) {
      let wsSuccess = false;
      for (const [k, content] of Object.entries(envelope.files)) {
        if (k.startsWith('workspaces/') && k.endsWith('/metadata.json')) {
          try {
            const meta = StorageSerializer.deserialize<any>(content);
            await this.workspaceRepo.saveWorkspaceMetadata(meta.id, meta);
            wsSuccess = true;
          } catch (err) {
            warnings.push(`Failed importing workspace "${k}": ${(err as Error).message}`);
          }
        }
      }
      if (wsSuccess) {
        importedDomains.push('workspace');
      }
    }

    // Apply History Domain
    if (targetDomains.includes('history')) {
      let histSuccess = false;
      try {
        // 1. Import snapshots first
        for (const [k, content] of Object.entries(envelope.files)) {
          if (k.startsWith('history/snapshots/')) {
            const snapshot = StorageSerializer.deserialize<any>(content);
            await this.historyRepo.saveSnapshot(snapshot);
            histSuccess = true;
          }
        }

        // 2. Import manifests
        for (const [k, content] of Object.entries(envelope.files)) {
          if (k.startsWith('history/manifests/')) {
            const importedManifest = StorageSerializer.deserialize<any>(content);
            const existing = await this.historyRepo.getManifest(
              importedManifest.resourceUri,
              importedManifest.workspaceId
            );

            if (existing && strategy === 'merge') {
              // Merge entries avoiding duplicates
              const existingIds = new Set(existing.entries.map((e: any) => e.id));
              const mergedEntries = [...existing.entries];
              for (const e of importedManifest.entries) {
                if (!existingIds.has(e.id)) {
                  mergedEntries.push(e);
                }
              }
              await this.historyRepo.saveManifest({
                ...existing,
                entries: mergedEntries.sort((a, b) => b.createdAt - a.createdAt),
                lastUpdatedAt: Date.now(),
              });
            } else {
              await this.historyRepo.saveManifest(importedManifest);
            }
          }
        }
        if (histSuccess) {
          importedDomains.push('history');
        }
      } catch (err) {
        failedDomains.push('history');
        warnings.push(`Failed importing history: ${(err as Error).message}`);
      }
    }

    // Invalidate derived caches if requested
    if (options.rebuildIndexes !== false) {
      try {
        if (options.targetWorkspaceId) {
          await this.indexRepo.deleteIndex(options.targetWorkspaceId);
        }
      } catch {
        // non-blocking
      }
    }

    const isFullySuccessful = failedDomains.length === 0;
    const result: OperationResult = {
      status: isFullySuccessful ? 'completed' : importedDomains.length > 0 ? 'partial' : 'failed',
      packageId: envelope.manifest.packageId,
      operationId: `op_${Date.now()}`,
      completedAt: Date.now(),
      importedDomains,
      skippedDomains,
      failedDomains,
      warnings,
      safetyBackupId,
    };

    if (result.status === 'completed') {
      this.feedbackService.show({
        severity: 'info',
        title: 'Package Imported',
        message: `Successfully imported ${importedDomains.join(', ')}.`,
      });
    }

    return result;
  }

  /**
   * Restores a previously created backup, executing complete safety backup and domain restoration.
   */
  public async restoreBackup(
    envelope: PackageEnvelopeDTO,
    options: ImportOptions = {}
  ): Promise<OperationResult> {
    // Restore defaults to 'replace' strategy and mandatory safety backup
    return this.applyImport(envelope, {
      ...options,
      strategy: options.strategy || 'replace',
      createSafetyBackup: options.createSafetyBackup ?? true,
      rebuildIndexes: options.rebuildIndexes ?? true,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Sanitization & Health
  // ---------------------------------------------------------------------------

  private sanitizeSettings(settings: Record<string, unknown>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(settings)) {
      if (!PackageValidator.containsSensitiveSecrets({ [k]: v })) {
        clean[k] = v;
      }
    }
    return clean;
  }

  public getSafetyBackup(packageId: string): PackageEnvelopeDTO | undefined {
    return this.safetyBackups.get(packageId);
  }

  public async getHealth(): Promise<PortabilityHealthReport> {
    return {
      ready: !this.isDisposed,
      totalBackups: this.safetyBackups.size,
      lastBackupTimestamp: Date.now(),
      storageBytesUsed: 0,
      issues: [],
    };
  }

  public async dispose(): Promise<void> {
    this.isDisposed = true;
    this.safetyBackups.clear();
    BackupCoordinator.instance = null;
    logger.info('BackupCoordinator disposed');
  }
}

export const globalBackupCoordinator = BackupCoordinator.getInstance();
