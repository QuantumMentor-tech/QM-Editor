/**
 * QM Editor Centralized Shutdown Coordinator
 * Phase 04, Step 29 — Core Application Runtime, Service Lifecycle & Dependency Orchestration
 */

import { ServiceRegistry } from './ServiceRegistry';
import { RuntimeEvents } from './RuntimeEvents';
import { DependencyResolver } from './DependencyResolver';
import { logger } from '../../utils/logger';

export interface ShutdownOptions {
  timeoutMs?: number;
  reason?: string;
  force?: boolean;
}

export class ShutdownCoordinator {
  private isShuttingDown = false;
  private isTerminated = false;

  constructor(
    private registry: ServiceRegistry,
    private events: RuntimeEvents
  ) {}

  public get isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  public get isShutdownComplete(): boolean {
    return this.isTerminated;
  }

  /**
   * Executes a controlled shutdown across all registered services in reverse dependency order.
   * Enforces safe timeouts to prevent hanging background operations.
   */
  public async shutdown(options: ShutdownOptions = {}): Promise<void> {
    if (this.isTerminated) {
      logger.info('Shutdown coordinator: application already terminated. No-op.');
      return;
    }

    if (this.isShuttingDown) {
      logger.warn('Shutdown coordinator: shutdown already in progress.');
      return;
    }

    this.isShuttingDown = true;
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? 5000;
    const reason = options.reason || 'Normal application exit';

    logger.info('Initiating application shutdown sequence', { reason, timeoutMs });
    this.events.emit('application.shutdownRequested', { timestamp: startTime, reason });

    // 1. Resolve reverse dependency order
    const servicesMap = this.registry.getServicesMap();
    let shutdownOrder: string[] = [];
    try {
      const resolution = DependencyResolver.resolve(servicesMap);
      shutdownOrder = resolution.shutdownOrder;
    } catch {
      // If graph is broken, shutdown all registered services in reverse insertion order
      shutdownOrder = Array.from(servicesMap.keys()).reverse();
    }

    // 2. Shut down individual services with timeout protection
    const hangingServices: string[] = [];

    const shutdownPromise = (async () => {
      for (const serviceId of shutdownOrder) {
        const record = this.registry.getRecord(serviceId);
        if (!record || record.lifecycleState === 'disposed') {
          continue;
        }

        try {
          this.registry.updateServiceState(serviceId, 'stopping');
          if (record.dispose) {
            await record.dispose(record.instance as any);
          }
          this.registry.updateServiceState(serviceId, 'disposed');
          this.events.emit('service.disposed', { serviceId });
        } catch (err) {
          logger.error(`Error disposing service "${serviceId}" during shutdown`, {
            error: (err as Error).message,
            serviceId,
          });
          this.registry.updateServiceState(serviceId, 'failed', { error: (err as Error).message });
        }
      }
    })();

    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), timeoutMs);
    });

    const result = await Promise.race([shutdownPromise, timeoutPromise]);
    if (result === 'timeout') {
      // Identify services that were not yet disposed
      for (const serviceId of shutdownOrder) {
        const rec = this.registry.getRecord(serviceId);
        if (rec && rec.lifecycleState !== 'disposed') {
          hangingServices.push(serviceId);
          this.registry.updateServiceState(serviceId, 'disposed');
        }
      }
      logger.warn('Application shutdown timed out; forced remaining services to disposed state', {
        hangingServices,
        timeoutMs,
      });
    }

    this.isShuttingDown = false;
    this.isTerminated = true;
    const durationMs = Date.now() - startTime;

    logger.info('Application shutdown completed', { durationMs, hangingServicesCount: hangingServices.length });
    this.events.emit('application.shutdown', { timestamp: Date.now(), durationMs });
  }

  /**
   * Resets coordinator state for testing.
   */
  public reset(): void {
    this.isShuttingDown = false;
    this.isTerminated = false;
  }
}
