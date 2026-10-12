/**
 * QM Editor Lifecycle Manager
 * Phase 04, Step 29 — Core Application Runtime, Service Lifecycle & Dependency Orchestration
 */

import {
  ApplicationLifecycleState,
  ServiceInitializationContext,
} from './RuntimeTypes';
import {
  InvalidLifecycleTransitionError,
  ServiceInitializationError,
  StartupCancelledError,
} from './RuntimeErrors';
import { ServiceRegistry } from './ServiceRegistry';
import { RuntimeEvents } from './RuntimeEvents';
import { DependencyResolver } from './DependencyResolver';
import { RuntimeHealth } from './RuntimeHealth';
import { logger } from '../../utils/logger';

export class LifecycleManager {
  private state: ApplicationLifecycleState = 'created';
  private startupOrder: string[] = [];

  constructor(
    private registry: ServiceRegistry,
    private events: RuntimeEvents,
    private health: RuntimeHealth
  ) {}

  public getState(): ApplicationLifecycleState {
    return this.state;
  }

  public setState(target: ApplicationLifecycleState): void {
    if (!this.isValidTransition(this.state, target)) {
      throw new InvalidLifecycleTransitionError(this.state, target);
    }
    this.state = target;
  }

  /**
   * Validates legal application lifecycle state transitions.
   */
  private isValidTransition(
    current: ApplicationLifecycleState,
    target: ApplicationLifecycleState
  ): boolean {
    if (current === target) return true;

    switch (current) {
      case 'created':
        return target === 'initializing' || target === 'terminated';
      case 'initializing':
        return target === 'ready' || target === 'degraded' || target === 'terminated' || target === 'shuttingDown';
      case 'ready':
        return target === 'degraded' || target === 'shuttingDown' || target === 'terminated';
      case 'degraded':
        return target === 'ready' || target === 'shuttingDown' || target === 'terminated';
      case 'shuttingDown':
        return target === 'terminated';
      case 'terminated':
        // May reset to 'created' in test containers or app re-initialization
        return target === 'created';
      default:
        return false;
    }
  }

  /**
   * Executes deterministic multi-phase startup across all registered services.
   * Isolates optional service failures, and performs rollback if a critical service fails or cancellation is requested.
   */
  public async start(createContext: () => ServiceInitializationContext): Promise<void> {
    if (this.state !== 'created' && this.state !== 'terminated') {
      logger.warn(`Application cannot start from state "${this.state}".`);
      return;
    }

    this.setState('initializing');
    const startTime = Date.now();
    this.events.emit('application.started', { timestamp: startTime });

    // 1. Validate dependencies and obtain deterministic topological order
    const servicesMap = this.registry.getServicesMap();
    const resolution = DependencyResolver.assertValid(servicesMap);
    this.startupOrder = resolution.order;

    const initializedServices: string[] = [];
    let hasOptionalFailure = false;

    // 2. Initialize each service in topological dependency order
    for (const serviceId of this.startupOrder) {
      const context = createContext();

      // Check cancellation signal
      if (context.signal?.aborted) {
        logger.warn('Application startup aborted via cancellation signal');
        await this.rollbackInitialized(initializedServices);
        this.setState('terminated');
        throw new StartupCancelledError();
      }

      const record = this.registry.getRecord(serviceId);
      if (!record) continue;

      const serviceStartTime = Date.now();
      this.registry.updateServiceState(serviceId, 'initializing');
      this.events.emit('service.initializing', { serviceId });

      try {
        // Instantiate via factory if instance is not yet provided
        if (record.instance === undefined && record.factory) {
          record.instance = await record.factory(context);
        }

        // Run initialization hook if present
        if (record.initialize) {
          await record.initialize(record.instance as any, context);
        }

        const durationMs = Date.now() - serviceStartTime;
        this.registry.updateServiceState(serviceId, 'ready', { initDurationMs: durationMs });
        initializedServices.push(serviceId);
        this.events.emit('service.ready', { serviceId, durationMs });
      } catch (err) {
        const errorMsg = (err as Error).message || String(err);
        this.registry.updateServiceState(serviceId, 'failed', { error: errorMsg });
        this.events.emit('service.failed', {
          serviceId,
          error: errorMsg,
          criticality: record.criticality,
        });

        if (record.criticality === 'critical') {
          logger.error(`Critical service "${serviceId}" failed during startup. Aborting & rolling back.`, {
            error: errorMsg,
          });
          // Rollback all already-initialized services in reverse dependency order
          await this.rollbackInitialized(initializedServices);
          this.setState('terminated');
          throw new ServiceInitializationError(serviceId, 'critical', err);
        } else {
          // Optional service failure: isolate fault and proceed in degraded mode
          hasOptionalFailure = true;
          logger.warn(`Optional service "${serviceId}" failed during startup. Proceeding in degraded mode.`, {
            error: errorMsg,
          });
          this.health.addDegradedReason(`Optional service "${serviceId}" failed: ${errorMsg}`);
          this.events.emit('application.degraded', {
            timestamp: Date.now(),
            reason: errorMsg,
            serviceId,
          });
        }
      }
    }

    const totalStartupDurationMs = Date.now() - startTime;
    const finalState = hasOptionalFailure ? 'degraded' : 'ready';
    this.setState(finalState);

    const healthReport = this.health.getHealthReport(finalState);
    logger.info(`Application startup completed in ${totalStartupDurationMs}ms`, {
      state: finalState,
      overallHealth: healthReport.overall,
      serviceCount: this.startupOrder.length,
    });

    this.events.emit('application.ready', {
      timestamp: Date.now(),
      startupDurationMs: totalStartupDurationMs,
      health: healthReport.overall,
    });
  }

  /**
   * Rolls back initialized services in reverse order if startup fails or is cancelled.
   */
  private async rollbackInitialized(serviceIds: string[]): Promise<void> {
    const reverseOrder = [...serviceIds].reverse();
    logger.info('Rolling back initialized services', { services: reverseOrder });

    for (const serviceId of reverseOrder) {
      const record = this.registry.getRecord(serviceId);
      if (!record || record.lifecycleState !== 'ready') continue;

      try {
        this.registry.updateServiceState(serviceId, 'stopping');
        if (record.dispose) {
          await record.dispose(record.instance as any);
        }
        this.registry.updateServiceState(serviceId, 'disposed');
        this.events.emit('service.disposed', { serviceId });
      } catch (err) {
        logger.error(`Error rolling back service "${serviceId}"`, { error: (err as Error).message });
      }
    }
  }

  /**
   * Resets lifecycle manager state. Used in test containers.
   */
  public reset(): void {
    this.state = 'created';
    this.startupOrder = [];
  }
}
