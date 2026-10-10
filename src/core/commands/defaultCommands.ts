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
