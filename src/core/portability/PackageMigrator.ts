/**
 * QM Editor Package Migration & Version Adapter
 * Phase 05, Step 54 — Backup, Export, Import & Safe Data Portability
 */

import {
  PackageEnvelopeDTO,
  PackageManifestDTO,
} from './PortabilityTypes';
import { StorageSerializer } from '../storage/serialization/StorageSerializer';

export class PackageMigrator {
  public static readonly CURRENT_FORMAT_VERSION = 1;

  /**
   * Evaluates package format version and migrates older schemas deterministically.
   */
  public static migrate(envelope: PackageEnvelopeDTO): PackageEnvelopeDTO {
    const version = envelope.manifest.formatVersion || 0;

    if (version > this.CURRENT_FORMAT_VERSION) {
      throw new Error(
        `Package format version ${version} is newer than maximum supported version ${this.CURRENT_FORMAT_VERSION}. Please update QM Editor to import this package.`
      );
    }

    if (version === this.CURRENT_FORMAT_VERSION) {
      // Already on current schema version
      return envelope;
    }

    // Migration from v0 (legacy / unversioned) -> v1
    let migratedManifest: PackageManifestDTO = { ...envelope.manifest };
    const migratedFiles: Record<string, string> = { ...envelope.files };

    if (version === 0) {
      const sortedKeys = Object.keys(migratedFiles).sort();
      let combined = '';
      let totalBytes = 0;
      for (const k of sortedKeys) {
        const c = migratedFiles[k];
        combined += `${k}:${c};`;
        totalBytes += c.length;
      }
      const filesChecksum = StorageSerializer.computeChecksum(combined);
      const manifestChecksum = StorageSerializer.computeChecksum(
        JSON.stringify(migratedManifest)
      );

      migratedManifest = {
        ...migratedManifest,
        format: 'qm-editor-package',
        formatVersion: 1,
        packageType: migratedManifest.packageType || 'fullBackup',
        packageId:
          migratedManifest.packageId ||
          `migrated_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: migratedManifest.createdAt || Date.now(),
        applicationVersion: migratedManifest.applicationVersion || '0.1.0',
        domains: migratedManifest.domains || ['settings'],
        recordCounts: migratedManifest.recordCounts || { settings: Object.keys(migratedFiles).length },
        integrity: {
          manifestChecksum,
          filesChecksum,
          totalBytes,
        },
        compatibility: {
          minAppVersion: '0.1.0',
          schemaVersions: {
            'qm.settings.user': 1,
            'qm.workspace.metadata': 1,
          },
        },
      };
    }

    return {
      manifest: migratedManifest,
      files: migratedFiles,
      checksum: migratedManifest.integrity.filesChecksum,
    };
  }
}
