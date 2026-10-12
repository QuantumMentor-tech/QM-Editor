import React, { createContext, useContext, useEffect, useRef } from 'react';
import { CommandRegistry, globalCommandRegistry } from '../core/commands/CommandRegistry';
import { CommandSurfaceRegistry, globalCommandSurfaceRegistry } from '../core/commands/CommandSurfaceRegistry';
import { defaultCommands } from '../core/commands/defaultCommands';
import { CommandContext as CommandContextType } from '../core/commands/CommandTypes';
import { ShortcutManager } from '../core/commands/ShortcutManager';
import { useShellState } from './ShellContext';
import { useWorkspace } from './WorkspaceContext';
import { useExplorer } from './ExplorerContext';
import { useSearch } from './SearchContext';
import { useNavigation } from './NavigationContext';
import { useSourceControl } from './SourceControlContext';
import { useTerminal } from './TerminalContext';
import { useTasks } from './TaskContext';
import { terminalService } from '../core/terminal/TerminalService';
import { GoToLineModal } from '../components/navigation/GoToLineModal';
import { RecentDocumentsModal } from '../components/navigation/RecentDocumentsModal';
import { UnifiedSettingsModal } from '../components/settings/UnifiedSettingsModal';
import { CommandPaletteModal } from '../components/palette/CommandPaletteModal';
import { QuickOpenModal } from '../components/navigation/QuickOpenModal';
import { WorkspaceSearchModal } from '../components/search/WorkspaceSearchModal';
import { SourceControlDiffModal } from '../components/source-control/SourceControlDiffModal';
import { GoToSymbolModal } from '../components/symbols/GoToSymbolModal';
import { workspaceIndexService } from '../services/WorkspaceIndexService';
import { fileService } from '../services/FileService';

