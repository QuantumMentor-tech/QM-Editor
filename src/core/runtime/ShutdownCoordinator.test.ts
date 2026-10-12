import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShutdownCoordinator } from './ShutdownCoordinator';
import { ServiceRegistry } from './ServiceRegistry';
import { RuntimeEvents } from './RuntimeEvents';

describe('ShutdownCoordinator', () => {
  let registry: ServiceRegistry;
  let events: RuntimeEvents;
  let coordinator: ShutdownCoordinator;

  beforeEach(() => {
    registry = new ServiceRegistry();
    events = new RuntimeEvents();
    coordinator = new ShutdownCoordinator(registry, events);
  });

  it('disposes services in reverse topological dependency order', async () => {
    const disposeOrder: string[] = [];

    // Dependency chain: A -> B -> C (startup: A, B, C; shutdown: C, B, A)
    registry.registerService({
      id: 'A',
      name: 'Service A',
      dependencies: [],
      instance: {},
      dispose: () => {
        disposeOrder.push('A');
      },
    });

    registry.registerService({
      id: 'B',
      name: 'Service B',
      dependencies: ['A'],
      instance: {},
      dispose: () => {
        disposeOrder.push('B');
      },
    });

    registry.registerService({
      id: 'C',
      name: 'Service C',
      dependencies: ['B'],
      instance: {},
      dispose: () => {
        disposeOrder.push('C');
      },
    });

    // Mark them ready
    registry.updateServiceState('A', 'ready');
    registry.updateServiceState('B', 'ready');
    registry.updateServiceState('C', 'ready');

    await coordinator.shutdown({ timeoutMs: 1000 });

    expect(disposeOrder).toEqual(['C', 'B', 'A']);
    expect(coordinator.isShutdownComplete).toBe(true);
  });

  it('is idempotent and does not re-run when called multiple times', async () => {
    const disposeFn = vi.fn();

    registry.registerService({
      id: 'test',
      name: 'Test',
      instance: {},
      dispose: disposeFn,
    });
    registry.updateServiceState('test', 'ready');

    await coordinator.shutdown({ timeoutMs: 1000 });
    await coordinator.shutdown({ timeoutMs: 1000 });

    expect(disposeFn).toHaveBeenCalledTimes(1);
  });

  it('forces cleanup when a hanging service exceeds safe shutdown timeout', async () => {
    registry.registerService({
      id: 'hanging',
      name: 'Hanging Service',
      instance: {},
      dispose: async () => {
        // Sleep longer than timeout
        await new Promise((r) => setTimeout(r, 200));
      },
    });
    registry.updateServiceState('hanging', 'ready');

    await coordinator.shutdown({ timeoutMs: 50 });

    expect(coordinator.isShutdownComplete).toBe(true);
    expect(registry.getRecord('hanging')?.lifecycleState).toBe('disposed');
  });
});
