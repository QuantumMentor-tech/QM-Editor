/**
 * QM Editor Core Types
 */

export type ThemeMode = 'dark' | 'light';

export interface DocumentModel {
  id: string;
  title: string;
  content: string;
  filePath?: string;
  language: string;
  isDirty: boolean;
  lastSavedTimestamp: number;
}

export interface TabModel {
  id: string;
  documentId: string;
  title: string;
  isDirty: boolean;
}

export interface WorkspaceState {
  documents: Record<string, DocumentModel>;
  openTabIds: string[];
  activeTabId: string | null;
  theme: ThemeMode;
  sidebarOpen: boolean;
}
