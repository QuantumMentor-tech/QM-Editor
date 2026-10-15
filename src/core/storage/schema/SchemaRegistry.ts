/**
 * QM Editor Schema Registry
 * Phase 05, Step 46 — Data & Storage Architecture Foundation
 */

import { StorageSchemaDefinition } from '../StorageTypes';
import { StorageValidationError } from '../StorageErrors';

export class SchemaRegistry {
  private static instance: SchemaRegistry;
  private schemas = new Map<string, StorageSchemaDefinition<any>>();

  private constructor() {
    this.registerDefaultSchemas();
  }

  public static getInstance(): SchemaRegistry {
    if (!SchemaRegistry.instance) {
      SchemaRegistry.instance = new SchemaRegistry();
    }
    return SchemaRegistry.instance;
  }

  public register<T>(definition: StorageSchemaDefinition<T>): void {
    this.schemas.set(definition.schemaId, definition);
  }

  public get<T = unknown>(schemaId: string): StorageSchemaDefinition<T> | undefined {
    return this.schemas.get(schemaId);
  }

  public has(schemaId: string): boolean {
    return this.schemas.has(schemaId);
  }

  public validate<T>(schemaId: string, data: unknown): data is T {
    const schema = this.schemas.get(schemaId);
    if (!schema) {
      // If unregistered schema, treat as invalid
      throw new StorageValidationError(`Unregistered schema ID: "${schemaId}".`);
    }

    if (!schema.validate(data)) {
      throw new StorageValidationError(
        `Payload failed schema validation for "${schemaId}" (version ${schema.currentVersion}).`,
        { schemaId, currentVersion: schema.currentVersion }
      );
    }

    return true;
  }

  public reset(): void {
    this.schemas.clear();
    this.registerDefaultSchemas();
  }

