/**
 * QM Editor Workspace Persistence & Session Storage Test Suite
 * Phase 05, Step 47 — Persistent Workspace State, Metadata & Session Storage
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  WorkspacePersistenceCoordinator,
  WorkspaceEngine,
} from './index';
import {
  StorageService,
  MemoryStorageAdapter,
  WorkspaceStateRepository,
  SessionStateRepository,
  globalSchemaRegistry,
  globalMigrationRegistry,
} from '../storage';
import { DocumentEngine } from '../documents/DocumentEngine';
import { EditorCoordinationService } from '../editor/EditorCoordinationService';

describe('Workspace Persistence & Session Storage (Step 47)', () => {
  let memoryAdapter: MemoryStorageAdapter;
  let storageService: StorageService;
  let workspaceRepo: WorkspaceStateRepository;
  let sessionRepo: SessionStateRepository;
  let workspaceEngine: WorkspaceEngine;
  let documentEngine: DocumentEngine;
  let editorCoordination: EditorCoordinationService;
  let coordinator: WorkspacePersistenceCoordinator;

  beforeEach(async () => {
    memoryAdapter = new MemoryStorageAdapter();
    storageService = new StorageService({ adapter: memoryAdapter });
    await storageService.initialize();

    workspaceRepo = new WorkspaceStateRepository(storageService);
    sessionRepo = new SessionStateRepository(storageService);
    workspaceEngine = new WorkspaceEngine();
    documentEngine = new DocumentEngine();
    editorCoordination = new EditorCoordinationService();

    coordinator = new WorkspacePersistenceCoordinator({
      workspaceEngine,
      workspaceRepo,
      sessionRepo,
      documentEngine,
      editorCoordination,
      config: {
        autoSaveSession: true,
        debounceMs: 50,
        maxRecentWorkspaces: 5,
      },
    });

    coordinator.initialize();
  });

  afterEach(async () => {
    await coordinator.dispose();
    await storageService.dispose();
    documentEngine.dispose();
    editorCoordination.dispose();
    globalSchemaRegistry.reset();
    globalMigrationRegistry.reset();
  });

  // ---------------------------------------------------------------------------
  // 1. Workspace Identity & Metadata Persistence
  // ---------------------------------------------------------------------------
  describe('Workspace Metadata Persistence', () => {
    it('persists and retrieves workspace metadata on workspace open', async () => {
      const ws = await workspaceEngine.open('C:/projects/qm-editor', { name: 'QM Editor Project' });

      // Coordinator's event hook automatically saves metadata
      const stored = await coordinator.getWorkspaceMetadata(ws.id);
      expect(stored).not.toBeNull();
      expect(stored!.id).toBe(ws.id);
      expect(stored!.name).toBe('QM Editor Project');
      expect(stored!.roots.length).toBe(1);
      expect(stored!.roots[0].uri).toBe('C:/projects/qm-editor');
    });

    it('derives stable canonical workspace identity from normalized root URI', async () => {
      const ws1 = await workspaceEngine.open('C:/my-app');
      const id1 = ws1.id;
      await workspaceEngine.close({ force: true });

      const ws2 = await workspaceEngine.open('c:\\my-app\\');
      const id2 = ws2.id;

      // Both normalized paths map to the exact same canonical ID
      expect(id1).toBe(id2);
      expect(id1).toBe('ws-c__my-app');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Recent Workspaces Bounded Storage & Deduplication
  // ---------------------------------------------------------------------------
  describe('Recent Workspaces History', () => {
    it('deduplicates recent workspaces and enforces MRU ordering', async () => {
      await coordinator.addRecentWorkspace('C:/projects/alpha', 'Alpha');
      await coordinator.addRecentWorkspace('C:/projects/beta', 'Beta');
      await coordinator.addRecentWorkspace('C:/projects/alpha', 'Alpha');

      const recents = await coordinator.getRecentWorkspaces();
      expect(recents.length).toBe(2);
      expect(recents[0].name).toBe('Alpha');
      expect(recents[1].name).toBe('Beta');
    });

    it('enforces bounded maximum history retention', async () => {
      for (let i = 1; i <= 8; i++) {
        await coordinator.addRecentWorkspace(`C:/projects/project-${i}`);
      }

      const recents = await coordinator.getRecentWorkspaces();
      // Configured max is 5
      expect(recents.length).toBe(5);
      expect(recents[0].path).toBe('C:/projects/project-8');
      expect(recents[4].path).toBe('C:/projects/project-4');
    });

    it('removes and clears recent workspaces safely', async () => {
      await coordinator.addRecentWorkspace('C:/projects/alpha');
      await coordinator.addRecentWorkspace('C:/projects/beta');

      await coordinator.removeRecentWorkspace('C:/projects/alpha');
      let recents = await coordinator.getRecentWorkspaces();
      expect(recents.length).toBe(1);
      expect(recents[0].path).toBe('C:/projects/beta');

      await coordinator.clearRecentWorkspaces();
      recents = await coordinator.getRecentWorkspaces();
      expect(recents.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Session Persistence & Resilient Restoration
  // ---------------------------------------------------------------------------
  describe('Session State Persistence & Restoration', () => {
    it('persists and restores open documents, active file, and cursor locations', async () => {
      const ws = await workspaceEngine.open('C:/projects/my-workspace');

      // 1. Open documents in DocumentEngine
      await documentEngine.openResource('C:/projects/my-workspace/src/index.ts', {
        initialContent: 'console.log("index");\nconsole.log("second line");',
      });
      const doc2 = await documentEngine.openResource('C:/projects/my-workspace/src/utils.ts', {
        initialContent: 'export const add = (a, b) => a + b;',
      });

      // 2. Set active document and cursor
      documentEngine.activateDocument(doc2.document.id);
      editorCoordination.setCursorPosition({ line: 1, column: 15 });

      // 3. Persist session
      await coordinator.persistCurrentSession(ws.id);

      // 4. Clear open documents to simulate fresh application restart
      for (const d of documentEngine.getAllDocuments()) {
        await documentEngine.close(d.id, true);
      }
      expect(documentEngine.getAllDocuments().length).toBe(0);

      // 5. Restore session
      const result = await coordinator.restoreSession(ws.id, ws.generation);
      expect(result.status).toBe('restored');
      expect(result.restoredCount).toBe(2);
      expect(result.skippedPaths.length).toBe(0);
      expect(result.activeRestored).toBe(true);

      // 6. Verify restored state in DocumentEngine
      expect(documentEngine.getAllDocuments().length).toBe(2);
      expect(documentEngine.getActiveDocument()?.resourceUri).toBe('file:///C:/projects/my-workspace/src/utils.ts');
    });

    it('safely skips missing or out-of-boundary files without crashing the session', async () => {
      const ws = await workspaceEngine.open('C:/projects/resilient-test');

      // Create a session DTO containing one valid file and one out-of-boundary file
      await sessionRepo.saveWorkspaceSession(ws.id, {
        version: 1,
        openFilePaths: [
          'C:/projects/resilient-test/valid.ts',
          'C:/system32/unauthorized.ts', // out of workspace boundary
        ],
        activeFilePath: 'C:/projects/resilient-test/valid.ts',
        timestamp: Date.now(),
      });

      // Pre-seed the valid file in DocumentEngine with initialContent so it can open cleanly
      await documentEngine.openResource('C:/projects/resilient-test/valid.ts', {
        initialContent: 'valid content',
      });

      const result = await coordinator.restoreSession(ws.id, ws.generation);
      expect(result.status).toBe('restored');
      expect(result.restoredCount).toBe(1);
      expect(result.skippedPaths).toContain('C:/system32/unauthorized.ts');
    });

    it('excludes untitled documents from persistent open file references', async () => {
      const ws = await workspaceEngine.open('C:/projects/untitled-test');

      // Open a real disk file and an untitled buffer
      await documentEngine.openResource('C:/projects/untitled-test/real.ts', {
        initialContent: 'real',
      });
      await documentEngine.createUntitled({ content: 'temporary unsaved text' });

      expect(documentEngine.getAllDocuments().length).toBe(2);

      await coordinator.persistCurrentSession(ws.id);

      const storedSession = await sessionRepo.getWorkspaceSession(ws.id);
      expect(storedSession).not.toBeNull();
      // Only the real file reference is preserved
      expect(storedSession!.openFilePaths.length).toBe(1);
      expect(storedSession!.openFilePaths[0]).toBe('C:/projects/untitled-test/real.ts');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Generation Protection & Workspace Isolation
  // ---------------------------------------------------------------------------
  describe('Workspace Isolation & Generation Protection', () => {
    it('isolates Workspace A session from Workspace B session', async () => {
      const wsA = await workspaceEngine.open('C:/projects/workspace-alpha');
      await documentEngine.openResource('C:/projects/workspace-alpha/alpha.ts', { initialContent: 'alpha' });
      await workspaceEngine.close({ force: true });

      const wsB = await workspaceEngine.open('C:/projects/workspace-beta');
      await documentEngine.openResource('C:/projects/workspace-beta/beta.ts', { initialContent: 'beta' });
      await workspaceEngine.close({ force: true });

      const sessionA = await sessionRepo.getWorkspaceSession(wsA.id);
      const sessionB = await sessionRepo.getWorkspaceSession(wsB.id);

      expect(sessionA!.openFilePaths).toEqual(['C:/projects/workspace-alpha/alpha.ts']);
      expect(sessionB!.openFilePaths).toEqual(['C:/projects/workspace-beta/beta.ts']);
    });

    it('rejects stale restoration when workspace generation changes', async () => {
      const ws = await workspaceEngine.open('C:/projects/stale-gen-test');
      const initialGen = ws.generation;

      await sessionRepo.saveWorkspaceSession(ws.id, {
        version: 1,
        openFilePaths: ['file:///C:/projects/stale-gen-test/app.ts'],
        timestamp: Date.now(),
      });

      // Advance generation (simulating user switching or re-opening workspace)
      await workspaceEngine.close({ force: true });
      await workspaceEngine.open('C:/projects/other-ws');

      // Attempt to restore with the old generation -> rejected!
      const result = await coordinator.restoreSession(ws.id, initialGen);
      expect(result.status).toBe('stale_generation');
      expect(result.restoredCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Debounced Scheduling & Shutdown Flush
  // ---------------------------------------------------------------------------
  describe('Scheduling & Flush', () => {
    it('flushes pending debounced session write immediately on flush()', async () => {
      const ws = await workspaceEngine.open('C:/projects/flush-test');
      await documentEngine.openResource('file:///C:/projects/flush-test/main.ts', {
        initialContent: 'main code',
      });

      // Trigger debounced save
      coordinator.scheduleSessionSave();

      // Flush immediately without waiting for debounce timer
      await coordinator.flush();

      const stored = await sessionRepo.getWorkspaceSession(ws.id);
      expect(stored).not.toBeNull();
      expect(stored!.openFilePaths).toContain('C:/projects/flush-test/main.ts');
    });

    it('flushes session automatically when workspace close is requested', async () => {
      const ws = await workspaceEngine.open('C:/projects/auto-close-flush');
      await documentEngine.openResource('C:/projects/auto-close-flush/test.ts', {
        initialContent: 'test',
      });

      // Closing workspace triggers closeRequested listener which persists session
      await workspaceEngine.close({ force: true });

      const stored = await sessionRepo.getWorkspaceSession(ws.id);
      expect(stored).not.toBeNull();
      expect(stored!.openFilePaths).toContain('C:/projects/auto-close-flush/test.ts');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Legacy Storage Migration
  // ---------------------------------------------------------------------------
  describe('Legacy Migration', () => {
    it('migrates legacy recent workspaces from localStorage', async () => {
      const mockStorage = new Map<string, string>();
      const originalLocalStorage = (globalThis as any).localStorage;

      (globalThis as any).localStorage = {
        getItem: (k: string) => mockStorage.get(k) ?? null,
        setItem: (k: string, v: string) => mockStorage.set(k, v),
        removeItem: (k: string) => mockStorage.delete(k),
      };

      try {
        const legacyRecents = [
          { path: 'C:/legacy/project-1', name: 'Legacy 1', lastOpened: 1000 },
          { path: 'C:/legacy/project-2', name: 'Legacy 2', lastOpened: 2000 },
        ];
        mockStorage.set('qm_editor_recent_workspaces_v1', JSON.stringify(legacyRecents));

        await coordinator.migrateLegacyStorage();

        const migrated = await workspaceRepo.getRecentWorkspaces();
        expect(migrated.length).toBe(2);
        expect(migrated[0].path).toBe('C:/legacy/project-1');

        // Legacy key should be cleanly removed
        expect(mockStorage.has('qm_editor_recent_workspaces_v1')).toBe(false);
      } finally {
        (globalThis as any).localStorage = originalLocalStorage;
      }
    });
  });
});
