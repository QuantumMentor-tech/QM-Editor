/**
 * QM Editor Source Control Context & React Provider
 * Phase 1, Step 18 — Git Integration & Source Control Foundation
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { GitRepositoryState, SourceControlDiffResult } from '../core/source-control/SourceControlTypes';
import { sourceControlService } from '../core/source-control/SourceControlService';
import { useExplorer } from './ExplorerContext';
import { useWorkspace } from './WorkspaceContext';

export interface SourceControlContextApi {
  state: GitRepositoryState;
  refresh: () => Promise<GitRepositoryState>;
  getDiff: (fileUri: string) => Promise<SourceControlDiffResult>;
  updateFileStatus: (fileUri: string, status: 'modified' | 'untracked' | 'staged' | 'deleted' | 'unmodified') => void;
}

const SourceControlContext = createContext<SourceControlContextApi | undefined>(undefined);

export const SourceControlProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { workspaceRoot } = useExplorer();
  const { activeDoc, openDocs } = useWorkspace();
  const [state, setState] = useState<GitRepositoryState>(() => sourceControlService.getState());

  useEffect(() => {
    const unsubscribe = sourceControlService.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  const refresh = useCallback(async (): Promise<GitRepositoryState> => {
    return await sourceControlService.refresh(workspaceRoot);
  }, [workspaceRoot]);

  const getDiff = useCallback(
    async (fileUri: string): Promise<SourceControlDiffResult> => {
      return await sourceControlService.getDiff(fileUri, workspaceRoot);
    },
    [workspaceRoot]
  );

  const updateFileStatus = useCallback(
    (fileUri: string, status: 'modified' | 'untracked' | 'staged' | 'deleted' | 'unmodified') => {
      sourceControlService.updateFileStatus(fileUri, status);
    },
    []
  );

  // Auto-refresh when workspaceRoot changes
  useEffect(() => {
    refresh();
  }, [workspaceRoot, refresh]);

  // Keep modified file status in sync with open dirty documents
  useEffect(() => {
    openDocs.forEach((doc) => {
      const uri = doc.fileResource?.uri || doc.filePath;
      if (uri) {
        if (doc.isDirty) {
          sourceControlService.updateFileStatus(uri, 'modified');
        }
      }
    });
  }, [openDocs, activeDoc?.isDirty]);

  return (
    <SourceControlContext.Provider
      value={{
        state,
        refresh,
        getDiff,
        updateFileStatus,
      }}
    >
      {children}
    </SourceControlContext.Provider>
  );
};

export const useSourceControl = (): SourceControlContextApi => {
  const context = useContext(SourceControlContext);
  if (!context) {
    throw new Error('useSourceControl must be used within a SourceControlProvider');
  }
  return context;
};
