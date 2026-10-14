/**
 * QM Editor Workspace & Project Context Engine — Types & Contracts
 * Phase 04, Step 30 — Core Workspace Subsystem
 */

export type WorkspaceState =
  | 'none'
  | 'opening'
  | 'ready'
  | 'changing'
  | 'degraded'
  | 'closing'
  | 'closed'
  | 'failed';

export interface WorkspaceCapabilities {
  filesystemAvailable: boolean;
  configurationAvailable: boolean;
  sourceControlAvailable: boolean;
  tasksAvailable: boolean;
  searchAvailable: boolean;
}

export interface WorkspaceRoot {
  rootId: string;
  uri: string;
  name: string;
  handle?: FileSystemHandle;
  isAccessible: boolean;
  isReadonly?: boolean;
}

export interface WorkspaceModel {
  id: string;
  name: string;
  roots: WorkspaceRoot[];
  configuration?: Record<string, unknown>;
  generation: number;
  state: WorkspaceState;
  capabilities: WorkspaceCapabilities;
  projectMetadata?: Record<string, unknown>;
  createdAt: number;
  lastActiveAt: number;
}

export interface WorkspaceRequestContext {
  workspaceId: string;
  generation: number;
  rootIds: string[];
}

export interface PersistedWorkspaceState {
  id: string;
  name: string;
  roots: Array<{ rootId: string; uri: string; name: string }>;
  state: WorkspaceState;
  lastActiveAt?: number;
}

export interface WorkspaceEventMap {
  'workspace.opening': { uri: string; generation: number };
  'workspace.opened': { workspaceId: string; name: string; roots: WorkspaceRoot[]; generation: number };
  'workspace.changeRequested': { fromWorkspaceId: string; toUri: string; generation: number };
  'workspace.changing': { fromWorkspaceId: string; toWorkspaceId: string; generation: number };
  'workspace.changed': { workspaceId: string; previousWorkspaceId?: string; generation: number };
  'workspace.closeRequested': { workspaceId: string; generation: number };
  'workspace.closing': { workspaceId: string; generation: number };
  'workspace.closed': { previousWorkspaceId: string; generation: number };
  'workspace.degraded': { workspaceId: string; reason: string; generation: number };
  'workspace.failed': { workspaceId?: string; error: string; generation: number };
}

export type WorkspaceEventKey = keyof WorkspaceEventMap;
export type WorkspaceEventListener<K extends WorkspaceEventKey> = (
  payload: WorkspaceEventMap[K]
) => void | Promise<void>;

export interface WorkspaceOpenOptions {
  name?: string;
  handle?: FileSystemHandle;
  force?: boolean;
  configuration?: Record<string, unknown>;
  projectMetadata?: Record<string, unknown>;
}

export type UnsavedChangesChecker = () => Promise<boolean> | boolean;

export interface SessionRestoreResult {
  readonly status: 'restored' | 'no_session' | 'stale_generation' | 'failed';
  readonly workspaceId: string;
  readonly generation: number;
  readonly restoredCount: number;
  readonly skippedPaths: string[];
  readonly activeRestored: boolean;
  readonly error?: string;
}

export interface WorkspacePersistenceConfig {
  readonly autoSaveSession?: boolean;
  readonly debounceMs?: number;
  readonly maxRecentWorkspaces?: number;
}
