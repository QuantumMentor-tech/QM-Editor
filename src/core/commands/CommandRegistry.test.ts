import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRegistry } from './CommandRegistry';
import { defaultCommands } from './defaultCommands';
import { CommandContext, Command } from './CommandTypes';
import { QMEditorError } from '../../utils/errors';

describe('CommandRegistry Core Engine', () => {
  let registry: CommandRegistry;
  let mockContext: CommandContext;

  beforeEach(() => {
    registry = new CommandRegistry();
    mockContext = {
      activeDoc: {
        id: 'doc-1',
        title: 'test.txt',
        content: 'hello',
        language: 'plaintext',
        isDirty: true,
        lastSavedTimestamp: Date.now(),
      },
      shellState: {
        theme: 'dark',
        sidebarOpen: true,
        sidebarWidth: 260,
        panelOpen: false,
        activePanelView: 'output',
        activeView: 'editor',
        dialogOpen: false,
        dialogTitle: '',
        dialogContent: null,
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
  });

  it('registers commands and prevents duplicate command IDs', () => {
    const cmd: Command = {
      id: 'test.command',
      label: 'Test Command',
      category: 'editor',
      execute: () => {},
    };

    registry.register(cmd);
    expect(registry.get('test.command')).toEqual(cmd);

    // Attempt duplicate registration
    expect(() => registry.register(cmd)).toThrow(QMEditorError);
  });

  it('evaluates command execution availability safely', () => {
    defaultCommands.forEach((cmd) => registry.register(cmd));

    expect(registry.canExecute('document.save', mockContext)).toBe(true);

    // If active doc is clean, document.save canExecute returns false
    mockContext.activeDoc!.isDirty = false;
    expect(registry.canExecute('document.save', mockContext)).toBe(false);
  });

  it('executes command successfully without throwing', async () => {
    let executed = false;
    const cmd: Command = {
      id: 'test.exec',
      label: 'Exec Command',
      category: 'editor',
      execute: () => {
        executed = true;
      },
    };

    registry.register(cmd);
    await registry.execute('test.exec', mockContext);
    expect(executed).toBe(true);
  });
});
