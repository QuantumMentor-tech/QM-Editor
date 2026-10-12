/**
 * QM Editor Application Runtime
 * Phase 04, Step 29 — Core Application Runtime, Service Lifecycle & Dependency Orchestration
 */

import {
  ApplicationContextSnapshot,
  ApplicationLifecycleState,
  RuntimeHealthReport,
  ServiceDefinition,
  ServiceInitializationContext,
  ServiceRecord,
  Disposable,
  RuntimeEventKey,
  RuntimeEventListener,
} from './RuntimeTypes';
import { ServiceRegistry } from './ServiceRegistry';
import { RuntimeEvents } from './RuntimeEvents';
import { RuntimeHealth } from './RuntimeHealth';
import { LifecycleManager } from './LifecycleManager';
import { ShutdownCoordinator, ShutdownOptions } from './ShutdownCoordinator';
import { logger } from '../../utils/logger';

export interface ApplicationRuntimeOptions {
  applicationId?: string;
  sessionId?: string;
}

export class ApplicationRuntime {
  public readonly applicationId: string;
  public readonly sessionId: string;

  public readonly registry: ServiceRegistry;
  public readonly events: RuntimeEvents;
  public readonly health: RuntimeHealth;
  public readonly lifecycle: LifecycleManager;
  public readonly shutdownCoordinator: ShutdownCoordinator;

  private workspaceGeneration = 1;
  private activeWorkspaceId = 'default';
  private activeWorkspaceUri: string | null = null;

