import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandSurfaceRegistry } from './CommandSurfaceRegistry';
import { CommandRegistry } from './CommandRegistry';
import { defaultCommands } from './defaultCommands';
import { CommandContext } from './CommandTypes';
import { DEFAULT_EDITOR_SETTINGS } from '../../services/PreferencesService';

describe('CommandSurfaceRegistry', () => {
  let commandRegistry: CommandRegistry;
  let surfaceRegistry: CommandSurfaceRegistry;
  let mockContext: CommandContext;

  beforeEach(() => {
    commandRegistry = new CommandRegistry();
    defaultCommands.forEach((cmd) => commandRegistry.register(cmd));
    surfaceRegistry = new CommandSurfaceRegistry(commandRegistry);

    mockContext = {
      activeDoc: {
        id: 'doc-1',
        title: 'sample.ts',
        content: 'const a = 1;',
        language: 'typescript',
        contentRevision: 1,
        savedRevision: 0,
        isDirty: true,
        lastSavedTimestamp: Date.now(),
        filePath: 'C:/project/sample.ts',
      },
      shellState: {
        theme: 'dark',
        sidebarOpen: true,
        sidebarWidth: 260,
        sidebarView: 'explorer',
        panelOpen: false,
        activePanelView: 'output',
        activeView: 'editor',
        dialogOpen: false,
        dialogTitle: '',
        dialogContent: null,
        editorSettings: {
          ...DEFAULT_EDITOR_SETTINGS,
          wordWrap: 'on',
        },
      },
      workspaceActions: {
        saveDoc: vi.fn(),
        createDoc: vi.fn(),
        closeDoc: vi.fn(),
        activateDoc: vi.fn(),
      },
      shellActions: {
        toggleSidebar: vi.fn(),
        togglePanel: vi.fn(),
        toggleTheme: vi.fn(),
      },
      explorerActions: {
        openWorkspace: vi.fn(),
        refreshWorkspace: vi.fn(),
        revealActiveFile: vi.fn(),
        copyPath: vi.fn(),
        copyRelativePath: vi.fn(),
      },
      tabActions: {
        closeOthers: vi.fn(),
        closeSaved: vi.fn(),
        closeToTheRight: vi.fn(),
        copyPath: vi.fn(),
      },
      editorActions: {
        undo: vi.fn(),
        redo: vi.fn(),
        selectAll: vi.fn(),
        cut: vi.fn(),
        copy: vi.fn(),
        paste: vi.fn(),
      },
      terminalActions: {
        newTerminal: vi.fn(),
        togglePanel: vi.fn(),
        clear: vi.fn(),
        kill: vi.fn(),
        next: vi.fn(),
        previous: vi.fn(),
        copy: vi.fn(),
        paste: vi.fn(),
      },
      taskActions: {
        runTask: vi.fn(),
        runBuild: vi.fn(),
        runTest: vi.fn(),
        cancel: vi.fn(),
        showTasks: vi.fn(),
        showProblems: vi.fn(),
      },
      problemActions: {
        copyMessage: vi.fn(),
        goToSource: vi.fn(),
      },
    };
  });

  describe('Surface Registration & Resolution', () => {
    it('registers custom surface items and returns them in defined order', () => {
      surfaceRegistry.registerSurfaceItem('custom:test', {
        commandId: 'file.open',
        group: 'open',
        order: 20,
      });
      surfaceRegistry.registerSurfaceItem('custom:test', {
        commandId: 'file.new',
        group: 'new',
        order: 10,
      });

      const items = surfaceRegistry.getSurfaceItems('custom:test', mockContext);
      expect(items.length).toBe(2);
      expect(items[0].commandId).toBe('file.new');
      expect(items[1].commandId).toBe('file.open');
    });

    it('filters out hidden items using when condition without affecting other items', () => {
      surfaceRegistry.registerSurfaceItem('custom:visibility', {
        commandId: 'file.new',
        when: () => true,
      });
      surfaceRegistry.registerSurfaceItem('custom:visibility', {
        commandId: 'file.save',
        when: () => false, // Hidden in current context
      });

      const items = surfaceRegistry.getSurfaceItems('custom:visibility', mockContext);
      expect(items.length).toBe(1);
      expect(items[0].commandId).toBe('file.new');
    });

    it('preserves disabled items with enabled: false based on CommandRegistry canExecute', () => {
      // Clean document -> file.save is disabled but remains visible
      mockContext.activeDoc!.isDirty = false;

      const items = surfaceRegistry.getSurfaceItems('toolbar', mockContext);
      const saveItem = items.find((i) => i.commandId === 'file.save');
      expect(saveItem).toBeDefined();
      expect(saveItem?.enabled).toBe(false);
    });

    it('resolves checked state for toggleable commands accurately', () => {
      const menuBar = surfaceRegistry.getResolvedMenuBar(mockContext);
      const viewCat = menuBar.find((c) => c.id === 'view');
      expect(viewCat).toBeDefined();

      const allViewItems = viewCat!.groups.flatMap((g) => g.items);
      const wordWrapItem = allViewItems.find((i) => i.commandId === 'editor.toggleWordWrap');
      expect(wordWrapItem).toBeDefined();
      expect(wordWrapItem?.checked).toBe(true);
    });

    it('formats platform-specific keyboard shortcuts cleanly', () => {
      const items = surfaceRegistry.getSurfaceItems('toolbar', mockContext);
      const saveItem = items.find((i) => i.commandId === 'file.save');
      expect(saveItem?.formattedShortcut).toBeTruthy();
      expect(saveItem?.formattedShortcut).toContain('S');
    });
  });

  describe('Group & Separator Management', () => {
    it('groups resolved surface items and eliminates empty groups', () => {
      const groups = surfaceRegistry.getSurfaceGroups('contextmenu:explorer', mockContext);
      expect(groups.length).toBeGreaterThan(0);

      // Verify each group has items
      for (const g of groups) {
        expect(g.items.length).toBeGreaterThan(0);
      }
    });

    it('resolves complete MenuBar structure with standard 9 categories', () => {
      const menuBar = surfaceRegistry.getResolvedMenuBar(mockContext);
      const categoryIds = menuBar.map((c) => c.id);

      expect(categoryIds).toContain('file');
      expect(categoryIds).toContain('edit');
      expect(categoryIds).toContain('selection');
      expect(categoryIds).toContain('view');
      expect(categoryIds).toContain('go');
      expect(categoryIds).toContain('terminal');
      expect(categoryIds).toContain('tasks');
      expect(categoryIds).toContain('sourcecontrol');
      expect(categoryIds).toContain('help');
    });
  });

  describe('Stale Context Protection & Revalidation', () => {
    it('rejects execution when command ID is not found in CommandRegistry', async () => {
      const success = await surfaceRegistry.revalidateAndExecute('invalid.unknown.command', mockContext);
      expect(success).toBe(false);
    });

    it('rejects execution when target validator fails due to stale context', async () => {
      // e.g. file was deleted or document closed while menu was open
      let targetFileExists = true;
      const targetValidator = () => targetFileExists;

      // When target is valid
      const resultValid = await surfaceRegistry.revalidateAndExecute('file.new', mockContext, targetValidator);
      expect(resultValid).toBe(true);

      // Now target becomes invalid
      targetFileExists = false;
      const resultInvalid = await surfaceRegistry.revalidateAndExecute('file.new', mockContext, targetValidator);
      expect(resultInvalid).toBe(false);
    });

    it('rejects execution when command availability becomes invalid before click', async () => {
      // Document is dirty -> save is runnable
      expect(mockContext.activeDoc!.isDirty).toBe(true);
      const canRunInitially = await surfaceRegistry.revalidateAndExecute('file.save', mockContext);
      expect(canRunInitially).toBe(true);

      // Document became clean / activeDoc closed
      mockContext.activeDoc = null;
      const canRunStale = await surfaceRegistry.revalidateAndExecute('file.save', mockContext);
      expect(canRunStale).toBe(false);
    });
  });

  describe('Default Command Surfaces Inventory', () => {
    it('provides primary toolbar with high-frequency actions', () => {
      const toolbarItems = surfaceRegistry.getSurfaceItems('toolbar', mockContext);
      const commandIds = toolbarItems.map((i) => i.commandId);

      expect(commandIds).toContain('file.new');
      expect(commandIds).toContain('file.open');
      expect(commandIds).toContain('file.save');
      expect(commandIds).toContain('editor.undo');
      expect(commandIds).toContain('editor.redo');
      expect(commandIds).toContain('workbench.action.findInFiles');
      expect(commandIds).toContain('workbench.action.quickOpen');
      expect(commandIds).toContain('workbench.action.showCommands');
      expect(commandIds).toContain('workbench.action.openSettings');
    });

    it('provides contextual menus for explorer, editor, tabs, terminal, tasks, and problems', () => {
      const explorerItems = surfaceRegistry.getSurfaceItems('contextmenu:explorer', mockContext);
      expect(explorerItems.length).toBeGreaterThan(0);

      const editorItems = surfaceRegistry.getSurfaceItems('contextmenu:editor', mockContext);
      expect(editorItems.length).toBeGreaterThan(0);

      const tabItems = surfaceRegistry.getSurfaceItems('contextmenu:tab', mockContext);
      expect(tabItems.length).toBeGreaterThan(0);

      const terminalItems = surfaceRegistry.getSurfaceItems('contextmenu:terminal', mockContext);
      expect(terminalItems.length).toBeGreaterThan(0);

      const taskItems = surfaceRegistry.getSurfaceItems('contextmenu:task', mockContext);
      expect(taskItems.length).toBeGreaterThan(0);

      const problemItems = surfaceRegistry.getSurfaceItems('contextmenu:problem', mockContext);
      expect(problemItems.length).toBeGreaterThan(0);
    });
  });
});
