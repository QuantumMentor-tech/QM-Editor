import React, { createContext, useContext, useState, useEffect } from 'react';
import { TreeNodeModel, WorkspaceRootModel } from '../types';
import { workspaceService } from '../services/WorkspaceService';
import { fileService } from '../services/FileService';
import { useWorkspace } from './WorkspaceContext';
import { createNewDocument } from '../core/document';
import { logger } from '../utils/logger';
import { RecentWorkspacesService } from '../services/RecentWorkspacesService';

export interface ExplorerContextType {
  workspaceRoot: WorkspaceRootModel | null;
  expandedNodeIds: Set<string>;
  selectedNodeId: string | null;
  activeNodeId: string | null;
  isLoading: boolean;
  error: string | null;
  openWorkspace: () => Promise<void>;
  closeWorkspace: () => void;
  toggleFolder: (nodeId: string) => Promise<void>;
  selectNode: (nodeId: string) => void;
  activateNode: (node: TreeNodeModel) => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  revealActiveFile: (uri?: string) => void;
  setWorkspaceRootModel: (root: WorkspaceRootModel | null) => void;
}

const ExplorerContext = createContext<ExplorerContextType | undefined>(undefined);

export const ExplorerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeDoc, openDoc } = useWorkspace();
  const [workspaceRoot, setWorkspaceRoot] = useState<WorkspaceRootModel | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync activeNodeId with active document's resource URI / path
  useEffect(() => {
    if (activeDoc) {
      const activeUri = activeDoc.fileResource?.uri || activeDoc.filePath || null;
      setActiveNodeId(activeUri);
    } else {
      setActiveNodeId(null);
    }
  }, [activeDoc]);

  const openWorkspace = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const root = await workspaceService.showDirectoryPicker();
      if (!root) {
        setIsLoading(false);
        return;
      }
      setWorkspaceRoot(root);
      setExpandedNodeIds(new Set([root.id]));
      RecentWorkspacesService.addRecentWorkspace(root.uri, root.name);
      setIsLoading(false);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to open workspace';
      logger.error('Explorer openWorkspace error', { error: msg });
      setError(msg);
      setIsLoading(false);
    }
  };

  const closeWorkspace = () => {
    setWorkspaceRoot(null);
    setExpandedNodeIds(new Set());
    setSelectedNodeId(null);
    setError(null);
  };

  /**
   * Recursively finds node in tree structure
   */
  const findNodeInTree = (nodes: TreeNodeModel[], targetId: string): TreeNodeModel | null => {
    for (const node of nodes) {
      if (node.id === targetId || node.uri === targetId) return node;
      if (node.children && node.children.length > 0) {
        const found = findNodeInTree(node.children, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  /**
   * Recursively updates node in tree structure
   */
  const updateNodeInTree = (
    nodes: TreeNodeModel[],
    targetId: string,
    updater: (node: TreeNodeModel) => TreeNodeModel
  ): TreeNodeModel[] => {
    return nodes.map((node) => {
      if (node.id === targetId || node.uri === targetId) {
        return updater(node);
      }
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: updateNodeInTree(node.children, targetId, updater),
        };
      }
      return node;
    });
  };

  const toggleFolder = async (nodeId: string) => {
    if (!workspaceRoot) return;

    const isExpanded = expandedNodeIds.has(nodeId);
    const newExpanded = new Set(expandedNodeIds);

    if (isExpanded) {
      newExpanded.delete(nodeId);
      setExpandedNodeIds(newExpanded);
      return;
    }

    newExpanded.add(nodeId);
    setExpandedNodeIds(newExpanded);

    const targetNode = findNodeInTree(workspaceRoot.tree, nodeId);
    if (targetNode && targetNode.kind === 'directory' && !targetNode.isLoaded && targetNode.handle) {
      try {
        // Mark node loading
        setWorkspaceRoot((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            tree: updateNodeInTree(prev.tree, nodeId, (n) => ({ ...n, isLoading: true, error: null })),
          };
        });

        const token = workspaceService.getNextToken();
        const children = await workspaceService.readDirectory(
          targetNode.handle as FileSystemDirectoryHandle,
          targetNode.id,
          targetNode.uri,
          { requestToken: token }
        );

        // Update node with fetched children
        setWorkspaceRoot((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            tree: updateNodeInTree(prev.tree, nodeId, (n) => ({
              ...n,
              children,
              isLoaded: true,
              isLoading: false,
              error: null,
            })),
          };
        });
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to read folder';
        setWorkspaceRoot((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            tree: updateNodeInTree(prev.tree, nodeId, (n) => ({
              ...n,
              isLoading: false,
              error: msg,
            })),
          };
        });
      }
    }
  };

  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
  };

  const activateNode = async (node: TreeNodeModel) => {
    selectNode(node.id);

    if (node.kind === 'directory') {
      await toggleFolder(node.id);
      return;
    }

    if (node.kind === 'file' && node.handle) {
      try {
        const result = await fileService.readFile(node.handle as FileSystemFileHandle);
        const doc = createNewDocument(
          result.resource.name,
          result.content,
          'plaintext',
          result.resource.uri,
          result.resource
        );
        openDoc(doc);
      } catch (err: unknown) {
        const msg = (err as Error).message || 'Failed to open file from workspace tree';
        logger.error('activateNode error', { error: msg });
        setError(msg);
      }
    }
  };

  const refreshWorkspace = async () => {
    if (!workspaceRoot || !workspaceRoot.handle) return;
    try {
      setIsLoading(true);
      setError(null);
      const token = workspaceService.getNextToken();
      const updatedTree = await workspaceService.readDirectory(
        workspaceRoot.handle,
        null,
        workspaceRoot.uri,
        { requestToken: token }
      );

      setWorkspaceRoot((prev) => (prev ? { ...prev, tree: updatedTree } : null));
      setIsLoading(false);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to refresh workspace';
      setError(msg);
      setIsLoading(false);
    }
  };

  /**
   * Collects all parent node IDs leading to target URI
   */
  const findParentChain = (nodes: TreeNodeModel[], targetUri: string, ancestors: string[] = []): string[] | null => {
    for (const node of nodes) {
      if (node.uri === targetUri || node.id === targetUri) {
        return ancestors;
      }
      if (node.children && node.children.length > 0) {
        const chain = findParentChain(node.children, targetUri, [...ancestors, node.id]);
        if (chain) return chain;
      }
    }
    return null;
  };

  const revealActiveFile = (uri?: string) => {
    const targetUri = uri || activeNodeId;
    if (!targetUri || !workspaceRoot) return;

    const parentChain = findParentChain(workspaceRoot.tree, targetUri);
    if (parentChain) {
      setExpandedNodeIds((prev) => {
        const next = new Set(prev);
        parentChain.forEach((id) => next.add(id));
        return next;
      });
      setSelectedNodeId(targetUri);
    }
  };

  return (
    <ExplorerContext.Provider
      value={{
        workspaceRoot,
        expandedNodeIds,
        selectedNodeId,
        activeNodeId,
        isLoading,
        error,
        openWorkspace,
        closeWorkspace,
        toggleFolder,
        selectNode,
        activateNode,
        refreshWorkspace,
        revealActiveFile,
        setWorkspaceRootModel: setWorkspaceRoot,
      }}
    >
      {children}
    </ExplorerContext.Provider>
  );
};

export const useExplorer = (): ExplorerContextType => {
  const context = useContext(ExplorerContext);
  if (!context) {
    throw new Error('useExplorer must be used within an ExplorerProvider');
  }
  return context;
};
