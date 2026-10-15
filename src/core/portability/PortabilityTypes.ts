/**
 * QM Editor Backup, Export, Import & Data Portability Types
 * Phase 05, Step 54 — Backup, Export, Import & Safe Data Portability
 */

export type PortabilityPackageType =
  | 'fullBackup'
  | 'workspaceExport'
  | 'settingsExport'
  | 'historyExport'
  | 'migrationPackage';

export type PortabilityDomain =
  | 'settings'
  | 'workspace'
  | 'history'
  | 'documents'
  | 'recovery'
  | 'recent';

export type PortabilityStrategy = 'skip' | 'replace' | 'merge';

export interface PackageIntegrityMetadata {
  readonly manifestChecksum: string;
  readonly filesChecksum: string;
  readonly totalBytes: number;
}

export interface PackageManifestDTO {
  readonly format: 'qm-editor-package';
  readonly formatVersion: number; // schema version (currently 1)
  readonly packageType: PortabilityPackageType;
  readonly packageId: string;
  readonly createdAt: number;
  readonly applicationVersion: string;
  readonly domains: PortabilityDomain[];
  readonly recordCounts: Partial<Record<PortabilityDomain, number>>;
  readonly integrity: PackageIntegrityMetadata;
  readonly sourceEnvironment?: {
    readonly platform?: string;
    readonly workspaceId?: string;
    readonly workspaceName?: string;
  };
  readonly compatibility: {
    readonly minAppVersion: string;
    readonly schemaVersions: Record<string, number>;
  };
  readonly label?: string;
}

export interface PackageEnvelopeDTO {
  readonly manifest: PackageManifestDTO;
  /**
   * Relative virtual file paths mapped to JSON or string payloads.
   * e.g. "settings/user.json", "workspaces/ws-main.json", "history/manifests/file.json"
   */
  readonly files: Record<string, string>;
  readonly checksum: string;
}

export interface DomainPlan {
  readonly count: number;
  readonly conflicts: number;
  readonly strategy: PortabilityStrategy;
  readonly requiresMigration?: boolean;
}

export interface PortabilityConflict {
  readonly domain: PortabilityDomain;
  readonly key: string;
  readonly description: string;
  readonly currentVal?: unknown;
  readonly incomingVal?: unknown;
}

export interface ImportPlanDTO {
  readonly packageId: string;
  readonly packageType: PortabilityPackageType;
  readonly createdAt: number;
  readonly applicationVersion: string;
  readonly domains: PortabilityDomain[];
  readonly domainPlans: Partial<Record<PortabilityDomain, DomainPlan>>;
  readonly conflicts: PortabilityConflict[];
  readonly warnings: string[];
  readonly canApply: boolean;
}

export interface OperationResult {
  readonly status: 'completed' | 'partial' | 'failed' | 'cancelled';
  readonly packageId: string;
  readonly operationId: string;
  readonly completedAt: number;
  readonly importedDomains: PortabilityDomain[];
  readonly skippedDomains: PortabilityDomain[];
  readonly failedDomains: PortabilityDomain[];
  readonly warnings: string[];
  readonly safetyBackupId?: string;
  readonly error?: string;
}

export interface ExportOptions {
  readonly type: PortabilityPackageType;
  readonly domains?: PortabilityDomain[];
  readonly workspaceId?: string;
  readonly includeHistory?: boolean;
  readonly includeRecent?: boolean;
  readonly label?: string;
}

export interface ImportOptions {
  readonly strategy?: PortabilityStrategy;
  readonly selectedDomains?: PortabilityDomain[];
  readonly createSafetyBackup?: boolean;
  readonly rebuildIndexes?: boolean;
  readonly targetWorkspaceId?: string;
}

export interface PortabilityHealthReport {
  readonly ready: boolean;
  readonly totalBackups: number;
  readonly lastBackupTimestamp?: number;
  readonly storageBytesUsed: number;
  readonly issues: string[];
}
