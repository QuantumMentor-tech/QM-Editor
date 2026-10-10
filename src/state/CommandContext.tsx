import React, { createContext, useContext, useEffect, useRef } from 'react';
import { CommandRegistry, globalCommandRegistry } from '../core/commands/CommandRegistry';
import { defaultCommands } from '../core/commands/defaultCommands';
import { CommandContext as CommandContextType } from '../core/commands/CommandTypes';
import { ShortcutManager } from '../core/commands/ShortcutManager';
import { useShellState } from './ShellContext';
import { useWorkspace } from './WorkspaceContext';
import { useExplorer } from './ExplorerContext';
import { useSearch } from './SearchContext';
import { useNavigation } from './NavigationContext';
import { GoToLineModal } from '../components/navigation/GoToLineModal';
import { RecentDocumentsModal } from '../components/navigation/RecentDocumentsModal';
import { EditorSettingsModal } from '../components/settings/EditorSettingsModal';
import { fileService } from '../services/FileService';

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
  const {
    state: shellState,
    toggleSidebar,
    togglePanel,
    toggleTheme,
    zoomIn,
    zoomOut,
    zoomReset,
    toggleWordWrap,
    toggleLineNumbers,
    toggleWhitespace,
    toggleFolding,
    openDialog,
  } = useShellState();
  const { activeDoc, openDocs, saveDoc, saveDocAs, createDoc, openFile, openFilePath, closeDoc, activateDoc } = useWorkspace();
  const { openWorkspace, refreshWorkspace, revealActiveFile } = useExplorer();
  const { openSearch, closeSearch, findNext, findPrevious, replaceCurrent, replaceAll } = useSearch();
  const { navigateBack, navigateForward, canNavigateBack, canNavigateForward, currentPos } = useNavigation();

  const openSettings = () => {
    openDialog('Editor Preferences & Settings', <EditorSettingsModal />);
  };

  const handleGoToLineModal = () => {
    if (!activeDoc) return;
    const maxLines = activeDoc.content.split('\n').length;
    openDialog(
      'Go to Line',
      <GoToLineModal
        currentLine={currentPos.line}
        maxLines={maxLines}
        onGoToLine={(line, col) => {
          window.dispatchEvent(
            new CustomEvent('qm:editor:gotoline', { detail: { line, column: col } })
          );
        }}
      />
    );
  };

  const handleOpenRecentModal = () => {
    openDialog(
      'Recently Opened Files',
      <RecentDocumentsModal
        onOpenRecent={async (uri) => {
          if (openFilePath) {
            await openFilePath(uri);
          }
        }}
      />
    );
  };

  const handleNavigateBack = async () => {
    const loc = navigateBack();
    if (!loc) return;
    const targetDoc = openDocs.find((d) => d.id === loc.documentId || (d.filePath && d.filePath === loc.filePath));
    if (targetDoc) {
      activateDoc(targetDoc.id);
      window.dispatchEvent(new CustomEvent('qm:editor:gotoline', { detail: { line: loc.line, column: loc.column } }));
    } else if (loc.filePath && openFilePath) {
      const exists = await fileService.fileExists(loc.filePath);
      if (exists) {
        await openFilePath(loc.filePath);
        window.dispatchEvent(new CustomEvent('qm:editor:gotoline', { detail: { line: loc.line, column: loc.column } }));
      }
    }
  };

  const handleNavigateForward = async () => {
    const loc = navigateForward();
    if (!loc) return;
    const targetDoc = openDocs.find((d) => d.id === loc.documentId || (d.filePath && d.filePath === loc.filePath));
    if (targetDoc) {
      activateDoc(targetDoc.id);
      window.dispatchEvent(new CustomEvent('qm:editor:gotoline', { detail: { line: loc.line, column: loc.column } }));
    } else if (loc.filePath && openFilePath) {
      const exists = await fileService.fileExists(loc.filePath);
      if (exists) {
        await openFilePath(loc.filePath);
        window.dispatchEvent(new CustomEvent('qm:editor:gotoline', { detail: { line: loc.line, column: loc.column } }));
      }
    }
  };

  const navigationActions = {
    goToLine: handleGoToLineModal,
    navigateBack: handleNavigateBack,
    navigateForward: handleNavigateForward,
    openRecent: handleOpenRecentModal,
    canNavigateBack,
    canNavigateForward,
  };

  const commandContextRef = useRef<CommandContextType>({
    activeDoc,
    shellState,
    workspaceActions: { saveDoc, saveDocAs, createDoc, openFile, closeDoc, activateDoc },
    shellActions: {
      toggleSidebar,
      togglePanel,
      toggleTheme,
      zoomIn,
      zoomOut,
      zoomReset,
      toggleWordWrap,
      toggleLineNumbers,
      toggleWhitespace,
      toggleFolding,
      openSettings,
    },
    explorerActions: { openWorkspace, refreshWorkspace, revealActiveFile },
    searchActions: { openSearch, closeSearch, findNext, findPrevious, replaceCurrent, replaceAll },
    navigationActions,
  });

  // Keep commandContextRef in sync on re-renders
  commandContextRef.current = {
    activeDoc,
    shellState,
    workspaceActions: { saveDoc, saveDocAs, createDoc, openFile, closeDoc, activateDoc },
    shellActions: {
      toggleSidebar,
      togglePanel,
      toggleTheme,
      zoomIn,
      zoomOut,
      zoomReset,
      toggleWordWrap,
      toggleLineNumbers,
      toggleWhitespace,
      toggleFolding,
      openSettings,
    },
    explorerActions: { openWorkspace, refreshWorkspace, revealActiveFile },
    searchActions: { openSearch, closeSearch, findNext, findPrevious, replaceCurrent, replaceAll },
    navigationActions,
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
