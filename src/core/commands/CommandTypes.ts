import { DocumentModel, ShellState } from '../../types';

export type CommandCategory = 'editor' | 'document' | 'shell' | 'workspace' | 'sourcecontrol';

export interface CommandContext {
  activeDoc: DocumentModel | null;
  shellState: ShellState;
  workspaceActions: {
    saveDoc: (id: string) => void | Promise<void>;
    saveDocAs?: (id: string) => void | Promise<void>;
    createDoc: (title?: string, content?: string) => void;
    openFile?: () => void | Promise<void>;
    closeDoc: (id: string) => void;
    activateDoc: (id: string) => void;
  };
  shellActions: {
    toggleSidebar: () => void;
    togglePanel: () => void;
    toggleTheme: () => void;
    zoomIn?: () => void;
    zoomOut?: () => void;
    zoomReset?: () => void;
    toggleWordWrap?: () => void;
    toggleLineNumbers?: () => void;
    toggleWhitespace?: () => void;
    toggleFolding?: () => void;
    openSettings?: () => void;
    openCommandPalette?: () => void;
  };
  explorerActions?: {
    openWorkspace: () => void | Promise<void>;
    refreshWorkspace: () => void | Promise<void>;
    revealActiveFile: () => void;
  };
  searchActions?: {
    openSearch: (withReplace?: boolean) => void;
    closeSearch: () => void;
    findNext: () => void;
    findPrevious: () => void;
    replaceCurrent: () => void;
    replaceAll: () => void;
    workspaceFind?: () => void;
    workspaceReplace?: () => void;
  };
  navigationActions?: {
    goToLine: () => void;
    navigateBack: () => void;
    navigateForward: () => void;
    openRecent: () => void;
    quickOpen?: () => void;
    canNavigateBack: boolean;
    canNavigateForward: boolean;
  };
  sourceControlActions?: {
    openPanel: () => void;
    refresh: () => void | Promise<void>;
    openDiff?: () => void | Promise<void>;
  };
}

export interface Command {
  id: string;
  label: string;
  category: CommandCategory;
  shortcut?: string;
  description?: string;
  aliases?: string[];
  canExecute?: (ctx: CommandContext) => boolean;
  execute: (ctx: CommandContext) => void | Promise<void>;
}

export interface CommandRegistryInterface {
  register(command: Command): void;
  get(id: string): Command | undefined;
  getAll(): Command[];
  canExecute(id: string, ctx: CommandContext): boolean;
  execute(id: string, ctx: CommandContext): Promise<void>;
}
