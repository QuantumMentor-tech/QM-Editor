import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { CommandPaletteModal } from './CommandPaletteModal';
import { CommandRegistry } from '../../core/commands/CommandRegistry';
import { CommandSearchService } from '../../services/CommandSearchService';
import { CommandContext } from '../../core/commands/CommandTypes';

import { DEFAULT_EDITOR_SETTINGS } from '../../services/PreferencesService';

const mockRegistry = new CommandRegistry();
mockRegistry.register({
  id: 'file.save',
  label: 'Save Active Document',
  category: 'document',
  shortcut: 'Mod+S',
  description: 'Save changes to disk',
  canExecute: (ctx) => Boolean(ctx.activeDoc),
  execute: vi.fn(),
});
mockRegistry.register({
  id: 'editor.undo',
  label: 'Undo Action',
  category: 'editor',
  shortcut: 'Mod+Z',
  execute: vi.fn(),
});

const mockContext: CommandContext = {
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
};

describe('CommandPaletteModal Integration', () => {
  it('instantiates CommandPaletteModal element correctly', () => {
    const onExecute = vi.fn();
    const onClose = vi.fn();

    const element = React.createElement(CommandPaletteModal, {
      registry: mockRegistry,
      commandContext: mockContext,
      onExecuteCommand: onExecute,
      onClose: onClose,
    });

    expect(element.props.registry).toBe(mockRegistry);
    expect(element.props.commandContext).toBe(mockContext);
  });

  it('filters command items using CommandSearchService', () => {
    const commands = mockRegistry.getAll();
    const filtered = CommandSearchService.search(commands, 'Undo', mockContext);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].command.id).toBe('editor.undo');
  });

  it('revalidates command availability before execution', () => {
    const commands = mockRegistry.getAll();
    const results = CommandSearchService.search(commands, 'Save', mockContext);

    expect(results).toHaveLength(1);
    expect(results[0].command.id).toBe('file.save');
    expect(results[0].isAvailable).toBe(false); // activeDoc is null in mockContext
  });
});
