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
  }
}

export const globalSchemaRegistry = SchemaRegistry.getInstance();
