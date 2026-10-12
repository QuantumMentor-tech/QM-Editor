import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApplicationRuntime } from './ApplicationRuntime';
import { registerDefaultServices } from './defaultServices';

describe('ApplicationRuntime', () => {
  let runtime: ApplicationRuntime;

  beforeEach(() => {
    runtime = new ApplicationRuntime({ applicationId: 'test-app' });
  });

  it('initializes with default state and configuration', () => {
    expect(runtime.applicationId).toBe('test-app');
    expect(runtime.getState()).toBe('created');
    expect(runtime.currentWorkspaceGeneration).toBe(1);
    expect(runtime.currentWorkspaceUri).toBeNull();
  });

  it('starts successfully and reports healthy state', async () => {
    runtime.registerService({
      id: 'mock-config',
      name: 'Mock Config',
      criticality: 'critical',
      instance: { port: 8080 },
    });

    runtime.registerService({
      id: 'mock-db',
      name: 'Mock DB',
      criticality: 'critical',
      dependencies: ['mock-config'],
      instance: { connected: true },
    });

    await runtime.start();

    expect(runtime.getState()).toBe('ready');
    expect(runtime.isReady).toBe(true);

    const report = runtime.getHealthReport();
    expect(report.overall).toBe('healthy');
    expect(report.services['mock-config'].status).toBe('healthy');
    expect(report.services['mock-db'].status).toBe('healthy');
  });

  it('handles workspace open and close lifecycles with generation incrementation', async () => {
    const wsResetFn = vi.fn();

    runtime.registerService({
      id: 'ws-service',
      name: 'Workspace Scoped Service',
      scope: 'workspace',
      criticality: 'optional',
      instance: { active: true },
      reset: wsResetFn,
    });

    await runtime.start();

    const gen1 = runtime.currentWorkspaceGeneration;
    const gen2 = await runtime.openWorkspace('file:///project-alpha', 'Project Alpha');

    expect(gen2).toBe(gen1 + 1);
    expect(runtime.currentWorkspaceUri).toBe('file:///project-alpha');
    expect(runtime.isCurrentGeneration(gen2)).toBe(true);
    expect(runtime.isCurrentGeneration(gen1)).toBe(false);
    expect(wsResetFn).toHaveBeenCalledTimes(1);

    const gen3 = await runtime.closeWorkspace();
    expect(gen3).toBe(gen2 + 1);
    expect(runtime.currentWorkspaceUri).toBeNull();
    expect(wsResetFn).toHaveBeenCalledTimes(2);
  });

  it('restarts a service safely on demand', async () => {
    let callCount = 0;
    const disposeFn = vi.fn();

    runtime.registerService({
      id: 'restartable',
      name: 'Restartable Service',
      criticality: 'optional',
      factory: () => {
        callCount++;
        return { version: callCount };
      },
      dispose: disposeFn,
    });

    await runtime.start();
    expect(runtime.getService<{ version: number }>('restartable').version).toBe(1);

    const restarted = await runtime.restartService('restartable');
    expect(restarted).toBe(true);
    expect(disposeFn).toHaveBeenCalledTimes(1);
    expect(runtime.getService<{ version: number }>('restartable').version).toBe(2);
  });

  it('registers and resolves default application services', () => {
    registerDefaultServices(runtime);

    expect(runtime.hasService('settings')).toBe(true);
    expect(runtime.hasService('command')).toBe(true);
    expect(runtime.hasService('feedback')).toBe(true);
    expect(runtime.hasService('file')).toBe(true);
    expect(runtime.hasService('terminal')).toBe(true);
    expect(runtime.hasService('tasks')).toBe(true);
    expect(runtime.hasService('sourceControl')).toBe(true);
  });
});
