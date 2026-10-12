import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceEngine } from './WorkspaceEngine';
import { ApplicationRuntime } from '../runtime/ApplicationRuntime';
import { registerDefaultServices } from '../runtime/defaultServices';
import { workspaceSearchService } from '../../services/WorkspaceSearchService';
import { workspaceIndexService } from '../../services/WorkspaceIndexService';
import { sourceControlService } from '../source-control/SourceControlService';
import { SettingsService } from '../settings/SettingsService';

describe('Workspace Subsystem Integration Tests', () => {
  let runtime: ApplicationRuntime;
  let engine: WorkspaceEngine;

  beforeEach(async () => {
    runtime = new ApplicationRuntime();
    registerDefaultServices(runtime);
    await runtime.start();
    engine = runtime.getService<WorkspaceEngine>('workspaceEngine');
  });

  it('provides authoritative workspaceEngine service within ApplicationRuntime', () => {
    expect(engine).toBeDefined();
    expect(engine.getState()).toBe('none');
    expect(runtime.hasService('workspaceEngine')).toBe(true);
  });

  it('keeps runtime generation and engine generation coordinated', async () => {
    const ws = await engine.open('C:/Workspace/MainProject', { name: 'MainProject' });
    expect(ws.name).toBe('MainProject');

    // Context created for asynchronous operation
    const requestCtx = engine.createRequestContext();
    expect(requestCtx.workspaceId).toBe(ws.id);
    expect(requestCtx.generation).toBe(ws.generation);

    // Workspace search & index services reject stale tokens if generation changes
    const originalGen = engine.getGeneration();
    expect(engine.isGenerationValid(originalGen)).toBe(true);

    // Switch workspace
    await engine.switch('C:/Workspace/SecondaryProject', { name: 'SecondaryProject' });

    // Stale generation is now invalid
    expect(engine.isGenerationValid(originalGen)).toBe(false);
    expect(engine.validateRequestContext(requestCtx)).toBe(false);
  });

  it('allows services (Search, Git, Index) to consume authoritative root and boundaries', async () => {
    await engine.open('C:/Workspace/MyGitProject', { name: 'MyGitProject' });

    const primaryRoot = engine.getPrimaryRoot();
    expect(primaryRoot).toBeDefined();
    expect(primaryRoot?.uri).toBe('C:/Workspace/MyGitProject');

    // Source control can inspect authoritative root
    expect(primaryRoot?.isAccessible).toBe(true);
    expect(sourceControlService).toBeDefined();

    // Membership boundary check: only files inside are authorized
    expect(engine.containsResource('C:/Workspace/MyGitProject/src/main.ts')).toBe(true);
    expect(engine.containsResource('C:/Workspace/MyGitProject-Fake/evil.ts')).toBe(false);

    // Settings service workspace scope can bind to authoritative ID
    const settings = runtime.getService<SettingsService>('settings');
    expect(settings).toBeDefined();
    const activeWsId = engine.getWorkspaceId();
    expect(activeWsId).toBeDefined();
  });

  it('cleans up and resets services cleanly on workspace close', async () => {
    await engine.open('C:/Workspace/CleanProject');
    expect(engine.isOpen()).toBe(true);

    // Simulate workspace index and search
    workspaceIndexService.clearIndex();
    workspaceSearchService.cancelSearch();

    await engine.close();
    expect(engine.isOpen()).toBe(false);
    expect(engine.getState()).toBe('none');
  });
});
