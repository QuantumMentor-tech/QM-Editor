/**
 * QM Editor Central Service Registry
 * Phase 04, Step 29 — Core Application Runtime, Service Lifecycle & Dependency Orchestration
 */

import {
  ServiceDefinition,
  ServiceRecord,
  ServiceScope,
  ServiceCriticality,
  ServiceLifecycleState,
} from './RuntimeTypes';
import {
  DuplicateServiceError,
  ServiceNotFoundError,
} from './RuntimeErrors';

export class ServiceRegistry {
  private services: Map<string, ServiceRecord> = new Map();

  /**
   * Registers an application or workspace service definition.
   * Rejects duplicate registrations deterministically.
   */
  public registerService<T = unknown>(definition: ServiceDefinition<T>): ServiceRecord<T> {
    if (this.services.has(definition.id)) {
      throw new DuplicateServiceError(definition.id);
    }

    const record: ServiceRecord<T> = {
      id: definition.id,
      name: definition.name,
      dependencies: definition.dependencies ? [...definition.dependencies] : [],
      scope: definition.scope || 'application',
      criticality: definition.criticality || 'critical',
      lifecycleState: 'uninitialized',
      instance: definition.instance,
      factory: definition.factory,
      initialize: definition.initialize,
      dispose: definition.dispose,
      reset: definition.reset,
    };

    this.services.set(definition.id, record as ServiceRecord<unknown>);
    return record;
  }

  /**
   * Returns whether a service identifier is registered.
   */
  public hasService(id: string): boolean {
    return this.services.has(id);
  }

  /**
   * Looks up a registered service record.
   */
  public getRecord(id: string): ServiceRecord | undefined {
    return this.services.get(id);
  }

  /**
   * Returns all registered service records.
   */
  public getAllRecords(): ServiceRecord[] {
    return Array.from(this.services.values());
  }

  /**
   * Returns the underlying services map.
   */
  public getServicesMap(): Map<string, ServiceRecord> {
    return this.services;
  }

  /**
   * Resolves a service instance by ID.
   * Throws ServiceNotFoundError if the service is unregistered or has no instance.
   */
  public getService<T = unknown>(id: string): T {
    const record = this.services.get(id);
    if (!record) {
      throw new ServiceNotFoundError(id);
    }
    if (record.instance === undefined) {
      throw new Error(`Service "${id}" is registered but has not been instantiated or initialized yet.`);
    }
    return record.instance as T;
  }

  /**
   * Safely attempts to resolve a service instance without throwing if absent or uninstantiated.
   */
  public tryGetService<T = unknown>(id: string): T | undefined {
    const record = this.services.get(id);
    if (!record || record.instance === undefined) {
      return undefined;
    }
    return record.instance as T;
  }

  /**
   * Updates lifecycle state for a managed service record.
   */
  public updateServiceState(
    id: string,
    state: ServiceLifecycleState,
    meta?: { error?: string; initDurationMs?: number }
  ): void {
    const record = this.services.get(id);
    if (!record) return;

    record.lifecycleState = state;
    if (meta?.error !== undefined) record.error = meta.error;
    if (meta?.initDurationMs !== undefined) record.initDurationMs = meta.initDurationMs;
  }

  /**
   * Filters service records by scope.
   */
  public getServicesByScope(scope: ServiceScope): ServiceRecord[] {
    return Array.from(this.services.values()).filter((s) => s.scope === scope);
  }

  /**
   * Filters service records by criticality.
   */
  public getServicesByCriticality(criticality: ServiceCriticality): ServiceRecord[] {
    return Array.from(this.services.values()).filter((s) => s.criticality === criticality);
  }

  /**
   * Unregisters a service. Used primarily in test containers and isolated tear-down.
   */
  public unregisterService(id: string): boolean {
    return this.services.delete(id);
  }

  /**
   * Clears the entire registry.
   */
  public clear(): void {
    this.services.clear();
  }
}
