/**
 * QM Editor Core Types
 */

export type ThemeMode = 'dark' | 'light';
export type ShellView = 'editor' | 'settings' | 'extensions';
export type SidebarView = 'explorer' | 'scm';
export type PanelView = 'output' | 'problems' | 'terminal';

export type WordWrapMode = 'off' | 'on';
export type WhitespaceMode = 'none' | 'all' | 'trailing';

export interface EditorSettings {
  fontSize: number;
  fontFamily: string;
  lineNumbers: boolean;
  wordWrap: WordWrapMode;
  tabSize: number;
  insertSpaces: boolean;
  bracketMatching: boolean;
  autoClosingBrackets: boolean;
  highlightActiveLine: boolean;
  whitespace: WhitespaceMode;
  folding: boolean;
  minimap: boolean;
}

export interface FileResource {
  uri: string;
  name: string;
  extension: string;
  readOnly: boolean;
  exists: boolean;
  size?: number;
  modifiedTime?: number;
  handle?: FileSystemFileHandle;
}

export interface DocumentModel {
  id: string;
  title: string;
  content: string;
  filePath?: string;
  fileResource?: FileResource;
  language: string;
  contentRevision: number;
  savedRevision: number;
  isDirty: boolean;
  lastSavedTimestamp: number;
}

export interface LanguageDefinition {
  id: string;
  displayName: string;
  aliases: string[];
  extensions: string[];
  filenames?: string[];
}

export interface SearchQuery {
  text: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface SearchMatch {
  id: string;
  from: number;
  to: number;
  line: number;
  column: number;
  preview: string;
}

export interface TreeNodeModel {
  id: string;
  name: string;
  kind: 'file' | 'directory';
  uri: string;
  parentId: string | null;
  handle?: FileSystemHandle;
  hasChildren?: boolean;
  children?: TreeNodeModel[];
  isLoaded?: boolean;
  isLoading?: boolean;
  error?: string | null;
}

export interface WorkspaceRootModel {
  id: string;
  name: string;
  uri: string;
  handle?: FileSystemDirectoryHandle;
  tree: TreeNodeModel[];
  isLoading: boolean;
  error: string | null;
}

export interface TabModel {
  id: string;
  documentId: string;
  title: string;
  isDirty: boolean;
}

export interface UserPreferences {
  theme: ThemeMode;
  sidebarOpen: boolean;
  sidebarWidth: number;
  activePanelView: PanelView;
  editor: EditorSettings;
}

export interface ShellState {
  theme: ThemeMode;
  sidebarOpen: boolean;
  sidebarWidth: number;
  sidebarView: SidebarView;
  panelOpen: boolean;
  activePanelView: PanelView;
  activeView: ShellView;
  dialogOpen: boolean;
  dialogTitle: string;
  dialogContent: React.ReactNode | null;
  editorSettings: EditorSettings;
}

export interface EditorLocation {
  documentId: string;
  filePath?: string;
  documentTitle?: string;
  line: number;
  column: number;
  timestamp?: number;
}

export interface NavigationHistoryState {
  backStack: EditorLocation[];
  forwardStack: EditorLocation[];
  currentLocation: EditorLocation | null;
}

export interface RecentDocument {
  uri: string;
  name: string;
  lastOpened: number;
  exists?: boolean;
}

export interface ApplicationSession {
  version: number;
  openFilePaths: string[];
  activeFilePath?: string;
  lastLocations: Record<string, { line: number; column: number }>;
  timestamp: number;
}
