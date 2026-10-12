import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceEngine } from './WorkspaceEngine';
import { WorkspaceTestContainer } from './WorkspaceTestContainer';
import {
  InvalidWorkspaceRootError,
  WorkspaceUnsavedChangesError,
  WorkspaceNotOpenError,
} from './WorkspaceErrors';

describe('WorkspaceEngine Unit Tests', () => {
  let engine: WorkspaceEngine;
  let container: WorkspaceTestContainer;

  beforeEach(() => {
    container = new WorkspaceTestContainer(1);
    engine = container.engine;
  });

  describe('Identity & Initialization', () => {
    it('initializes in "none" state with no active workspace', () => {
      expect(engine.getState()).toBe('none');
      expect(engine.isOpen()).toBe(false);
      expect(engine.getWorkspaceId()).toBeNull();
      expect(engine.getRoots()).toHaveLength(0);
      expect(engine.getGeneration()).toBe(1);
    });

    it('generates stable workspace ID upon opening', async () => {
      const ws = await engine.open('C:/Projects/QM-Editor');
      expect(ws.id).toBe('ws-c__projects_qm-editor');
      expect(ws.name).toBe('QM-Editor');
      expect(ws.generation).toBe(2);
      expect(engine.isOpen()).toBe(true);
      expect(engine.getState()).toBe('ready');
    });
  });

  describe('Lifecycle State Machine & Transitions', () => {
    it('executes open sequence and emits canonical events in order', async () => {
      await engine.open('browser-fs://my-app', { name: 'MyApp' });

      expect(engine.getState()).toBe('ready');
      const events = container.getEventNames();
      expect(events).toEqual(['workspace.opening', 'workspace.opened']);

      const openedEvents = container.getEventsByName('workspace.opened');
      expect(openedEvents[0].payload.name).toBe('MyApp');
      expect(openedEvents[0].payload.generation).toBe(2);
    });

    it('executes close sequence and invalidates generation', async () => {
      await engine.open('C:/Projects/App');
      container.clearRecordedEvents();

      const prevGen = engine.getGeneration();
      await engine.close();

      expect(engine.getState()).toBe('none');
      expect(engine.isOpen()).toBe(false);
      expect(engine.getGeneration()).toBe(prevGen + 1);

      const events = container.getEventNames();
      expect(events).toEqual(['workspace.closeRequested', 'workspace.closing', 'workspace.closed']);
    });

    it('executes atomic switch sequence', async () => {
      await engine.open('C:/Projects/AppA', { name: 'AppA' });
      container.clearRecordedEvents();

      const switched = await engine.switch('C:/Projects/AppB', { name: 'AppB' });
      expect(switched.name).toBe('AppB');
      expect(engine.getWorkspaceName()).toBe('AppB');

      const events = container.getEventNames();
      expect(events).toContain('workspace.changeRequested');
      expect(events).toContain('workspace.changing');
      expect(events).toContain('workspace.changed');
      expect(events).toContain('workspace.opened');
    });

    it('preserves old workspace if switch preparation fails', async () => {
      await engine.open('C:/Projects/AppA', { name: 'AppA' });
      const originalWs = engine.getSnapshot();

      await expect(engine.switch('')).rejects.toThrow(InvalidWorkspaceRootError);

      // Old workspace must remain intact and ready!
      expect(engine.getState()).toBe('ready');
      expect(engine.getWorkspaceName()).toBe('AppA');
      expect(engine.getWorkspaceId()).toBe(originalWs?.id);
    });
  });

  describe('Unsaved Document Protection', () => {
    it('blocks workspace switch when dirty documents exist without force', async () => {
      await engine.open('C:/Projects/App');
      container.setHasDirtyDocuments(true);

      await expect(engine.switch('C:/Projects/OtherApp')).rejects.toThrow(
        WorkspaceUnsavedChangesError
      );

      expect(engine.getWorkspaceName()).toBe('App');
    });

    it('allows workspace switch when forced even if dirty documents exist', async () => {
      await engine.open('C:/Projects/App');
      container.setHasDirtyDocuments(true);

      const switched = await engine.switch('C:/Projects/OtherApp', { force: true });
      expect(switched.name).toBe('OtherApp');
      expect(engine.getWorkspaceName()).toBe('OtherApp');
    });

    it('blocks workspace close when dirty documents exist without force', async () => {
      await engine.open('C:/Projects/App');
      container.setHasDirtyDocuments(true);

      await expect(engine.close()).rejects.toThrow(WorkspaceUnsavedChangesError);
      expect(engine.isOpen()).toBe(true);
    });
  });

  describe('Async Stale Result & Generation Safety', () => {
    it('increments generation counter on each workspace change', async () => {
      expect(engine.getGeneration()).toBe(1);
      await engine.open('C:/Projects/One');
      expect(engine.getGeneration()).toBe(2);
      await engine.switch('C:/Projects/Two');
      expect(engine.getGeneration()).toBe(3);
      await engine.close();
      expect(engine.getGeneration()).toBe(4);
    });

    it('validates request context and rejects stale async tokens', async () => {
      await engine.open('C:/Projects/ProjectA');
      const asyncContext = engine.createRequestContext();

      expect(engine.validateRequestContext(asyncContext)).toBe(true);

      // Switch workspace in the background
      await engine.switch('C:/Projects/ProjectB');

      // The old async context is now stale and must be rejected!
      expect(engine.validateRequestContext(asyncContext)).toBe(false);
      expect(engine.isGenerationValid(asyncContext.generation)).toBe(false);
    });
  });

  describe('Degraded Mode & Capabilities', () => {
    it('transitions to degraded state when root becomes inaccessible', async () => {
      await engine.open('C:/Projects/DriveD');
      const root = engine.getPrimaryRoot()!;

      engine.markDegraded('Drive disconnected', root.rootId);
      expect(engine.getState()).toBe('degraded');
      expect(engine.getPrimaryRoot()?.isAccessible).toBe(false);

      // Workspace remains open in degraded mode
      expect(engine.isOpen()).toBe(true);

      // Recovers
      engine.markRecovered(root.rootId);
      expect(engine.getState()).toBe('ready');
      expect(engine.getPrimaryRoot()?.isAccessible).toBe(true);
    });
  });

  describe('Resource Membership & Traversal via Engine', () => {
    it('checks resource containment through engine query API', async () => {
      await engine.open('C:/Projects/MyApp');

      expect(engine.containsResource('C:/Projects/MyApp/src/index.ts')).toBe(true);
      expect(engine.containsResource('C:/Projects/MyApp-Other/test.ts')).toBe(false);
      expect(engine.containsResource('C:/Windows/System32/calc.exe')).toBe(false);
    });

    it('resolves relative path safely or throws if not open', async () => {
      expect(() => engine.resolveResourcePath('src/file.ts')).toThrow(WorkspaceNotOpenError);

      await engine.open('C:/Projects/MyApp');
      expect(engine.resolveResourcePath('src/file.ts')).toBe('C:/Projects/MyApp/src/file.ts');
    });
  });

  describe('Persistence & Restoration', () => {
    it('exports persisted state and restores workspace accurately', async () => {
      await engine.open('C:/Projects/RestorableApp', { name: 'RestorableApp' });
      const persisted = engine.getPersistedState();
      expect(persisted).not.toBeNull();
      expect(persisted?.name).toBe('RestorableApp');

      await engine.close();
      expect(engine.isOpen()).toBe(false);

      const restored = await engine.restore(persisted!);
      expect(restored).not.toBeNull();
      expect(restored?.name).toBe('RestorableApp');
      expect(engine.isOpen()).toBe(true);
    });
  });
});
