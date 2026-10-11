import { DocumentModel, ShellState } from '../../types';

export type CommandCategory = 'editor' | 'document' | 'shell' | 'workspace' | 'sourcecontrol' | 'terminal' | 'tasks' | 'help';

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
    resetLayout?: () => void;
    toggleUiDensity?: () => void;
    openWelcome?: () => void;
    closeWelcome?: () => void;
  };
  explorerActions?: {
    openWorkspace: () => void | Promise<void>;
    refreshWorkspace: () => void | Promise<void>;
    revealActiveFile: () => void;
    copyPath?: (uri: string) => void;
    copyRelativePath?: (uri: string) => void;
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
  terminalActions?: {
    newTerminal: () => void;
    togglePanel: () => void;
    clear: () => void;
    kill: () => void;
    next: () => void;
    previous: () => void;
    copy?: () => void;
    paste?: () => void;
  };
  taskActions?: {
    runTask: (taskId?: string) => void | Promise<void>;
    runBuild: () => void | Promise<void>;
    runTest: () => void | Promise<void>;
    cancel: () => void | Promise<void>;
    showTasks: () => void;
    showProblems: () => void;
  };
  editorActions?: {
    undo?: () => void;
    redo?: () => void;
    selectAll?: () => void;
    cut?: () => void;
    copy?: () => void;
    paste?: () => void;
  };
  tabActions?: {
    closeOthers?: (id: string) => void;
    closeSaved?: () => void;
    closeToTheRight?: (id: string) => void;
    copyPath?: (id: string) => void;
  };
  clipboardActions?: {
    writeText?: (text: string) => Promise<void>;
    readText?: () => Promise<string>;
  };
  problemActions?: {
    copyMessage?: (message: string) => void;
    goToSource?: (file: string, line: number, column?: number) => void;
  };
  contextualTarget?: any;
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