  constructor(options: ApplicationRuntimeOptions = {}) {
    this.applicationId = options.applicationId || 'qm-editor';
    this.sessionId =
      options.sessionId ||
      `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    this.registry = new ServiceRegistry();
    this.events = new RuntimeEvents();
    this.health = new RuntimeHealth(this.registry);
    this.lifecycle = new LifecycleManager(this.registry, this.events, this.health);
    this.shutdownCoordinator = new ShutdownCoordinator(this.registry, this.events);
  }

  // -------------------------------------------------------------
  // 1. Service Management
  // -------------------------------------------------------------

  public registerService<T = unknown>(definition: ServiceDefinition<T>): ServiceRecord<T> {
    const record = this.registry.registerService(definition);
    this.events.emit('service.registered', {
      serviceId: definition.id,
      criticality: record.criticality,
      scope: record.scope,
    });
    return record;
  }

  public getService<T = unknown>(serviceId: string): T {
    return this.registry.getService<T>(serviceId);
  }

  public tryGetService<T = unknown>(serviceId: string): T | undefined {
    return this.registry.tryGetService<T>(serviceId);
  }

  public hasService(serviceId: string): boolean {
    return this.registry.hasService(serviceId);
  }

  // -------------------------------------------------------------
  // 2. Lifecycle Orchestration
  // -------------------------------------------------------------

  public getState(): ApplicationLifecycleState {
    return this.lifecycle.getState();
  }

  public get isReady(): boolean {
    const s = this.lifecycle.getState();
    return s === 'ready' || s === 'degraded';
  }

  public async start(options: { signal?: AbortSignal } = {}): Promise<void> {
    const createContext = (): ServiceInitializationContext => ({
      getService: <S = unknown>(id: string) => this.registry.getService<S>(id),
      tryGetService: <S = unknown>(id: string) => this.registry.tryGetService<S>(id),
      workspaceGeneration: this.workspaceGeneration,
      workspaceId: this.activeWorkspaceId,
      workspaceUri: this.activeWorkspaceUri,
      signal: options.signal,
      logger,
    });

    await this.lifecycle.start(createContext);
  }

  public async shutdown(options: ShutdownOptions = {}): Promise<void> {
    this.lifecycle.setState('shuttingDown');
    await this.shutdownCoordinator.shutdown(options);
    this.lifecycle.setState('terminated');
  }

  /**
   * Safely restarts an individual service (e.g. for background recovery or reload).
   */
  public async restartService(serviceId: string): Promise<boolean> {
    const record = this.registry.getRecord(serviceId);
    if (!record) {
      logger.warn(`Cannot restart unregistered service "${serviceId}".`);
      return false;
    }

    logger.info(`Restarting service "${serviceId}"`, { serviceId });

    // 1. Dispose old instance if possible
    try {
      this.registry.updateServiceState(serviceId, 'stopping');
      if (record.dispose) {
        await record.dispose(record.instance as any);
      }
      this.registry.updateServiceState(serviceId, 'disposed');
      this.events.emit('service.disposed', { serviceId });
    } catch (err) {
      logger.error(`Error disposing service "${serviceId}" during restart`, {
        error: (err as Error).message,
      });
    }

    // 2. Reinitialize instance
    try {
      this.registry.updateServiceState(serviceId, 'initializing');
      this.events.emit('service.initializing', { serviceId });

      const context: ServiceInitializationContext = {
        getService: <S = unknown>(id: string) => this.registry.getService<S>(id),
        tryGetService: <S = unknown>(id: string) => this.registry.tryGetService<S>(id),
        workspaceGeneration: this.workspaceGeneration,
        workspaceId: this.activeWorkspaceId,
        workspaceUri: this.activeWorkspaceUri,
        logger,
      };

      if (record.factory) {
        record.instance = await record.factory(context);
      }
      if (record.initialize) {
        await record.initialize(record.instance as any, context);
      }

      this.registry.updateServiceState(serviceId, 'ready');
      this.events.emit('service.ready', { serviceId, durationMs: 0 });
      logger.info(`Service "${serviceId}" restarted successfully`);
      return true;
    } catch (err) {
      const errorMsg = (err as Error).message || String(err);
      this.registry.updateServiceState(serviceId, 'failed', { error: errorMsg });
      this.events.emit('service.failed', {
        serviceId,
        error: errorMsg,
        criticality: record.criticality,
      });
      return false;
    }
  }

  // -------------------------------------------------------------
  // 3. Workspace Lifecycle & Generation Protection
  // -------------------------------------------------------------

  public get currentWorkspaceGeneration(): number {
    return this.workspaceGeneration;
  }

  public get currentWorkspaceUri(): string | null {
    return this.activeWorkspaceUri;
  }

  public get currentWorkspaceId(): string {
    return this.activeWorkspaceId;
  }

  public isCurrentGeneration(generation: number): boolean {
    return this.workspaceGeneration === generation;
  }

  /**
   * Opens or switches workspace context. Increments workspace generation token and
   * invokes reset/reinitialization hooks on workspace-scoped services.
   */
  public async openWorkspace(uri: string, name: string = 'Workspace'): Promise<number> {
    const newGeneration = ++this.workspaceGeneration;
    this.activeWorkspaceUri = uri;
    this.activeWorkspaceId = uri;

    logger.info('Runtime: opening workspace context', { uri, name, generation: newGeneration });
    this.events.emit('workspace.opening', { uri, generation: newGeneration });

    // Reset workspace-scoped services
    await this.resetWorkspaceScopedServices(newGeneration);

    this.events.emit('workspace.opened', { uri, name, generation: newGeneration });
    return newGeneration;
  }

  /**
   * Closes active workspace. Increments workspace generation token and resets workspace services.
   */
  public async closeWorkspace(): Promise<number> {
    const newGeneration = ++this.workspaceGeneration;
    logger.info('Runtime: closing workspace context', { generation: newGeneration });
    this.events.emit('workspace.closing', { generation: newGeneration });

    this.activeWorkspaceUri = null;
    this.activeWorkspaceId = 'default';

    // Reset workspace-scoped services
    await this.resetWorkspaceScopedServices(newGeneration);

    this.events.emit('workspace.closed', { generation: newGeneration });
    return newGeneration;
  }

  private async resetWorkspaceScopedServices(generation: number): Promise<void> {
    const workspaceServices = this.registry.getServicesByScope('workspace');
    for (const record of workspaceServices) {
      if (record.reset) {
        try {
          await record.reset(record.instance as any, {
            getService: <S = unknown>(id: string) => this.registry.getService<S>(id),
            tryGetService: <S = unknown>(id: string) => this.registry.tryGetService<S>(id),
            workspaceGeneration: generation,
            workspaceId: this.activeWorkspaceId,
            workspaceUri: this.activeWorkspaceUri,
            logger,
          });
        } catch (err) {
          logger.error(`Error resetting workspace service "${record.id}"`, {
            error: (err as Error).message,
            generation,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 4. Observability & Event Subscriptions
  // -------------------------------------------------------------

  public on<K extends RuntimeEventKey>(
    event: K,
    listener: RuntimeEventListener<K>
  ): Disposable {
    return this.events.on(event, listener);
  }

  public getHealthReport(): RuntimeHealthReport {
    return this.health.getHealthReport(this.lifecycle.getState());
  }

  public getContextSnapshot(): ApplicationContextSnapshot {
    return {
      applicationId: this.applicationId,
      sessionId: this.sessionId,
      lifecycleState: this.lifecycle.getState(),
      workspaceGeneration: this.workspaceGeneration,
      activeWorkspaceId: this.activeWorkspaceId,
      activeWorkspaceUri: this.activeWorkspaceUri,
      healthy: this.health.getHealthReport(this.lifecycle.getState()).overall === 'healthy',
    };
  }
}

/**
 * Global singleton runtime instance for the QM Editor desktop application.
 */
export const globalApplicationRuntime = new ApplicationRuntime();
