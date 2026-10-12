import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceRegistry } from './ServiceRegistry';
import { DuplicateServiceError, ServiceNotFoundError } from './RuntimeErrors';

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();
  });

  it('registers a service and retrieves it by ID', () => {
    const fakeService = { ping: () => 'pong' };
    registry.registerService({
      id: 'test-service',
      name: 'Test Service',
      instance: fakeService,
      criticality: 'critical',
      scope: 'application',
    });

    expect(registry.hasService('test-service')).toBe(true);
    const resolved = registry.getService<typeof fakeService>('test-service');
    expect(resolved.ping()).toBe('pong');
  });

  it('rejects duplicate service registrations with DuplicateServiceError', () => {
    registry.registerService({
      id: 'dup',
      name: 'Duplicate 1',
    });

    expect(() => {
      registry.registerService({
        id: 'dup',
        name: 'Duplicate 2',
      });
    }).toThrowError(DuplicateServiceError);
  });

  it('throws ServiceNotFoundError when looking up an unregistered service', () => {
    expect(() => {
      registry.getService('missing');
    }).toThrowError(ServiceNotFoundError);
  });

  it('safely returns undefined for tryGetService on missing service', () => {
    expect(registry.tryGetService('non-existent')).toBeUndefined();
  });

  it('filters services by scope and criticality', () => {
    registry.registerService({ id: 'app-crit', name: 'A', scope: 'application', criticality: 'critical' });
    registry.registerService({ id: 'app-opt', name: 'B', scope: 'application', criticality: 'optional' });
    registry.registerService({ id: 'ws-opt', name: 'C', scope: 'workspace', criticality: 'optional' });

    expect(registry.getServicesByScope('workspace').map((s) => s.id)).toEqual(['ws-opt']);
    expect(registry.getServicesByCriticality('optional').map((s) => s.id)).toEqual(['app-opt', 'ws-opt']);
  });
});
