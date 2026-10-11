import React, { useRef, useMemo, useEffect } from 'react';
import { TreeNodeModel } from '../../types';
import { TreeNodeRow } from './TreeNodeRow';
import { useExplorer } from '../../state/ExplorerContext';
import { globalFocusManager } from '../../core/accessibility/FocusManager';
import { Folder } from 'lucide-react';
import { EmptyState } from '../common/EmptyState';

export interface VisibleNodeItem {
  node: TreeNodeModel;
  depth: number;
}

export const FileExplorerTree: React.FC = () => {
  const {
    workspaceRoot,
    expandedNodeIds,
    selectedNodeId,
    activeNodeId,
    toggleFolder,
    selectNode,
    activateNode,
  } = useExplorer();

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unregister = globalFocusManager.registerRegion('explorer', () => containerRef.current);
    return unregister;
  }, []);

  /**
   * Flattens visible tree nodes according to expanded folder set
   */
  const visibleNodes = useMemo(() => {
    if (!workspaceRoot) return [];
    const result: VisibleNodeItem[] = [];

    const traverse = (nodes: TreeNodeModel[], depth: number) => {
      for (const node of nodes) {
        result.push({ node, depth });
        if (node.kind === 'directory' && expandedNodeIds.has(node.id) && node.children) {
          traverse(node.children, depth + 1);
        }
      }
    };

    traverse(workspaceRoot.tree, 1);
    return result;
  }, [workspaceRoot, expandedNodeIds]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (visibleNodes.length === 0) return;

    const currentIndex = visibleNodes.findIndex(
      (item) => item.node.id === selectedNodeId || item.node.uri === selectedNodeId
    );

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const nextIndex = currentIndex < visibleNodes.length - 1 ? currentIndex + 1 : 0;
        const nextNode = visibleNodes[nextIndex].node;
        selectNode(nextNode.id);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : visibleNodes.length - 1;
        const prevNode = visibleNodes[prevIndex].node;
        selectNode(prevNode.id);
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        if (currentIndex >= 0) {
          const current = visibleNodes[currentIndex].node;
          if (current.kind === 'directory') {
            if (!expandedNodeIds.has(current.id)) {
              toggleFolder(current.id);
            } else if (current.children && current.children.length > 0) {
              selectNode(current.children[0].id);
            }
          }
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (currentIndex >= 0) {
          const current = visibleNodes[currentIndex].node;
          if (current.kind === 'directory' && expandedNodeIds.has(current.id)) {
            toggleFolder(current.id);
          } else if (current.parentId) {
            selectNode(current.parentId);
          }
        }
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (currentIndex >= 0) {
          const current = visibleNodes[currentIndex].node;
          activateNode(current);
        }
        break;
      }
      case 'Home': {
        e.preventDefault();
        selectNode(visibleNodes[0].node.id);
        break;
      }
      case 'End': {
        e.preventDefault();
        selectNode(visibleNodes[visibleNodes.length - 1].node.id);
        break;
      }
    }
  };

  if (!workspaceRoot) return null;

  if (visibleNodes.length === 0) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <EmptyState
          icon={<Folder size={32} />}
          title="No files to display"
          description="This workspace folder contains no files or items matching display criteria."
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="tree"
      aria-label="Workspace File Explorer Tree"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        outline: 'none',
        height: '100%',
        overflowY: 'auto',
        padding: '4px 0',
      }}
    >
      {visibleNodes.map(({ node, depth }) => {
        const isExpanded = expandedNodeIds.has(node.id);
        const isSelected = selectedNodeId === node.id || selectedNodeId === node.uri;
        const isActive = activeNodeId === node.id || activeNodeId === node.uri;

        return (
          <TreeNodeRow
            key={node.id}
            node={node}
            depth={depth}
            isExpanded={isExpanded}
            isSelected={isSelected}
            isActive={isActive}
            onToggle={(n) => toggleFolder(n.id)}
            onSelect={(n) => selectNode(n.id)}
            onActivate={(n) => activateNode(n)}
          />
        );
      })}
    </div>
  );
};
