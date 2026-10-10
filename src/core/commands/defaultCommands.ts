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
];
