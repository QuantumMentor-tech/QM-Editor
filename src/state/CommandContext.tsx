import React, { createContext, useContext, useEffect, useRef } from 'react';
import { CommandRegistry, globalCommandRegistry } from '../core/commands/CommandRegistry';
import { defaultCommands } from '../core/commands/defaultCommands';
import { CommandContext as CommandContextType } from '../core/commands/CommandTypes';
import { ShortcutManager } from '../core/commands/ShortcutManager';
import { useShellState } from './ShellContext';
import { useWorkspace } from './WorkspaceContext';

export interface CommandContextApi {
  registry: CommandRegistry;
  executeCommand: (id: string) => Promise<void>;
  canExecuteCommand: (id: string) => boolean;
}

const CommandContext = createContext<CommandContextApi | undefined>(undefined);

// Register default commands into global registry once
defaultCommands.forEach((cmd) => {
  if (!globalCommandRegistry.get(cmd.id)) {
    globalCommandRegistry.register(cmd);
  }
});

export const CommandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state: shellState, toggleSidebar, togglePanel, toggleTheme } = useShellState();
  const { activeDoc, saveDoc, saveDocAs, createDoc, openFile, closeDoc, activateDoc } = useWorkspace();

  const commandContextRef = useRef<CommandContextType>({
    activeDoc,
    shellState,
    workspaceActions: { saveDoc, saveDocAs, createDoc, openFile, closeDoc, activateDoc },
    shellActions: { toggleSidebar, togglePanel, toggleTheme },
  });

  // Keep commandContextRef in sync on re-renders
  commandContextRef.current = {
    activeDoc,
    shellState,
    workspaceActions: { saveDoc, saveDocAs, createDoc, openFile, closeDoc, activateDoc },
    shellActions: { toggleSidebar, togglePanel, toggleTheme },
  };

  const executeCommand = async (id: string): Promise<void> => {
    await globalCommandRegistry.execute(id, commandContextRef.current);
  };

  const canExecuteCommand = (id: string): boolean => {
    return globalCommandRegistry.canExecute(id, commandContextRef.current);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      ShortcutManager.handleKeyDown(e, commandContextRef.current, globalCommandRegistry);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <CommandContext.Provider
      value={{
        registry: globalCommandRegistry,
        executeCommand,
        canExecuteCommand,
      }}
    >
      {children}
    </CommandContext.Provider>
  );
};

export const useCommand = (): CommandContextApi => {
  const context = useContext(CommandContext);
  if (!context) {
    throw new Error('useCommand must be used within a CommandProvider');
  }
  return context;
};
