import { Command } from './CommandTypes';
import { globalFocusManager } from '../accessibility/FocusManager';
import { globalEditorCoordinationService } from '../editor';

export const defaultCommands: Command[] = [
  {
    id: 'file.new',
    label: 'New File',
    category: 'document',
    shortcut: 'Mod+N',
    canExecute: () => true,
    execute: (ctx) => {
      ctx.workspaceActions.createDoc();
    },
  },
  {
    id: 'document.new',
    label: 'New Document',
    category: 'document',
    canExecute: () => true,
    execute: (ctx) => {
      ctx.workspaceActions.createDoc();
    },
  },
  {
    id: 'file.open',
    label: 'Open File...',
    category: 'document',
    shortcut: 'Mod+O',
    canExecute: (ctx) => Boolean(ctx.workspaceActions.openFile),
    execute: async (ctx) => {
      if (ctx.workspaceActions.openFile) {
        await ctx.workspaceActions.openFile();
      }
    },
  },
  {
    id: 'workspace.open',
    label: 'Open Workspace Folder...',
    category: 'workspace',
    shortcut: 'Mod+Shift+O',
    canExecute: (ctx) => Boolean(ctx.explorerActions?.openWorkspace),
    execute: async (ctx) => {
      if (ctx.explorerActions?.openWorkspace) {
        await ctx.explorerActions.openWorkspace();
      }
    },
  },
  {
    id: 'explorer.refresh',
    label: 'Refresh File Explorer',
    category: 'workspace',
    canExecute: (ctx) => Boolean(ctx.explorerActions?.refreshWorkspace),
    execute: async (ctx) => {
      if (ctx.explorerActions?.refreshWorkspace) {
        await ctx.explorerActions.refreshWorkspace();
      }
    },
  },
  {
    id: 'explorer.revealActiveFile',
    label: 'Reveal Active File in Explorer',
    category: 'workspace',
    shortcut: 'Alt+Shift+R',
    canExecute: (ctx) => Boolean(ctx.activeDoc && ctx.explorerActions?.revealActiveFile),
    execute: (ctx) => {
      if (ctx.explorerActions?.revealActiveFile) {
        ctx.explorerActions.revealActiveFile();
      }
    },
  },
  {
    id: 'search.open',
    label: 'Find in Active Document',
    category: 'editor',
    shortcut: 'Mod+F',
    canExecute: (ctx) => Boolean(ctx.activeDoc && ctx.searchActions?.openSearch),
    execute: (ctx) => {
      if (ctx.searchActions?.openSearch) {
        ctx.searchActions.openSearch(false);
      }
    },
  },
  {
    id: 'search.replace',
    label: 'Replace in Active Document',
    category: 'editor',
    shortcut: 'Mod+H',
    canExecute: (ctx) => Boolean(ctx.activeDoc && ctx.searchActions?.openSearch),
    execute: (ctx) => {
      if (ctx.searchActions?.openSearch) {
        ctx.searchActions.openSearch(true);
      }
    },
  },
  {
    id: 'search.findNext',
    label: 'Find Next Match',
    category: 'editor',
    shortcut: 'F3',
    canExecute: (ctx) => Boolean(ctx.activeDoc && ctx.searchActions?.findNext),
    execute: (ctx) => {
      if (ctx.searchActions?.findNext) {
        ctx.searchActions.findNext();
      }
    },
  },
  {
    id: 'search.findPrevious',
    label: 'Find Previous Match',
    category: 'editor',
    shortcut: 'Shift+F3',
    canExecute: (ctx) => Boolean(ctx.activeDoc && ctx.searchActions?.findPrevious),
    execute: (ctx) => {
      if (ctx.searchActions?.findPrevious) {
        ctx.searchActions.findPrevious();
      }
    },
  },
  {
    id: 'search.replaceAll',
    label: 'Replace All in Active Document',
    category: 'editor',
    canExecute: (ctx) => Boolean(ctx.activeDoc && !ctx.activeDoc.fileResource?.readOnly && ctx.searchActions?.replaceAll),
    execute: (ctx) => {
      if (ctx.searchActions?.replaceAll) {
        ctx.searchActions.replaceAll();
      }
    },
  },
  {
    id: 'search.close',
    label: 'Close Search Panel',
    category: 'editor',
    canExecute: (ctx) => Boolean(ctx.searchActions?.closeSearch),
    execute: (ctx) => {
      if (ctx.searchActions?.closeSearch) {
        ctx.searchActions.closeSearch();
      }
    },
  },
  {
    id: 'workbench.action.findInFiles',
    label: 'Find in Files...',
    category: 'editor',
    shortcut: 'Mod+Shift+F',
    description: 'Search text content across all files in the active workspace',
    canExecute: (ctx) => Boolean(ctx.searchActions?.workspaceFind),
    execute: (ctx) => {
      if (ctx.searchActions?.workspaceFind) {
        ctx.searchActions.workspaceFind();
      }
    },
  },
  {
    id: 'search.workspaceReplace',
    label: 'Replace in Files...',
    category: 'editor',
    shortcut: 'Mod+Shift+H',
    description: 'Search and replace text content across all files in the active workspace',
    canExecute: (ctx) => Boolean(ctx.searchActions?.workspaceReplace),
    execute: (ctx) => {
      if (ctx.searchActions?.workspaceReplace) {
        ctx.searchActions.workspaceReplace();
      }
    },
  },
  {
    id: 'file.save',
    label: 'Save Active Document',
    category: 'document',
    shortcut: 'Mod+S',
    canExecute: (ctx) => Boolean(ctx.activeDoc && ctx.activeDoc.isDirty),
    execute: async (ctx) => {
      if (ctx.activeDoc) {
        await ctx.workspaceActions.saveDoc(ctx.activeDoc.id);
      }
    },
  },
  {
    id: 'document.save',
    label: 'Save Active Document',
    category: 'document',
    canExecute: (ctx) => Boolean(ctx.activeDoc && ctx.activeDoc.isDirty),
    execute: async (ctx) => {
      if (ctx.activeDoc) {
        await ctx.workspaceActions.saveDoc(ctx.activeDoc.id);
      }
    },
  },
  {
    id: 'file.saveAs',
    label: 'Save As...',
    category: 'document',
    shortcut: 'Mod+Shift+S',
    canExecute: (ctx) => Boolean(ctx.activeDoc && ctx.workspaceActions.saveDocAs),
    execute: async (ctx) => {
      if (ctx.activeDoc && ctx.workspaceActions.saveDocAs) {
        await ctx.workspaceActions.saveDocAs(ctx.activeDoc.id);
      }
    },
  },
  {
    id: 'document.close',
    label: 'Close Active Document',
    category: 'document',
    shortcut: 'Mod+W',
    canExecute: (ctx) => Boolean(ctx.activeDoc),
    execute: (ctx) => {
      if (ctx.activeDoc) {
        ctx.workspaceActions.closeDoc(ctx.activeDoc.id);
      }
    },
  },
  {
    id: 'shell.toggleSidebar',
    label: 'Toggle Sidebar Explorer',
    category: 'shell',
    shortcut: 'Mod+B',
    canExecute: () => true,
    execute: (ctx) => {
      ctx.shellActions.toggleSidebar();
    },
  },
  {
    id: 'shell.togglePanel',
    label: 'Toggle Console Panel',
    category: 'shell',
    shortcut: 'Mod+J',
    canExecute: () => true,
    execute: (ctx) => {
      ctx.shellActions.togglePanel();
    },
  },
  {
    id: 'shell.toggleTheme',
    label: 'Toggle Theme Mode',
    category: 'shell',
    shortcut: 'Mod+Shift+T',
    canExecute: () => true,
    execute: (ctx) => {
      ctx.shellActions.toggleTheme();
    },
  },
  {
    id: 'editor.zoomIn',
    label: 'Zoom In (Increase Font Size)',
    category: 'editor',
    shortcut: 'Mod+=',
    canExecute: (ctx) => Boolean(ctx.shellActions.zoomIn),
    execute: (ctx) => {
      if (ctx.shellActions.zoomIn) ctx.shellActions.zoomIn();
    },
  },
  {
    id: 'editor.zoomOut',
    label: 'Zoom Out (Decrease Font Size)',
    category: 'editor',
    shortcut: 'Mod+-',
    canExecute: (ctx) => Boolean(ctx.shellActions.zoomOut),
    execute: (ctx) => {
      if (ctx.shellActions.zoomOut) ctx.shellActions.zoomOut();
    },
  },
  {
    id: 'editor.zoomReset',
    label: 'Reset Zoom (Default Font Size)',
    category: 'editor',
    shortcut: 'Mod+0',
    canExecute: (ctx) => Boolean(ctx.shellActions.zoomReset),
    execute: (ctx) => {
      if (ctx.shellActions.zoomReset) ctx.shellActions.zoomReset();
    },
  },
  {
    id: 'editor.toggleWordWrap',
    label: 'Toggle Word Wrap',
    category: 'editor',
    shortcut: 'Alt+Z',
    canExecute: (ctx) => Boolean(ctx.shellActions.toggleWordWrap),
    execute: (ctx) => {
      if (ctx.shellActions.toggleWordWrap) ctx.shellActions.toggleWordWrap();
    },
  },
  {
    id: 'editor.toggleLineNumbers',
    label: 'Toggle Line Numbers',
    category: 'editor',
    canExecute: (ctx) => Boolean(ctx.shellActions.toggleLineNumbers),
    execute: (ctx) => {
      if (ctx.shellActions.toggleLineNumbers) ctx.shellActions.toggleLineNumbers();
    },
  },
  {
    id: 'editor.toggleWhitespace',
    label: 'Toggle Whitespace Visibility',
    category: 'editor',
    canExecute: (ctx) => Boolean(ctx.shellActions.toggleWhitespace),
    execute: (ctx) => {
      if (ctx.shellActions.toggleWhitespace) ctx.shellActions.toggleWhitespace();
    },
  },
  {
    id: 'editor.toggleFolding',
    label: 'Toggle Code Folding Gutter',
    category: 'editor',
    canExecute: (ctx) => Boolean(ctx.shellActions.toggleFolding),
    execute: (ctx) => {
      if (ctx.shellActions.toggleFolding) ctx.shellActions.toggleFolding();
    },
  },
  {
    id: 'workbench.action.openSettings',
    label: 'Preferences: Open Editor Settings',
    category: 'shell',
    shortcut: 'Mod+,',
    canExecute: (ctx) => Boolean(ctx.shellActions.openSettings),
    execute: (ctx) => {
      if (ctx.shellActions.openSettings) ctx.shellActions.openSettings();
    },
  },
  {
    id: 'navigation.goToLine',
    label: 'Go to Line / Column...',
    category: 'editor',
    shortcut: 'Mod+G',
    canExecute: (ctx) => Boolean(ctx.activeDoc && ctx.navigationActions?.goToLine),
    execute: (ctx) => {
      if (ctx.navigationActions?.goToLine) ctx.navigationActions.goToLine();
    },
  },
  {
    id: 'navigation.back',
    label: 'Navigate Back',
    category: 'editor',
    shortcut: 'Alt+Left',
    canExecute: (ctx) => Boolean(ctx.navigationActions?.canNavigateBack),
    execute: (ctx) => {
      if (ctx.navigationActions?.navigateBack) ctx.navigationActions.navigateBack();
    },
  },
  {
    id: 'navigation.forward',
    label: 'Navigate Forward',
    category: 'editor',
    shortcut: 'Alt+Right',
    canExecute: (ctx) => Boolean(ctx.navigationActions?.canNavigateForward),
    execute: (ctx) => {
      if (ctx.navigationActions?.navigateForward) ctx.navigationActions.navigateForward();
    },
  },
  {
    id: 'workbench.action.showCommands',
    label: 'Command Palette...',
    category: 'shell',
    shortcut: 'Mod+Shift+P',
    description: 'Search and execute editor & workbench commands',
    canExecute: () => true,
    execute: (ctx) => {
      if (ctx.shellActions.openCommandPalette) {
        ctx.shellActions.openCommandPalette();
      }
    },
  },
  {
    id: 'workbench.action.quickOpen',
    label: 'Go to File...',
    category: 'document',
    shortcut: 'Mod+P',
    description: 'Quick Open workspace file by name or relative path',
    canExecute: (ctx) => Boolean(ctx.navigationActions?.quickOpen),
    execute: (ctx) => {
      if (ctx.navigationActions?.quickOpen) ctx.navigationActions.quickOpen();
    },
  },
  {
    id: 'quickOpen.open',
    label: 'Quick Open Resource...',
    category: 'document',
    description: 'Fast workspace resource navigation and file search',
    canExecute: (ctx) => Boolean(ctx.navigationActions?.quickOpen),
    execute: (ctx) => {
      if (ctx.navigationActions?.quickOpen) ctx.navigationActions.quickOpen();
    },
  },
  {
    id: 'workbench.action.gotoSymbol',
    label: 'Go to Symbol in Editor...',
    category: 'editor',
    shortcut: 'Mod+Shift+O',
    description: 'Search and navigate to symbols within the active document',
    canExecute: (ctx) => Boolean(ctx.activeDoc && ctx.navigationActions?.gotoSymbol),
    execute: (ctx) => {
      if (ctx.navigationActions?.gotoSymbol) ctx.navigationActions.gotoSymbol('document');
    },
  },
  {
    id: 'workbench.action.showAllSymbols',
    label: 'Go to Symbol in Workspace...',
    category: 'workspace',
    shortcut: 'Mod+T',
    description: 'Search and navigate to symbols across the active workspace',
    canExecute: (ctx) => Boolean(ctx.navigationActions?.gotoSymbol),
    execute: (ctx) => {
      if (ctx.navigationActions?.gotoSymbol) ctx.navigationActions.gotoSymbol('workspace');
    },
  },
  {
    id: 'outline.focus',
    label: 'View: Focus Outline View',
    category: 'shell',
    description: 'Open and focus the document symbol outline view in the sidebar',
    canExecute: (ctx) => Boolean(ctx.navigationActions?.focusOutline),
    execute: (ctx) => {
      if (ctx.navigationActions?.focusOutline) ctx.navigationActions.focusOutline();
    },
  },
  {
    id: 'file.openRecent',
    label: 'Open Recent File...',
    category: 'document',
    shortcut: 'Mod+Shift+R',
    description: 'Open recently accessed documents',
    canExecute: (ctx) => Boolean(ctx.navigationActions?.openRecent),
    execute: (ctx) => {
      if (ctx.navigationActions?.openRecent) ctx.navigationActions.openRecent();
    },
  },
  {
    id: 'sourceControl.openPanel',
    label: 'Source Control: Focus on Source Control View',
    category: 'sourcecontrol',
    shortcut: 'Mod+Shift+G',
    description: 'Open and focus the Source Control panel in the sidebar',
    canExecute: (ctx) => Boolean(ctx.sourceControlActions?.openPanel),
    execute: (ctx) => {
      if (ctx.sourceControlActions?.openPanel) ctx.sourceControlActions.openPanel();
    },
  },
  {
    id: 'sourceControl.refresh',
    label: 'Source Control: Refresh Repository Status',
    category: 'sourcecontrol',
    description: 'Re-scan Git repository working tree and status',
    canExecute: (ctx) => Boolean(ctx.sourceControlActions?.refresh),
    execute: async (ctx) => {
      if (ctx.sourceControlActions?.refresh) await ctx.sourceControlActions.refresh();
    },
  },
  {
    id: 'sourceControl.openDiff',
    label: 'Source Control: Inspect Working Tree Diff',
    category: 'sourcecontrol',
    description: 'Open read-only diff inspection for the active document',
    canExecute: (ctx) => Boolean(ctx.activeDoc && ctx.sourceControlActions?.openDiff),
    execute: async (ctx) => {
      if (ctx.sourceControlActions?.openDiff) await ctx.sourceControlActions.openDiff();
    },
  },
  {
    id: 'terminal.new',
    label: 'Terminal: Create New Terminal',
    category: 'terminal',
    shortcut: 'Mod+Shift+`',
    description: 'Create and open a new terminal session',
    canExecute: (ctx) => Boolean(ctx.terminalActions?.newTerminal),
    execute: (ctx) => {
      if (ctx.terminalActions?.newTerminal) ctx.terminalActions.newTerminal();
    },
  },
  {
    id: 'workbench.action.terminal.new',
    label: 'Terminal: Create New Terminal',
    category: 'terminal',
    shortcut: 'Mod+Shift+`',
    description: 'Create and open a new terminal session',
    canExecute: (ctx) => Boolean(ctx.terminalActions?.newTerminal),
    execute: (ctx) => {
      if (ctx.terminalActions?.newTerminal) ctx.terminalActions.newTerminal();
    },
  },
  {
    id: 'terminal.togglePanel',
    label: 'Terminal: Toggle Terminal Panel',
    category: 'terminal',
    shortcut: 'Mod+`',
    description: 'Show or hide the integrated terminal panel',
    canExecute: (ctx) => Boolean(ctx.terminalActions?.togglePanel),
    execute: (ctx) => {
      if (ctx.terminalActions?.togglePanel) ctx.terminalActions.togglePanel();
    },
  },
  {
    id: 'workbench.action.terminal.toggleTerminal',
    label: 'Terminal: Toggle Terminal Panel',
    category: 'terminal',
    shortcut: 'Mod+`',
    description: 'Show or hide the integrated terminal panel',
    canExecute: (ctx) => Boolean(ctx.terminalActions?.togglePanel),
    execute: (ctx) => {
      if (ctx.terminalActions?.togglePanel) ctx.terminalActions.togglePanel();
    },
  },
  {
    id: 'terminal.clear',
    label: 'Terminal: Clear Terminal Display',
    category: 'terminal',
    description: 'Clear output buffer of active terminal',
    canExecute: (ctx) => Boolean(ctx.terminalActions?.clear),
    execute: (ctx) => {
      if (ctx.terminalActions?.clear) ctx.terminalActions.clear();
    },
  },
  {
    id: 'terminal.kill',
    label: 'Terminal: Kill Active Terminal Process',
    category: 'terminal',
    description: 'Terminate active terminal process',
    canExecute: (ctx) => Boolean(ctx.terminalActions?.kill),
    execute: (ctx) => {
      if (ctx.terminalActions?.kill) ctx.terminalActions.kill();
    },
  },
  {
    id: 'terminal.next',
    label: 'Terminal: Focus Next Terminal',
    category: 'terminal',
    description: 'Switch to next terminal session',
    canExecute: (ctx) => Boolean(ctx.terminalActions?.next),
    execute: (ctx) => {
      if (ctx.terminalActions?.next) ctx.terminalActions.next();
    },
  },
  {
    id: 'terminal.previous',
    label: 'Terminal: Focus Previous Terminal',
    category: 'terminal',
    description: 'Switch to previous terminal session',
    canExecute: (ctx) => Boolean(ctx.terminalActions?.previous),
    execute: (ctx) => {
      if (ctx.terminalActions?.previous) ctx.terminalActions.previous();
    },
  },
  {
    id: 'task.run',
    label: 'Tasks: Run Task...',
    category: 'tasks',
    description: 'Select and run a project task',
    canExecute: (ctx) => Boolean(ctx.taskActions?.runTask),
    execute: async (ctx) => {
      if (ctx.taskActions?.runTask) await ctx.taskActions.runTask();
    },
  },
  {
    id: 'task.build',
    label: 'Tasks: Run Build Task',
    category: 'tasks',
    shortcut: 'Mod+Shift+B',
    description: 'Run project default build task',
    canExecute: (ctx) => Boolean(ctx.taskActions?.runBuild),
    execute: async (ctx) => {
      if (ctx.taskActions?.runBuild) await ctx.taskActions.runBuild();
    },
  },
  {
    id: 'task.test',
    label: 'Tasks: Run Test Task',
    category: 'tasks',
    description: 'Run project test suite',
    canExecute: (ctx) => Boolean(ctx.taskActions?.runTest),
    execute: async (ctx) => {
      if (ctx.taskActions?.runTest) await ctx.taskActions.runTest();
    },
  },
  {
    id: 'task.cancel',
    label: 'Tasks: Cancel Running Task',
    category: 'tasks',
    description: 'Cancel currently executing task process',
    canExecute: (ctx) => Boolean(ctx.taskActions?.cancel),
    execute: async (ctx) => {
      if (ctx.taskActions?.cancel) await ctx.taskActions.cancel();
    },
  },
  {
    id: 'task.showTasks',
    label: 'Tasks: Show Tasks Panel',
    category: 'tasks',
    description: 'Open the tasks execution panel in bottom view',
    canExecute: (ctx) => Boolean(ctx.taskActions?.showTasks),
    execute: (ctx) => {
      if (ctx.taskActions?.showTasks) ctx.taskActions.showTasks();
    },
  },
  {
    id: 'task.showProblems',
    label: 'Tasks: Show Problems Panel',
    category: 'tasks',
    description: 'Open the problem diagnostics panel in bottom view',
    canExecute: (ctx) => Boolean(ctx.taskActions?.showProblems),
    execute: (ctx) => {
      if (ctx.taskActions?.showProblems) ctx.taskActions.showProblems();
    },
  },
  {
    id: 'editor.undo',
    label: 'Undo',
    category: 'editor',
    shortcut: 'Mod+Z',
    aliases: ['edit.undo'],
    description: 'Undo the last editing action in the active document',
    canExecute: (ctx) =>
      Boolean(
        ctx.activeDoc &&
          !ctx.activeDoc.fileResource?.readOnly &&
          globalEditorCoordinationService.canUndo(ctx.activeDoc.id)
      ),
    execute: async (ctx) => {
      if (ctx.activeDoc) {
        await globalEditorCoordinationService.undo(ctx.activeDoc.id);
      } else if (ctx.editorActions?.undo) {
        ctx.editorActions.undo();
      }
    },
  },
  {
    id: 'editor.redo',
    label: 'Redo',
    category: 'editor',
    shortcut: 'Mod+Y',
    aliases: ['edit.redo'],
    description: 'Redo the last undone editing action',
    canExecute: (ctx) =>
      Boolean(
        ctx.activeDoc &&
          !ctx.activeDoc.fileResource?.readOnly &&
          globalEditorCoordinationService.canRedo(ctx.activeDoc.id)
      ),
    execute: async (ctx) => {
      if (ctx.activeDoc) {
        await globalEditorCoordinationService.redo(ctx.activeDoc.id);
      } else if (ctx.editorActions?.redo) {
        ctx.editorActions.redo();
      }
    },
  },
  {
    id: 'editor.cut',
    label: 'Cut',
    category: 'editor',
    shortcut: 'Mod+X',
    description: 'Cut selected text to system clipboard',
    canExecute: (ctx) => Boolean(ctx.activeDoc && !ctx.activeDoc.fileResource?.readOnly),
    execute: (ctx) => {
      if (ctx.editorActions?.cut) {
        ctx.editorActions.cut();
      } else {
        window.dispatchEvent(new CustomEvent('qm:editor:cut'));
      }
    },
  },
  {
    id: 'editor.copy',
    label: 'Copy',
    category: 'editor',
    shortcut: 'Mod+C',
    description: 'Copy selected text to system clipboard',
    canExecute: (ctx) => Boolean(ctx.activeDoc),
    execute: (ctx) => {
      if (ctx.editorActions?.copy) {
        ctx.editorActions.copy();
      } else {
        window.dispatchEvent(new CustomEvent('qm:editor:copy'));
      }
    },
  },
  {
    id: 'editor.paste',
    label: 'Paste',
    category: 'editor',
    shortcut: 'Mod+V',
    description: 'Paste text from system clipboard',
    canExecute: (ctx) => Boolean(ctx.activeDoc && !ctx.activeDoc.fileResource?.readOnly),
    execute: (ctx) => {
      if (ctx.editorActions?.paste) {
        ctx.editorActions.paste();
      } else {
        window.dispatchEvent(new CustomEvent('qm:editor:paste'));
      }
    },
  },
  {
    id: 'editor.selectAll',
    label: 'Select All',
    category: 'editor',
    shortcut: 'Mod+A',
    description: 'Select all content in the active document',
    canExecute: (ctx) => Boolean(ctx.activeDoc),
    execute: (ctx) => {
      if (ctx.editorActions?.selectAll) {
        ctx.editorActions.selectAll();
      } else {
        window.dispatchEvent(new CustomEvent('qm:editor:selectall'));
      }
    },
  },
  {
    id: 'tabs.closeOthers',
    label: 'Close Other Tabs',
    category: 'document',
    description: 'Close all open document tabs except the active or targeted document',
    canExecute: (ctx) => Boolean(ctx.tabActions?.closeOthers || ctx.activeDoc),
    execute: (ctx) => {
      const targetId = ctx.contextualTarget?.documentId || ctx.activeDoc?.id;
      if (targetId && ctx.tabActions?.closeOthers) {
        ctx.tabActions.closeOthers(targetId);
      }
    },
  },
  {
    id: 'tabs.closeSaved',
    label: 'Close Saved Tabs',
    category: 'document',
    description: 'Close all tabs with clean, saved content',
    canExecute: (ctx) => Boolean(ctx.tabActions?.closeSaved),
    execute: (ctx) => {
      if (ctx.tabActions?.closeSaved) {
        ctx.tabActions.closeSaved();
      }
    },
  },
  {
    id: 'tabs.closeToRight',
    label: 'Close Tabs to the Right',
    category: 'document',
    description: 'Close all tabs positioned to the right of the targeted tab',
    canExecute: (ctx) => Boolean(ctx.tabActions?.closeToTheRight || ctx.activeDoc),
    execute: (ctx) => {
      const targetId = ctx.contextualTarget?.documentId || ctx.activeDoc?.id;
      if (targetId && ctx.tabActions?.closeToTheRight) {
        ctx.tabActions.closeToTheRight(targetId);
      }
    },
  },
  {
    id: 'tabs.copyPath',
    label: 'Copy Path',
    category: 'document',
    description: 'Copy document absolute path to clipboard',
    canExecute: (ctx) => Boolean(ctx.contextualTarget?.filePath || ctx.activeDoc?.filePath || ctx.activeDoc?.fileResource?.uri),
    execute: (ctx) => {
      const path = ctx.contextualTarget?.filePath || ctx.activeDoc?.filePath || ctx.activeDoc?.fileResource?.uri;
      if (path && ctx.tabActions?.copyPath) {
        ctx.tabActions.copyPath(path);
      } else if (path && navigator.clipboard) {
        navigator.clipboard.writeText(path);
      }
    },
  },
  {
    id: 'explorer.copyPath',
    label: 'Copy Path',
    category: 'workspace',
    description: 'Copy explorer resource path to clipboard',
    canExecute: (ctx) => Boolean(ctx.contextualTarget?.uri || ctx.activeDoc?.fileResource?.uri),
    execute: (ctx) => {
      const targetUri = ctx.contextualTarget?.uri || ctx.activeDoc?.fileResource?.uri || '';
      if (targetUri && ctx.explorerActions?.copyPath) {
        ctx.explorerActions.copyPath(targetUri);
      } else if (targetUri && navigator.clipboard) {
        navigator.clipboard.writeText(targetUri);
      }
    },
  },
  {
    id: 'explorer.copyRelativePath',
    label: 'Copy Relative Path',
    category: 'workspace',
    description: 'Copy explorer resource relative path to clipboard',
    canExecute: (ctx) => Boolean(ctx.contextualTarget?.uri || ctx.activeDoc?.fileResource?.uri),
    execute: (ctx) => {
      const targetUri = ctx.contextualTarget?.uri || ctx.activeDoc?.fileResource?.uri || '';
      if (targetUri && ctx.explorerActions?.copyRelativePath) {
        ctx.explorerActions.copyRelativePath(targetUri);
      } else if (targetUri && navigator.clipboard) {
        navigator.clipboard.writeText(targetUri);
      }
    },
  },
  {
    id: 'terminal.copy',
    label: 'Copy Terminal Selection',
    category: 'terminal',
    shortcut: 'Mod+Shift+C',
    description: 'Copy selected terminal output text',
    canExecute: (ctx) => Boolean(ctx.terminalActions?.copy),
    execute: (ctx) => {
      if (ctx.terminalActions?.copy) ctx.terminalActions.copy();
    },
  },
  {
    id: 'terminal.paste',
    label: 'Paste into Terminal',
    category: 'terminal',
    shortcut: 'Mod+Shift+V',
    description: 'Paste text from clipboard into active terminal',
    canExecute: (ctx) => Boolean(ctx.terminalActions?.paste),
    execute: (ctx) => {
      if (ctx.terminalActions?.paste) ctx.terminalActions.paste();
    },
  },
  {
    id: 'problems.goToSource',
    label: 'Go to Problem Source',
    category: 'tasks',
    description: 'Open file and jump to problem diagnostic location',
    canExecute: (ctx) => Boolean(ctx.contextualTarget?.file && ctx.problemActions?.goToSource),
    execute: (ctx) => {
      const p = ctx.contextualTarget;
      if (p && ctx.problemActions?.goToSource) {
        ctx.problemActions.goToSource(p.file, p.line, p.column);
      }
    },
  },
  {
    id: 'problems.copyMessage',
    label: 'Copy Problem Message',
    category: 'tasks',
    description: 'Copy problem diagnostic message to clipboard',
    canExecute: (ctx) => Boolean(ctx.contextualTarget?.message && ctx.problemActions?.copyMessage),
    execute: (ctx) => {
      const p = ctx.contextualTarget;
      if (p && ctx.problemActions?.copyMessage) {
        ctx.problemActions.copyMessage(p.message);
      } else if (p?.message && navigator.clipboard) {
        navigator.clipboard.writeText(p.message);
      }
    },
  },
  {
    id: 'help.about',
    label: 'About QM Editor',
    category: 'help',
    description: 'View QM Editor product and version details',
    canExecute: () => true,
    execute: () => {
      window.dispatchEvent(new CustomEvent('qm:show:about'));
    },
  },
  {
    id: 'workbench.action.focusExplorer',
    label: 'Focus File Explorer',
    category: 'workspace',
    shortcut: 'Mod+Shift+E',
    description: 'Move keyboard focus into the File Explorer tree',
    canExecute: () => true,
    execute: () => {
      globalFocusManager.focusRegion('explorer');
    },
  },
  {
    id: 'workbench.action.focusEditor',
    label: 'Focus Active Editor',
    category: 'editor',
    shortcut: 'Mod+1',
    description: 'Move keyboard focus into the active document editor',
    canExecute: (ctx) => Boolean(ctx.activeDoc),
    execute: () => {
      globalFocusManager.focusRegion('editor');
    },
  },
  {
    id: 'workbench.action.focusTerminal',
    label: 'Focus Terminal',
    category: 'terminal',
    shortcut: 'Mod+`',
    description: 'Move keyboard focus into the integrated terminal',
    canExecute: () => true,
    execute: (ctx) => {
      if (!ctx.shellState.panelOpen) {
        ctx.shellActions.togglePanel();
      }
      globalFocusManager.focusRegion('terminal');
    },
  },
  {
    id: 'workbench.action.focusProblems',
    label: 'Focus Problems Panel',
    category: 'tasks',
    shortcut: 'Mod+Shift+M',
    description: 'Move keyboard focus into the Problems diagnostics panel',
    canExecute: () => true,
    execute: (ctx) => {
      if (!ctx.shellState.panelOpen) {
        ctx.shellActions.togglePanel();
      }
      globalFocusManager.focusRegion('problems');
    },
  },
  {
    id: 'workbench.action.focusSettings',
    label: 'Focus Settings',
    category: 'shell',
    description: 'Open and focus the unified settings dialog',
    canExecute: (ctx) => Boolean(ctx.shellActions.openSettings),
    execute: (ctx) => {
      if (ctx.shellActions.openSettings) {
        ctx.shellActions.openSettings();
      }
      globalFocusManager.focusRegion('settings');
    },
  },
  {
    id: 'workbench.action.resetLayout',
    label: 'View: Reset Layout to Defaults',
    category: 'shell',
    description: 'Reset sidebar width, console panel height, and UI density to default values',
    canExecute: (ctx) => Boolean(ctx.shellActions.resetLayout),
    execute: (ctx) => {
      if (ctx.shellActions.resetLayout) {
        ctx.shellActions.resetLayout();
      }
    },
  },
  {
    id: 'workbench.action.toggleDensity',
    label: 'View: Toggle UI Density',
    category: 'shell',
    description: 'Switch between comfortable and compact user interface density',
    canExecute: (ctx) => Boolean(ctx.shellActions.toggleUiDensity),
    execute: (ctx) => {
      if (ctx.shellActions.toggleUiDensity) {
        ctx.shellActions.toggleUiDensity();
      }
    },
  },
  {
    id: 'workbench.action.openWelcome',
    label: 'Help: Welcome (Start Center)',
    category: 'shell',
    description: 'Open the QM Editor Start Center and Welcome screen',
    canExecute: (ctx) => Boolean(ctx.shellActions.openWelcome),
    execute: (ctx) => {
      if (ctx.shellActions.openWelcome) {
        ctx.shellActions.openWelcome();
      }
    },
  },
  {
    id: 'workbench.action.closeWelcome',
    label: 'View: Close Welcome',
    category: 'shell',
    description: 'Close the Welcome screen and return to the code editor',
    canExecute: (ctx) => Boolean(ctx.shellActions.closeWelcome),
    execute: (ctx) => {
      if (ctx.shellActions.closeWelcome) {
        ctx.shellActions.closeWelcome();
      }
    },
  },
];