  private registerDefaultSchemas(): void {
    // 1. User Settings Schema (v1)
    this.register({
      schemaId: 'qm.settings.user',
      currentVersion: 1,
      description: 'Global application user settings and preferences',
      validate: (data: unknown): data is Record<string, unknown> => {
        return typeof data === 'object' && data !== null && !Array.isArray(data);
      },
    });

    // 2. Workspace Settings Schema (v1)
    this.register({
      schemaId: 'qm.settings.workspace',
      currentVersion: 1,
      description: 'Workspace-scoped configuration overrides',
      validate: (data: unknown): data is Record<string, unknown> => {
        return typeof data === 'object' && data !== null && !Array.isArray(data);
      },
    });

    // 3. Workspace Metadata Schema (v1)
    this.register({
      schemaId: 'qm.workspace.metadata',
      currentVersion: 1,
      description: 'Workspace identity, roots, and lifecycle metadata',
      validate: (data: unknown): data is any => {
        if (typeof data !== 'object' || data === null) return false;
        const d = data as Record<string, any>;
        return (
          typeof d.id === 'string' &&
          typeof d.name === 'string' &&
          Array.isArray(d.roots) &&
          typeof d.createdAt === 'number'
        );
      },
    });

    // 4. Workspace Session Schema (v1)
    this.register({
      schemaId: 'qm.session.workspace',
      currentVersion: 1,
      description: 'Active tabs, cursor locations, and view state for workspace continuity',
      validate: (data: unknown): data is any => {
        if (typeof data !== 'object' || data === null) return false;
        const d = data as Record<string, any>;
        return typeof d.version === 'number' && Array.isArray(d.openFilePaths);
      },
    });

    // 5. Recent Workspaces & Documents (v1)
    this.register({
      schemaId: 'qm.navigation.recent',
      currentVersion: 1,
      description: 'Recent workspace and document history metadata',
      validate: (data: unknown): data is any[] => {
        return Array.isArray(data);
      },
    });

    // 6. Persistent Document Metadata Schema (v1)
    this.register({
      schemaId: 'qm.document.metadata',
      currentVersion: 1,
      description: 'Durable non-content document metadata, preferences, and state',
      validate: (data: unknown): data is any => {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
        const d = data as Record<string, any>;
        return (
          typeof d.version === 'number' &&
          typeof d.resourceUri === 'string' &&
          d.resourceUri.trim().length > 0 &&
          typeof d.workspaceId === 'string' &&
          d.workspaceId.trim().length > 0 &&
          typeof d.languageId === 'string' &&
          typeof d.encoding === 'string' &&
          (d.lineEnding === undefined || d.lineEnding === 'lf' || d.lineEnding === 'crlf' || d.lineEnding === 'cr') &&
          typeof d.lastOpenedAt === 'number'
        );
      },
    });

    // 7. Persistent Resource State Schema (v1)
    this.register({
      schemaId: 'qm.resource.state',
      currentVersion: 1,
      description: 'Durable filesystem resource state and existence tracking',
      validate: (data: unknown): data is any => {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
        const d = data as Record<string, any>;
        return (
          typeof d.version === 'number' &&
          typeof d.resourceUri === 'string' &&
          d.resourceUri.trim().length > 0 &&
          typeof d.workspaceId === 'string' &&
          d.workspaceId.trim().length > 0 &&
          typeof d.basename === 'string' &&
          typeof d.scheme === 'string' &&
          d.scheme.trim().length > 0 &&
          typeof d.exists === 'boolean' &&
          typeof d.lastCheckedAt === 'number'
        );
      },
    });

    // 8. Navigation History Schema (v1)
    this.register({
      schemaId: 'qm.navigation.history',
      currentVersion: 1,
      description: 'Durable navigation history, back/forward stacks, and locations',
      validate: (data: unknown): data is any => {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
        const d = data as Record<string, any>;
        return (
          typeof d.version === 'number' &&
          Array.isArray(d.backStack) &&
          Array.isArray(d.forwardStack) &&
          typeof d.updatedAt === 'number'
        );
      },
    });

    // 9. Workspace Resource Index & Search Cache Schema (v1)
    this.register({
      schemaId: 'qm.workspace.index',
      currentVersion: 1,
      description: 'Derived workspace resource index and search candidate metadata cache',
      validate: (data: unknown): data is any => {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
        const d = data as Record<string, any>;
        return (
          typeof d.version === 'number' &&
          typeof d.workspaceId === 'string' &&
          d.workspaceId.trim().length > 0 &&
          typeof d.rootUri === 'string' &&
          typeof d.indexGeneration === 'number' &&
          typeof d.workspaceGeneration === 'number' &&
          Array.isArray(d.entries) &&
          typeof d.totalFiles === 'number' &&
          typeof d.indexedAt === 'number'
        );
      },
    });

    // 10. Document Recovery Manifest Schema (v1)
    this.register({
      schemaId: 'qm.recovery.manifest',
      currentVersion: 1,
      description: 'Durable session recovery manifest tracking unsaved document snapshot candidates',
      validate: (data: unknown): data is any => {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
        const d = data as Record<string, any>;
        const validStates = ['active', 'clean', 'candidate', 'restored', 'discarded'];
        return (
          typeof d.version === 'number' &&
          typeof d.sessionId === 'string' &&
          d.sessionId.trim().length > 0 &&
          typeof d.startedAt === 'number' &&
          typeof d.lastUpdatedAt === 'number' &&
          typeof d.state === 'string' &&
          validStates.includes(d.state) &&
          Array.isArray(d.documents)
        );
      },
    });

    // 11. Document Recovery Snapshot Schema (v1)
    this.register({
      schemaId: 'qm.recovery.snapshot',
      currentVersion: 1,
      description: 'Temporary durable safety snapshot containing unsaved document content and integrity hash',
      validate: (data: unknown): data is any => {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
        const d = data as Record<string, any>;
        const validEndings = ['lf', 'crlf', 'cr'];
        return (
          typeof d.version === 'number' &&
          typeof d.recoveryId === 'string' &&
          d.recoveryId.trim().length > 0 &&
          typeof d.sessionId === 'string' &&
          d.sessionId.trim().length > 0 &&
          typeof d.documentId === 'string' &&
          d.documentId.trim().length > 0 &&
          typeof d.isUntitled === 'boolean' &&
          typeof d.documentRevision === 'number' &&
          typeof d.recoveryGeneration === 'number' &&
          typeof d.content === 'string' &&
          typeof d.encoding === 'string' &&
          typeof d.lineEnding === 'string' &&
          validEndings.includes(d.lineEnding) &&
          typeof d.checksum === 'string' &&
          typeof d.createdAt === 'number'
        );
      },
    });

    // 12. Document Recovery Session Schema (v1)
    this.register({
      schemaId: 'qm.recovery.session',
      currentVersion: 1,
      description: 'Durable active/last application session state pointer for crash detection',
      validate: (data: unknown): data is any => {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
        const d = data as Record<string, any>;
        const validStates = ['active', 'clean', 'candidate', 'restored', 'discarded'];
        return (
          typeof d.schemaVersion === 'number' &&
          typeof d.sessionId === 'string' &&
          d.sessionId.trim().length > 0 &&
          typeof d.startedAt === 'number' &&
          typeof d.lastUpdatedAt === 'number' &&
          typeof d.state === 'string' &&
          validStates.includes(d.state)
        );
      },
    });

    // 13. Document Local History Manifest Schema (v1)
    this.register({
      schemaId: 'qm.history.manifest',
      currentVersion: 1,
      description: 'Durable document local history manifest listing historical version snapshots',
      validate: (data: unknown): data is any => {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
        const d = data as Record<string, any>;
        return (
          typeof d.version === 'number' &&
          typeof d.resourceUri === 'string' &&
          d.resourceUri.trim().length > 0 &&
          Array.isArray(d.entries) &&
          typeof d.lastUpdatedAt === 'number'
        );
      },
    });

    // 14. Document Local History Snapshot Content Schema (v1)
    this.register({
      schemaId: 'qm.history.snapshot',
      currentVersion: 1,
      description: 'Durable immutable historical document content snapshot with integrity hash',
      validate: (data: unknown): data is any => {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
        const d = data as Record<string, any>;
        return (
          typeof d.version === 'number' &&
          typeof d.id === 'string' &&
          d.id.trim().length > 0 &&
          typeof d.content === 'string' &&
          typeof d.contentHash === 'string' &&
          typeof d.createdAt === 'number'
        );
      },
    });

    // 15. Portability Package Manifest Schema (v1)
    this.register({
      schemaId: 'qm.portability.manifest',
      currentVersion: 1,
      description: 'Portable package manifest identifying version, packageType, domains and integrity',
      validate: (data: unknown): data is any => {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
        const d = data as Record<string, any>;
        return (
          d.format === 'qm-editor-package' &&
          typeof d.formatVersion === 'number' &&
          typeof d.packageId === 'string' &&
          d.packageId.trim().length > 0 &&
          typeof d.packageType === 'string' &&
          typeof d.createdAt === 'number' &&
          Array.isArray(d.domains) &&
          typeof d.integrity === 'object' &&
          d.integrity !== null
        );
      },
    });

    // 16. Portability Package Envelope Schema (v1)
    this.register({
      schemaId: 'qm.portability.package',
      currentVersion: 1,
      description: 'Portable package envelope containing manifest, virtual file tree and integrity checksum',
      validate: (data: unknown): data is any => {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
        const d = data as Record<string, any>;
        return (
          typeof d.manifest === 'object' &&
          d.manifest !== null &&
          typeof d.files === 'object' &&
          d.files !== null &&
          !Array.isArray(d.files) &&
          typeof d.checksum === 'string'
        );
      },
    });
  }
}

export const globalSchemaRegistry = SchemaRegistry.getInstance();
