/**
 * QM Editor Package Validator & Security Boundary
 * Phase 05, Step 54 — Backup, Export, Import & Safe Data Portability
 */

import {
  PackageEnvelopeDTO,
  PackageManifestDTO,
} from './PortabilityTypes';
import { StorageSerializer } from '../storage/serialization/StorageSerializer';

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

export class PackageValidator {
  public static readonly MAX_FILE_COUNT = 5000;
  public static readonly MAX_SINGLE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
  public static readonly MAX_PACKAGE_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB

  private static readonly SENSITIVE_KEY_PATTERNS = [
    /password/i,
    /api[_-]?secret/i,
    /api[_-]?key/i,
    /secret/i,
    /private[_-]?key/i,
    /access[_-]?token/i,
    /auth[_-]?token/i,
    /client[_-]?secret/i,
    /credential/i,
  ];

  /**
   * Performs complete structural, security, integrity, and quota validation on an incoming package envelope.
   */
  public static validateEnvelope(envelope: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
      return { valid: false, errors: ['Package payload must be a non-null object.'], warnings: [] };
    }

    const env = envelope as Partial<PackageEnvelopeDTO>;

    // 1. Manifest Presence
    if (!env.manifest || typeof env.manifest !== 'object') {
      errors.push('Package is missing required "manifest" metadata.');
      return { valid: false, errors, warnings };
    }

    const manifestErrors = this.validateManifest(env.manifest);
    errors.push(...manifestErrors);

    // 2. Files Dictionary Presence
    if (!env.files || typeof env.files !== 'object' || Array.isArray(env.files)) {
      errors.push('Package is missing required "files" record map.');
      return { valid: false, errors, warnings };
    }

    // 3. Quota & Archive Bomb Protection
    const fileEntries = Object.entries(env.files);
    if (fileEntries.length > this.MAX_FILE_COUNT) {
      errors.push(
        `Package exceeds maximum allowed entry count (${fileEntries.length} > ${this.MAX_FILE_COUNT}).`
      );
    }

    let totalCalculatedBytes = 0;
    const sortedFileKeys = Object.keys(env.files)
      .filter((k) => k !== 'package-manifest.json')
      .sort();
    let combinedContent = '';

    for (const [relPath, content] of fileEntries) {
      // Path Traversal Security Check
      const pathError = this.validateRelativePath(relPath);
      if (pathError) {
        errors.push(`Insecure path detected ("${relPath}"): ${pathError}`);
      }

      if (typeof content !== 'string') {
        errors.push(`File entry "${relPath}" must be a string payload.`);
        continue;
      }

      const byteLength = content.length;
      if (byteLength > this.MAX_SINGLE_FILE_BYTES) {
        errors.push(
          `File entry "${relPath}" exceeds maximum allowed file size (${byteLength} bytes > ${this.MAX_SINGLE_FILE_BYTES} bytes).`
        );
      }

      totalCalculatedBytes += byteLength;
    }

    if (totalCalculatedBytes > this.MAX_PACKAGE_TOTAL_BYTES) {
      errors.push(
        `Package total uncompressed size exceeds limit (${totalCalculatedBytes} bytes > ${this.MAX_PACKAGE_TOTAL_BYTES} bytes).`
      );
    }

    // 4. Integrity Checksum Validation
    if (errors.length === 0 && env.manifest.integrity) {
      for (const k of sortedFileKeys) {
        combinedContent += `${k}:${env.files[k]};`;
      }
      const computedFilesChecksum = StorageSerializer.computeChecksum(combinedContent);
      if (
        env.manifest.integrity.filesChecksum &&
        env.manifest.integrity.filesChecksum !== computedFilesChecksum
      ) {
        errors.push(
          `Package files checksum verification failed. Expected "${env.manifest.integrity.filesChecksum}", computed "${computedFilesChecksum}".`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validates manifest structure and required attributes.
   */
  public static validateManifest(manifest: Partial<PackageManifestDTO>): string[] {
    const errors: string[] = [];

    if (manifest.format !== 'qm-editor-package') {
      errors.push(`Unsupported package format "${manifest.format}". Expected "qm-editor-package".`);
    }

    if (typeof manifest.formatVersion !== 'number' || manifest.formatVersion < 1) {
      errors.push(`Unsupported or missing formatVersion "${manifest.formatVersion}".`);
    }

    if (!manifest.packageId || typeof manifest.packageId !== 'string' || manifest.packageId.trim().length === 0) {
      errors.push('Package is missing a valid "packageId".');
    }

    if (typeof manifest.createdAt !== 'number' || manifest.createdAt <= 0) {
      errors.push('Package is missing a valid "createdAt" timestamp.');
    }

    const validPackageTypes = [
      'fullBackup',
      'workspaceExport',
      'settingsExport',
      'historyExport',
      'migrationPackage',
    ];
    if (!manifest.packageType || !validPackageTypes.includes(manifest.packageType)) {
      errors.push(`Unknown packageType "${manifest.packageType}".`);
    }

    if (!Array.isArray(manifest.domains) || manifest.domains.length === 0) {
      errors.push('Package manifest must specify at least one target domain.');
    }

    if (!manifest.integrity || typeof manifest.integrity !== 'object') {
      errors.push('Package manifest is missing "integrity" metadata.');
    }

    return errors;
  }

  /**
   * Validates relative archive paths to prevent path traversal and arbitrary filesystem writes.
   */
  public static validateRelativePath(relPath: string): string | null {
    if (!relPath || typeof relPath !== 'string') {
      return 'Path cannot be empty.';
    }

    // Prevent path traversal
    if (relPath.includes('..') || relPath.includes('/../') || relPath.includes('\\..\\')) {
      return 'Path traversal tokens ("..") are strictly forbidden.';
    }

    // Prevent UNC network paths
    if (relPath.startsWith('//') || relPath.startsWith('\\\\')) {
      return 'UNC network paths are forbidden.';
    }

    // Prevent absolute paths or root references
    if (relPath.startsWith('/') || relPath.startsWith('\\')) {
      return 'Absolute paths are forbidden; paths must be relative.';
    }

    // Prevent Windows drive letters or colons (e.g. C:, D:)
    if (/[a-zA-Z]:/.test(relPath) || relPath.includes(':')) {
      return 'Drive letters or colons are forbidden in archive paths.';
    }

    // Allowed domains root folders
    const allowedPrefixes = ['settings/', 'workspaces/', 'history/', 'documents/', 'metadata/', 'recovery/', 'recent/'];
    const hasValidPrefix = allowedPrefixes.some((p) => relPath.startsWith(p));
    if (!hasValidPrefix && relPath !== 'package-manifest.json') {
      return `Path "${relPath}" does not belong to any approved package domain namespace.`;
    }

    return null;
  }

  /**
   * Scans an object payload for accidental secret keys.
   */
  public static containsSensitiveSecrets(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;

    const seen = new WeakSet();

    const scan = (val: unknown): boolean => {
      if (!val || typeof val !== 'object') return false;
      if (seen.has(val as object)) return false;
      seen.add(val as object);

      if (Array.isArray(val)) {
        return val.some(scan);
      }

      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        for (const pattern of PackageValidator.SENSITIVE_KEY_PATTERNS) {
          if (pattern.test(k) && typeof v === 'string' && v.trim().length > 0) {
            return true;
          }
        }
        if (typeof v === 'object' && scan(v)) {
          return true;
        }
      }
      return false;
    };

    return scan(data);
  }
}