export interface CommandContextApi {
  registry: CommandRegistry;
  surfaceRegistry: CommandSurfaceRegistry;
  executeCommand: (id: string, contextualTarget?: any) => Promise<boolean>;
  canExecuteCommand: (id: string, contextualTarget?: any) => boolean;
  getCommandContext: (contextualTarget?: any) => CommandContextType;
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
    setSidebarView,
    togglePanel,
    toggleTheme,
    zoomIn,
    zoomOut,
    zoomReset,
    toggleWordWrap,
    toggleLineNumbers,
    toggleWhitespace,
    toggleFolding,
    setActivePanelView,
    resetLayout,
    toggleUiDensity,
    openWelcome,
    closeWelcome,
    openDialog,
    closeDialog,
  } = useShellState();
  const {
    activeDoc,
    openDocs,
    registry,
    saveDoc,
    saveDocAs,
    createDoc,
    openFile,
    openFilePath,
    closeDoc,
    activateDoc,
    updateText,
  } = useWorkspace();
  const { workspaceRoot, openWorkspace, refreshWorkspace, revealActiveFile } = useExplorer();
  const { openSearch, closeSearch, findNext, findPrevious, replaceCurrent, replaceAll } = useSearch();
  const { navigateBack, navigateForward, canNavigateBack, canNavigateForward, currentPos } = useNavigation();
  const { refresh: refreshSCM, getDiff: getDiffSCM } = useSourceControl();
  const { createTerminal, clearActiveTerminal, closeTerminal, activeSessionId, writeToActive } = useTerminal();
  const { runTask, runBuildTask, runTestTask, cancelTask, activeSession: activeTaskSession } = useTasks();

  const openSettings = () => {
    openDialog('Settings & Preferences', <UnifiedSettingsModal />);
  };

  const handleOpenCommandPalette = () => {
    openDialog(
      'Command Palette',
      <CommandPaletteModal
        registry={globalCommandRegistry}
        commandContext={commandContextRef.current}
        onExecuteCommand={async (id) => {
          closeDialog();
          setTimeout(async () => {
            await executeCommand(id);
          }, 10);
        }}
        onClose={closeDialog}
      />
    );
  };

  const handleQuickOpen = () => {
    if (workspaceRoot) {
      workspaceIndexService.indexFromTree(workspaceRoot);
    }
    openDialog(
      'Quick Open File',
      <QuickOpenModal
        workspaceRoot={workspaceRoot}
        openDocs={openDocs}
        onSelectResource={async (res) => {
          closeDialog();
          const existing = openDocs.find(
            (d) =>
              (d.fileResource && d.fileResource.uri.toLowerCase() === res.uri.toLowerCase()) ||
              (d.filePath && d.filePath.toLowerCase() === res.uri.toLowerCase())
          );
          if (existing) {
            activateDoc(existing.id);
          } else if (openFilePath) {
            await openFilePath(res.uri);
          }
          if (revealActiveFile) {
            revealActiveFile(res.uri);
          }
        }}
        onClose={closeDialog}
      />
    );
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

  const handleGoToSymbolModal = (initialMode: 'document' | 'workspace' = 'document') => {
    openDialog(
      initialMode === 'workspace' ? 'Go to Symbol in Workspace' : 'Go to Symbol in Editor',
      <GoToSymbolModal
        initialMode={initialMode}
        activeDoc={activeDoc}
        onNavigate={async (uri, line, col) => {
          closeDialog();
          const existing = openDocs.find(
            (d) =>
              (d.fileResource && d.fileResource.uri.toLowerCase() === uri.toLowerCase()) ||
              (d.filePath && d.filePath.toLowerCase() === uri.toLowerCase()) ||
              d.title.toLowerCase() === uri.toLowerCase()
          );

          if (existing) {
            activateDoc(existing.id);
          } else if (openFilePath) {
            await openFilePath(uri);
          }

          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('qm:editor:gotoline', { detail: { line, column: col } })
            );
          }, 40);
        }}
        onClose={closeDialog}
      />
    );
  };

  const handleFocusOutline = () => {
    setSidebarView('outline');
  };

  const navigationActions = {
    goToLine: handleGoToLineModal,
    navigateBack: handleNavigateBack,
    navigateForward: handleNavigateForward,
    openRecent: handleOpenRecentModal,
    quickOpen: handleQuickOpen,
    gotoSymbol: handleGoToSymbolModal,
    focusOutline: handleFocusOutline,
    canNavigateBack,
    canNavigateForward,
  };

  const handleWorkspaceSearchModal = () => {
    if (workspaceRoot) {
      workspaceIndexService.indexFromTree(workspaceRoot);
    }
    openDialog(
      'Search in Workspace',
      <WorkspaceSearchModal
        workspaceRoot={workspaceRoot}
        openDocs={openDocs}
        updateText={updateText}
        onSelectMatch={async (res, match) => {
          closeDialog();
          const existing = openDocs.find(
            (d) =>
              (d.fileResource && d.fileResource.uri.toLowerCase() === res.uri.toLowerCase()) ||
              (d.filePath && d.filePath.toLowerCase() === res.uri.toLowerCase())
          );
          if (existing) {
            activateDoc(existing.id);
            window.dispatchEvent(
              new CustomEvent('qm:editor:gotoline', { detail: { line: match.line, column: match.column } })
            );
          } else if (openFilePath) {
            await openFilePath(res.uri);
            window.dispatchEvent(
              new CustomEvent('qm:editor:gotoline', { detail: { line: match.line, column: match.column } })
            );
          }
          if (revealActiveFile) {
            revealActiveFile(res.uri);
          }
        }}
        openDialog={openDialog}
        closeDialog={closeDialog}
      />
    );
  };

  const searchActions = {
    openSearch,
    closeSearch,
    findNext,
    findPrevious,
    replaceCurrent,
    replaceAll,
    workspaceFind: handleWorkspaceSearchModal,
    workspaceReplace: handleWorkspaceSearchModal,
  };

  const handleOpenScmDiff = async () => {
    const uri = activeDoc?.filePath || activeDoc?.fileResource?.uri;
    if (!uri) return;
    const diffResult = await getDiffSCM(uri);
    openDialog(
      `Diff: ${activeDoc?.title || 'Active Document'}`,
      <SourceControlDiffModal diffResult={diffResult} onClose={closeDialog} />
    );
  };

  const sourceControlActions = {
    openPanel: () => setSidebarView('scm'),
    refresh: async () => {
      await refreshSCM();
    },
    openDiff: handleOpenScmDiff,
  };

  const explorerActions = {
    openWorkspace,
    refreshWorkspace,
    revealActiveFile,
    copyPath: (uri: string) => {
      if (navigator.clipboard) navigator.clipboard.writeText(uri);
    },
    copyRelativePath: (uri: string) => {
      let rel = uri;
      if (workspaceRoot && uri.startsWith(workspaceRoot.uri)) {
        rel = uri.substring(workspaceRoot.uri.length).replace(/^[\\/]/, '');
      }
      if (navigator.clipboard) navigator.clipboard.writeText(rel);
    },
  };

  const terminalActions = {
    newTerminal: () => {
      setActivePanelView('terminal');
      createTerminal();
    },
    togglePanel: () => {
      if (!shellState.panelOpen || shellState.activePanelView !== 'terminal') {
        setActivePanelView('terminal');
      } else {
        togglePanel();
      }
    },
    clear: () => clearActiveTerminal(),
    kill: () => {
      if (activeSessionId) closeTerminal(activeSessionId);
    },
    next: () => terminalService.nextSession(),
    previous: () => terminalService.previousSession(),
    copy: () => {
      const sel = window.getSelection()?.toString();
      if (sel && navigator.clipboard) {
        navigator.clipboard.writeText(sel);
      }
    },
    paste: async () => {
      if (navigator.clipboard && writeToActive) {
        const text = await navigator.clipboard.readText();
        if (text) writeToActive(text);
      }
    },
  };

  const taskActions = {
    runTask: async (taskId?: string) => {
      setActivePanelView('tasks');
      if (taskId) {
        await runTask(taskId);
      } else {
        await runBuildTask();
      }
    },
    runBuild: async () => {
      setActivePanelView('tasks');
      await runBuildTask();
    },
    runTest: async () => {
      setActivePanelView('tasks');
      await runTestTask();
    },
    cancel: async () => {
      if (activeTaskSession) {
        await cancelTask(activeTaskSession.sessionId);
      }
    },
    showTasks: () => {
      setActivePanelView('tasks');
    },
    showProblems: () => {
      setActivePanelView('problems');
    },
  };

  const tabActions = {
    closeOthers: (targetId: string) => {
      openDocs.filter((d) => d.id !== targetId).forEach((d) => closeDoc(d.id));
    },
    closeSaved: () => {
      openDocs.filter((d) => !d.isDirty).forEach((d) => closeDoc(d.id));
    },
    closeToTheRight: (targetId: string) => {
      const idx = registry.openDocIds.indexOf(targetId);
      if (idx >= 0) {
        registry.openDocIds.slice(idx + 1).forEach((id) => closeDoc(id));
      }
    },
    copyPath: (path: string) => {
      if (navigator.clipboard) navigator.clipboard.writeText(path);
    },
  };

  const editorActions = {
    undo: () => window.dispatchEvent(new CustomEvent('qm:editor:undo')),
    redo: () => window.dispatchEvent(new CustomEvent('qm:editor:redo')),
    selectAll: () => window.dispatchEvent(new CustomEvent('qm:editor:selectall')),
    cut: () => window.dispatchEvent(new CustomEvent('qm:editor:cut')),
    copy: () => window.dispatchEvent(new CustomEvent('qm:editor:copy')),
    paste: () => window.dispatchEvent(new CustomEvent('qm:editor:paste')),
  };

  const problemActions = {
    copyMessage: (msg: string) => {
      if (navigator.clipboard) navigator.clipboard.writeText(msg);
    },
    goToSource: async (file: string, line: number, column?: number) => {
      if (openFilePath) {
        await openFilePath(file);
      } else {
        const matching = openDocs.find((d) => d.filePath === file || d.title === file);
        if (matching) {
          activateDoc(matching.id);
        }
      }
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('qm:editor:gotoline', {
            detail: { line, column: column || 1 },
          })
        );
      }, 50);
    },
  };

  const clipboardActions = {
    writeText: async (text: string) => {
      if (navigator.clipboard) await navigator.clipboard.writeText(text);
    },
    readText: async () => {
      return navigator.clipboard ? await navigator.clipboard.readText() : '';
    },
  };

  const buildContext = (contextualTarget?: any): CommandContextType => ({
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
      openCommandPalette: handleOpenCommandPalette,
      resetLayout,
      toggleUiDensity,
      openWelcome,
      closeWelcome,
    },
    explorerActions,
    searchActions,
    navigationActions,
    sourceControlActions,
    terminalActions,
    taskActions,
    tabActions,
    editorActions,
    problemActions,
    clipboardActions,
    contextualTarget,
  });

  const commandContextRef = useRef<CommandContextType>(buildContext());

  // Keep commandContextRef in sync on re-renders
  commandContextRef.current = buildContext();

  const executeCommand = async (id: string, contextualTarget?: any): Promise<boolean> => {
    const ctx = contextualTarget ? buildContext(contextualTarget) : commandContextRef.current;
    return await globalCommandSurfaceRegistry.revalidateAndExecute(id, ctx);
  };

  const canExecuteCommand = (id: string, contextualTarget?: any): boolean => {
    const ctx = contextualTarget ? buildContext(contextualTarget) : commandContextRef.current;
    return globalCommandRegistry.canExecute(id, ctx);
  };

  const getCommandContext = (contextualTarget?: any): CommandContextType => {
    return contextualTarget ? buildContext(contextualTarget) : commandContextRef.current;
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
        surfaceRegistry: globalCommandSurfaceRegistry,
        executeCommand,
        canExecuteCommand,
        getCommandContext,
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
