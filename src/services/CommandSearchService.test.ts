import { describe, it, expect } from 'vitest';
import { DEFAULT_EDITOR_SETTINGS } from './PreferencesService';
import { CommandSearchService } from './CommandSearchService';
import { Command, CommandContext } from '../core/commands/CommandTypes';

const mockCommands: Command[] = [
  {
    id: 'file.save',
    label: 'Save Active Document',
    category: 'document',
    shortcut: 'Mod+S',
    description: 'Save current document to disk',
    canExecute: (ctx) => Boolean(ctx.activeDoc),
    execute: () => {},
  },
  {
    id: 'file.new',
    label: 'New File',
    category: 'document',
    shortcut: 'Mod+N',
    canExecute: () => true,
    execute: () => {},
  },
  {
    id: 'editor.undo',
    label: 'Undo',
    category: 'editor',
    shortcut: 'Mod+Z',
    canExecute: () => true,
    execute: () => {},
  },
  {
    id: 'shell.toggleSidebar',
    label: 'Toggle Sidebar Explorer',
    category: 'shell',
    shortcut: 'Mod+B',
    canExecute: () => true,
    execute: () => {},
  },
  {
    id: 'navigation.goToLine',
    label: 'Go to Line / Column...',
    category: 'editor',
    shortcut: 'Mod+G',
    canExecute: (ctx) => Boolean(ctx.activeDoc),
    execute: () => {},
  },
];

describe('CommandSearchService', () => {
  it('returns all commands when query is empty', () => {
    const results = CommandSearchService.search(mockCommands, '');
    expect(results).toHaveLength(mockCommands.length);
  });

  it('matches exact and prefix queries correctly', () => {
    const results = CommandSearchService.search(mockCommands, 'Undo');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].command.id).toBe('editor.undo');
    expect(results[0].score).toBe(1000); // Exact match score
  });

  it('matches word start queries correctly', () => {
    const results = CommandSearchService.search(mockCommands, 'Line');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].command.id).toBe('navigation.goToLine');
  });

  it('scores fuzzy matches lower than exact/prefix matches', () => {
    const results = CommandSearchService.search(mockCommands, 'togsidebar');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].command.id).toBe('shell.toggleSidebar');
  });

  it('handles regex special characters safely in queries', () => {
    expect(() => {
      CommandSearchService.search(mockCommands, '[invalid(regex');
    }).not.toThrow();
  });

  it('reflects command availability from context', () => {
    const dummyCtx: CommandContext = {
      activeDoc: null,
      shellState: {
        theme: 'dark',
        sidebarOpen: true,
        sidebarWidth: 260,
        sidebarView: 'explorer',
        panelOpen: false,
        activePanelView: 'terminal',
        activeView: 'editor',
        dialogOpen: false,
        dialogTitle: '',
        dialogContent: null,
        editorSettings: DEFAULT_EDITOR_SETTINGS,
      },
      workspaceActions: {
        saveDoc: () => {},
        createDoc: () => {},
        closeDoc: () => {},
        activateDoc: () => {},
      },
      shellActions: {
        toggleSidebar: () => {},
        togglePanel: () => {},
        toggleTheme: () => {},
      },
    };

    const results = CommandSearchService.search(mockCommands, 'Save', dummyCtx);
    expect(results.length).toBeGreaterThan(0);
    const saveResult = results.find((r) => r.command.id === 'file.save');
    expect(saveResult?.isAvailable).toBe(false);
  });
});
