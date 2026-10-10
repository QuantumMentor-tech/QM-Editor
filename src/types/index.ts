/**
 * QM Editor Core Types
 */

export type ThemeMode = 'dark' | 'light';
export type ShellView = 'editor' | 'settings' | 'extensions';
export type PanelView = 'output' | 'problems' | 'terminal';

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
}

export interface ShellState {
  theme: ThemeMode;
  sidebarOpen: boolean;
  sidebarWidth: number;
  panelOpen: boolean;
  activePanelView: PanelView;
  activeView: ShellView;
  dialogOpen: boolean;
  dialogTitle: string;
  dialogContent: React.ReactNode | null;
}
