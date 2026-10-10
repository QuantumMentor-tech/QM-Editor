import { Command } from './CommandTypes';

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
];
