/**
 * QM Editor Workspace & Project Context Engine
 * Phase 04, Step 30 — Core Workspace Subsystem
 */

import {
  WorkspaceModel,
  WorkspaceRoot,
  WorkspaceState,
  WorkspaceCapabilities,
  WorkspaceRequestContext,
  PersistedWorkspaceState,
  WorkspaceEventMap,
  WorkspaceEventKey,
  WorkspaceEventListener,
  WorkspaceOpenOptions,
  UnsavedChangesChecker,
} from './WorkspaceTypes';
import {
  InvalidWorkspaceRootError,
  WorkspaceTransitionLockedError,
  WorkspaceNotOpenError,
  WorkspaceUnsavedChangesError,
} from './WorkspaceErrors';
import {
  normalizeWorkspacePath,
  isResourceInRoot,
  resolveRelativeResource,
  getRelativeResourcePath,
  findRootForResource,
} from './WorkspaceResourceBoundary';
import { logger } from '../../utils/logger';

export interface WorkspaceEngineOptions {
  initialGeneration?: number;
}

export class WorkspaceEngine {
  private currentWorkspace: WorkspaceModel | null = null;
  private generation: number;
  private isTransitioning: boolean = false;
  private listeners = new Map<WorkspaceEventKey, Set<WorkspaceEventListener<any>>>();
  private unsavedChangesChecker?: UnsavedChangesChecker;

  constructor(options: WorkspaceEngineOptions = {}) {
    this.generation = options.initialGeneration ?? 1;
  }

  // ---------------------------------------------------------------------------
  // 1. Current State & Metadata Accessors
  // ---------------------------------------------------------------------------

  public getState(): WorkspaceState {
    return this.currentWorkspace ? this.currentWorkspace.state : 'none';
  }

  public isOpen(): boolean {
    return (
      this.currentWorkspace !== null &&
      (this.currentWorkspace.state === 'ready' || this.currentWorkspace.state === 'degraded')
    );
  }

  public getWorkspaceId(): string | null {
    return this.currentWorkspace ? this.currentWorkspace.id : null;
  }

  public getWorkspaceName(): string {
    return this.currentWorkspace ? this.currentWorkspace.name : 'No Workspace';
  }

  public getRoots(): WorkspaceRoot[] {
    return this.currentWorkspace ? [...this.currentWorkspace.roots] : [];
  }

  public getPrimaryRoot(): WorkspaceRoot | null {
    if (!this.currentWorkspace || this.currentWorkspace.roots.length === 0) {
      return null;
    }
    return this.currentWorkspace.roots[0];
  }

  public getGeneration(): number {
    return this.generation;
  }

  public getCapabilities(): WorkspaceCapabilities {
    if (!this.currentWorkspace) {
      return {
        filesystemAvailable: false,
        configurationAvailable: false,
        sourceControlAvailable: false,
        tasksAvailable: false,
        searchAvailable: false,
      };
    }
    return { ...this.currentWorkspace.capabilities };
  }

