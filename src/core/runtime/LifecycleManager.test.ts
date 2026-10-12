import { describe, it, expect, beforeEach } from 'vitest';
import { LifecycleManager } from './LifecycleManager';
import { ServiceRegistry } from './ServiceRegistry';
import { RuntimeEvents } from './RuntimeEvents';
import { RuntimeHealth } from './RuntimeHealth';
import { ServiceInitializationContext } from './RuntimeTypes';
import { InvalidLifecycleTransitionError, ServiceInitializationError, StartupCancelledError } from './RuntimeErrors';
import { logger } from '../../utils/logger';

describe('LifecycleManager', () => {
  let registry: ServiceRegistry;
  let events: RuntimeEvents;
  let health: RuntimeHealth;
  let manager: LifecycleManager;

  const createContext = (signal?: AbortSignal): ServiceInitializationContext => ({
    getService: (id: string) => registry.getService(id),
    tryGetService: (id: string) => registry.tryGetService(id),
    workspaceGeneration: 1,
    workspaceId: 'default',
    workspaceUri: null,
    signal,
    logger,
  });

  beforeEach(() => {
    registry = new ServiceRegistry();
    events = new RuntimeEvents();
    health = new RuntimeHealth(registry);
    manager = new LifecycleManager(registry, events, health);
  });

  it('manages valid lifecycle transitions and rejects invalid ones', () => {
    expect(manager.getState()).toBe('created');
    manager.setState('initializing');
    expect(manager.getState()).toBe('initializing');
    manager.setState('ready');
    expect(manager.getState()).toBe('ready');

    expect(() => manager.setState('created')).toThrowError(InvalidLifecycleTransitionError);
  });

  it('initializes services in topological order and transitions to ready', async () => {
    const initOrder: string[] = [];

    registry.registerService({
      id: 'db',
      name: 'Database',
      criticality: 'critical',
      dependencies: [],
      initialize: () => {
        initOrder.push('db');
      },
    });

    registry.registerService({
      id: 'auth',
      name: 'Auth',
      criticality: 'critical',
      dependencies: ['db'],
      initialize: () => {
        initOrder.push('auth');
      },
    });

    await manager.start(() => createContext());

    expect(initOrder).toEqual(['db', 'auth']);
    expect(manager.getState()).toBe('ready');
    expect(registry.getRecord('db')?.lifecycleState).toBe('ready');
    expect(registry.getRecord('auth')?.lifecycleState).toBe('ready');
  });

  it('isolates optional service failure, transitions to degraded, and continues startup', async () => {
    const initOrder: string[] = [];

    registry.registerService({
      id: 'core',
      name: 'Core Service',
      criticality: 'critical',
      dependencies: [],
      initialize: () => {
        initOrder.push('core');
      },
    });

    registry.registerService({
      id: 'opt',
      name: 'Optional Subsystem',
      criticality: 'optional',
      dependencies: ['core'],
      initialize: () => {
        initOrder.push('opt');
        throw new Error('Optional subsystem failed to initialize');
      },
    });

    registry.registerService({
      id: 'ui',
      name: 'UI Service',
      criticality: 'critical',
      dependencies: ['core'],
      initialize: () => {
        initOrder.push('ui');
      },
    });

    await manager.start(() => createContext());

    expect(manager.getState()).toBe('degraded');
    expect(initOrder).toEqual(['core', 'opt', 'ui']);
    expect(registry.getRecord('core')?.lifecycleState).toBe('ready');
    expect(registry.getRecord('opt')?.lifecycleState).toBe('failed');
    expect(registry.getRecord('ui')?.lifecycleState).toBe('ready');
  });

  it('aborts and rolls back initialized services if a critical service fails', async () => {
    const disposed: string[] = [];

    registry.registerService({
      id: 'srv1',
      name: 'Service 1',
      criticality: 'critical',
      dependencies: [],
      instance: { id: 1 },
      initialize: () => {},
      dispose: () => {
        disposed.push('srv1');
      },
    });

    registry.registerService({
      id: 'srv2',
      name: 'Service 2',
      criticality: 'critical',
      dependencies: ['srv1'],
      instance: { id: 2 },
      initialize: () => {},
      dispose: () => {
        disposed.push('srv2');
      },
    });

    registry.registerService({
      id: 'crit-fail',
      name: 'Critical Failing Service',
      criticality: 'critical',
      dependencies: ['srv2'],
      initialize: () => {
        throw new Error('Fatal database connection error');
      },
    });

    await expect(manager.start(() => createContext())).rejects.toThrowError(
      ServiceInitializationError
    );

    expect(manager.getState()).toBe('terminated');
    // Rollback is in reverse order: srv2 first, then srv1
    expect(disposed).toEqual(['srv2', 'srv1']);
  });

  it('aborts and rolls back if cancellation signal is triggered during startup', async () => {
    const disposed: string[] = [];
    const controller = new AbortController();

    registry.registerService({
      id: 's1',
      name: 'Service 1',
      criticality: 'critical',
      instance: {},
      dispose: () => {
        disposed.push('s1');
      },
      initialize: () => {
        controller.abort(); // Cancel startup mid-way
      },
    });

    registry.registerService({
      id: 's2',
      name: 'Service 2',
      criticality: 'critical',
      dependencies: ['s1'],
      initialize: () => {},
    });

    await expect(manager.start(() => createContext(controller.signal))).rejects.toThrowError(
      StartupCancelledError
    );

    expect(manager.getState()).toBe('terminated');
    expect(disposed).toEqual(['s1']);
  });
});