  public getSnapshot(): WorkspaceModel | null {
    if (!this.currentWorkspace) return null;
    return {
      ...this.currentWorkspace,
      roots: this.currentWorkspace.roots.map((r) => ({ ...r })),
      capabilities: { ...this.currentWorkspace.capabilities },
      configuration: this.currentWorkspace.configuration ? { ...this.currentWorkspace.configuration } : undefined,
      projectMetadata: this.currentWorkspace.projectMetadata ? { ...this.currentWorkspace.projectMetadata } : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Unsaved Changes & Protection Hooks
  // ---------------------------------------------------------------------------

  public registerUnsavedChangesChecker(checker: UnsavedChangesChecker): () => void {
    this.unsavedChangesChecker = checker;
    return () => {
      if (this.unsavedChangesChecker === checker) {
        this.unsavedChangesChecker = undefined;
      }
    };
  }

  public async hasUnsavedChanges(): Promise<boolean> {
    if (!this.unsavedChangesChecker) return false;
    return Boolean(await this.unsavedChangesChecker());
  }

  // ---------------------------------------------------------------------------
  // 3. Generation & Async Stale Result Safety
  // ---------------------------------------------------------------------------

  public createRequestContext(): WorkspaceRequestContext {
    const wsId = this.currentWorkspace ? this.currentWorkspace.id : 'no-workspace';
    const rootIds = this.currentWorkspace ? this.currentWorkspace.roots.map((r) => r.rootId) : [];
    return {
      workspaceId: wsId,
      generation: this.generation,
      rootIds,
    };
  }

  public isGenerationValid(generation: number): boolean {
    return this.generation === generation;
  }

  public validateRequestContext(context: WorkspaceRequestContext): boolean {
    if (this.generation !== context.generation) return false;
    if (!this.currentWorkspace || this.currentWorkspace.id !== context.workspaceId) return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // 4. Resource Boundary & Path Containment
  // ---------------------------------------------------------------------------

  public containsResource(resourceUri: string): boolean {
    if (!this.currentWorkspace || this.currentWorkspace.roots.length === 0) {
      return false;
    }
    return this.currentWorkspace.roots.some(
      (r) => r.isAccessible && isResourceInRoot(r.uri, resourceUri)
    );
  }

  public getRootForResource(resourceUri: string): WorkspaceRoot | undefined {
    if (!this.currentWorkspace) return undefined;
    return findRootForResource(this.currentWorkspace.roots, resourceUri);
  }

  public resolveResourcePath(relativePath: string, rootId?: string): string {
    if (!this.currentWorkspace || this.currentWorkspace.roots.length === 0) {
      throw new WorkspaceNotOpenError('Resolving resource path');
    }

    let targetRoot: WorkspaceRoot | undefined;
    if (rootId) {
      targetRoot = this.currentWorkspace.roots.find((r) => r.rootId === rootId);
      if (!targetRoot) {
        throw new InvalidWorkspaceRootError(rootId, 'Specified rootId not found in active workspace');
      }
    } else {
      targetRoot = this.currentWorkspace.roots[0];
    }

    return resolveRelativeResource(targetRoot.uri, relativePath);
  }

  public getRelativePath(resourceUri: string): string | null {
    const root = this.getRootForResource(resourceUri);
    if (!root) return null;
    return getRelativeResourcePath(root.uri, resourceUri);
  }

  // ---------------------------------------------------------------------------
  // 5. Workspace Lifecycle: Open, Switch, Close
  // ---------------------------------------------------------------------------

  /**
   * Opens a new workspace. Serialized via transition lock.
   */
  public async open(
    rootUri: string,
    options: WorkspaceOpenOptions = {}
  ): Promise<WorkspaceModel> {
    if (this.isTransitioning) {
      throw new WorkspaceTransitionLockedError(this.getState(), `open("${rootUri}")`);
    }

    this.isTransitioning = true;
    try {
      // Unsaved document check if currently open
      if (this.isOpen() && !options.force) {
        const dirty = await this.hasUnsavedChanges();
        if (dirty) {
          throw new WorkspaceUnsavedChangesError();
        }
      }

      // Root validation
      const normUri = normalizeWorkspacePath(rootUri);
      if (!normUri) {
        throw new InvalidWorkspaceRootError(rootUri, 'Path is empty or invalid');
      }

      const derivedName = options.name || this.deriveDisplayName(normUri);
      const rootId = `root-${normUri.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;

      const newRoot: WorkspaceRoot = {
        rootId,
        uri: normUri,
        name: derivedName,
        handle: options.handle,
        isAccessible: true,
      };

      const newGeneration = ++this.generation;
      const wsId = `ws-${normUri.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;

      // Emit opening event
      await this.emit('workspace.opening', { uri: normUri, generation: newGeneration });

      const newWorkspace: WorkspaceModel = {
        id: wsId,
        name: derivedName,
        roots: [newRoot],
        configuration: options.configuration || {},
        generation: newGeneration,
        state: 'ready',
        capabilities: {
          filesystemAvailable: true,
          configurationAvailable: true,
          sourceControlAvailable: true,
          tasksAvailable: true,
          searchAvailable: true,
        },
        projectMetadata: options.projectMetadata || {},
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      };

      this.currentWorkspace = newWorkspace;
      logger.info('WorkspaceEngine: workspace opened successfully', {
        id: wsId,
        name: derivedName,
        uri: normUri,
        generation: newGeneration,
      });

      await this.emit('workspace.opened', {
        workspaceId: wsId,
        name: derivedName,
        roots: [newRoot],
        generation: newGeneration,
      });

      return this.getSnapshot()!;
    } catch (err) {
      const msg = (err as Error).message || String(err);
      logger.error('WorkspaceEngine: failed to open workspace', { rootUri, error: msg });
      await this.emit('workspace.failed', {
        workspaceId: this.currentWorkspace?.id,
        error: msg,
        generation: this.generation,
      });
      throw err;
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Switches to a different workspace atomically.
   * If validation fails, old workspace state remains intact.
   */
  public async switch(
    newUri: string,
    options: WorkspaceOpenOptions = {}
  ): Promise<WorkspaceModel> {
    if (this.isTransitioning) {
      throw new WorkspaceTransitionLockedError(this.getState(), `switch("${newUri}")`);
    }

    const previousSnapshot = this.currentWorkspace ? this.getSnapshot() : null;
    const fromId = previousSnapshot ? previousSnapshot.id : 'none';

    this.isTransitioning = true;
    try {
      if (!options.force) {
        const dirty = await this.hasUnsavedChanges();
        if (dirty) {
          throw new WorkspaceUnsavedChangesError();
        }
      }

      // Validate new root
      const normUri = normalizeWorkspacePath(newUri);
      if (!normUri) {
        throw new InvalidWorkspaceRootError(newUri, 'Path is empty or invalid');
      }

      await this.emit('workspace.changeRequested', {
        fromWorkspaceId: fromId,
        toUri: normUri,
        generation: this.generation,
      });

      const derivedName = options.name || this.deriveDisplayName(normUri);
      const toId = `ws-${normUri.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;

      // Invalidate current generation for asynchronous tasks
      const newGeneration = ++this.generation;

      if (this.currentWorkspace) {
        this.currentWorkspace.state = 'changing';
      }

      await this.emit('workspace.changing', {
        fromWorkspaceId: fromId,
        toWorkspaceId: toId,
        generation: newGeneration,
      });

      const newRoot: WorkspaceRoot = {
        rootId: `root-${normUri.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`,
        uri: normUri,
        name: derivedName,
        handle: options.handle,
        isAccessible: true,
      };

      const newWorkspace: WorkspaceModel = {
        id: toId,
        name: derivedName,
        roots: [newRoot],
        configuration: options.configuration || {},
        generation: newGeneration,
        state: 'ready',
        capabilities: {
          filesystemAvailable: true,
          configurationAvailable: true,
          sourceControlAvailable: true,
          tasksAvailable: true,
          searchAvailable: true,
        },
        projectMetadata: options.projectMetadata || {},
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      };

      this.currentWorkspace = newWorkspace;
      logger.info('WorkspaceEngine: switched workspace successfully', {
        fromId,
        toId,
        generation: newGeneration,
      });

      await this.emit('workspace.changed', {
        workspaceId: toId,
        previousWorkspaceId: fromId !== 'none' ? fromId : undefined,
        generation: newGeneration,
      });

      await this.emit('workspace.opened', {
        workspaceId: toId,
        name: derivedName,
        roots: [newRoot],
        generation: newGeneration,
      });

      return this.getSnapshot()!;
    } catch (err) {
      // Switch preparation failed: restore previous workspace state safely
      if (previousSnapshot) {
        this.currentWorkspace = previousSnapshot;
        this.currentWorkspace.state = previousSnapshot.state;
      }
      const msg = (err as Error).message || String(err);
      logger.error('WorkspaceEngine: switch failed, restored prior workspace', { error: msg });
      throw err;
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Closes the active workspace.
   */
  public async close(options: { force?: boolean } = {}): Promise<void> {
    if (this.isTransitioning) {
      throw new WorkspaceTransitionLockedError(this.getState(), 'close()');
    }

    if (!this.currentWorkspace) {
      return;
    }

    this.isTransitioning = true;
    try {
      if (!options.force) {
        const dirty = await this.hasUnsavedChanges();
        if (dirty) {
          throw new WorkspaceUnsavedChangesError();
        }
      }

      const oldId = this.currentWorkspace.id;
      const newGeneration = ++this.generation;

      await this.emit('workspace.closeRequested', {
        workspaceId: oldId,
        generation: newGeneration,
      });

      this.currentWorkspace.state = 'closing';
      await this.emit('workspace.closing', {
        workspaceId: oldId,
        generation: newGeneration,
      });

      this.currentWorkspace.state = 'closed';
      this.currentWorkspace = null;

      logger.info('WorkspaceEngine: workspace closed', { oldId, generation: newGeneration });

      await this.emit('workspace.closed', {
        previousWorkspaceId: oldId,
        generation: newGeneration,
      });
    } finally {
      this.isTransitioning = false;
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Degraded Mode & Root Accessibility
  // ---------------------------------------------------------------------------

  public markDegraded(reason: string, rootId?: string): void {
    if (!this.currentWorkspace) return;

    if (rootId) {
      const root = this.currentWorkspace.roots.find((r) => r.rootId === rootId);
      if (root) {
        root.isAccessible = false;
      }
    }

    this.currentWorkspace.state = 'degraded';
    logger.warn('WorkspaceEngine: workspace marked degraded', { reason, workspaceId: this.currentWorkspace.id });
    this.emit('workspace.degraded', {
      workspaceId: this.currentWorkspace.id,
      reason,
      generation: this.generation,
    }).catch(() => {});
  }

  public markRecovered(rootId?: string): void {
    if (!this.currentWorkspace) return;

    if (rootId) {
      const root = this.currentWorkspace.roots.find((r) => r.rootId === rootId);
      if (root) {
        root.isAccessible = true;
      }
    }

    const allAccessible = this.currentWorkspace.roots.every((r) => r.isAccessible);
    if (allAccessible && this.currentWorkspace.state === 'degraded') {
      this.currentWorkspace.state = 'ready';
      logger.info('WorkspaceEngine: workspace restored to ready status', { workspaceId: this.currentWorkspace.id });
    }
  }

  // ---------------------------------------------------------------------------
  // 7. Event Subscriptions
  // ---------------------------------------------------------------------------

  public on<K extends WorkspaceEventKey>(
    event: K,
    listener: WorkspaceEventListener<K>
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as WorkspaceEventListener<any>);

    return () => {
      this.listeners.get(event)?.delete(listener as WorkspaceEventListener<any>);
    };
  }

  private async emit<K extends WorkspaceEventKey>(
    event: K,
    payload: WorkspaceEventMap[K]
  ): Promise<void> {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;

    for (const listener of handlers) {
      try {
        await listener(payload);
      } catch (err) {
        logger.error(`WorkspaceEngine: error in event subscriber for "${event}"`, {
          error: (err as Error).message,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Persistence & Serialization
  // ---------------------------------------------------------------------------

  public getPersistedState(): PersistedWorkspaceState | null {
    if (!this.currentWorkspace) return null;
    return {
      id: this.currentWorkspace.id,
      name: this.currentWorkspace.name,
      roots: this.currentWorkspace.roots.map((r) => ({
        rootId: r.rootId,
        uri: r.uri,
        name: r.name,
      })),
      state: this.currentWorkspace.state,
      lastActiveAt: this.currentWorkspace.lastActiveAt,
    };
  }

  public async restore(state: PersistedWorkspaceState): Promise<WorkspaceModel | null> {
    if (!state || !state.roots || state.roots.length === 0) {
      return null;
    }

    const primaryRoot = state.roots[0];
    return this.open(primaryRoot.uri, {
      name: state.name || primaryRoot.name,
      force: true,
    });
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  private deriveDisplayName(normalizedUri: string): string {
    const clean = normalizedUri.replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
    const parts = clean.split('/').filter(Boolean);
    if (parts.length === 0) return 'Workspace';
    return parts[parts.length - 1];
  }
}

/**
 * Global singleton WorkspaceEngine instance
 */
export const globalWorkspaceEngine = new WorkspaceEngine();
