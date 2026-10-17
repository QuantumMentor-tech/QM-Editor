/**
 * QM Editor — LSP Call Hierarchy Modal & Relationship Inspector
 * Phase 06, Step 70 — LSP Call Hierarchy, Callers, Callees & Safe Cross-File Code Relationship Navigation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  X,
  GitFork,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Repeat,
  Code2,
  FileCode,
} from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { SymbolIcon } from '../symbols/SymbolIcon';
import {
  CallHierarchyDirection,
  CallHierarchyTreeNode,
  QmCallHierarchyItem,
} from '../../core/lsp/call-hierarchy/LspCallHierarchyTypes';
import { globalCallHierarchyCoordinator } from '../../core/lsp/call-hierarchy/LspCallHierarchyCoordinator';
import { Range } from '../../core/navigation/LocationTypes';

export interface CallHierarchyModalProps {
  rootItems: QmCallHierarchyItem[];
  initialDirection?: CallHierarchyDirection;
  onClose: () => void;
}

export const CallHierarchyModal: React.FC<CallHierarchyModalProps> = ({
  rootItems,
  initialDirection = 'incoming',
  onClose,
}) => {
  const [selectedRootIdx, setSelectedRootIdx] = useState<number>(0);
  const [direction, setDirection] = useState<CallHierarchyDirection>(initialDirection);
  const [rootNode, setRootNode] = useState<CallHierarchyTreeNode | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [loadingNodeIds, setLoadingNodeIds] = useState<Set<string>>(new Set());
  const [, setTick] = useState<number>(0); // force re-render helper

  const currentRootItem = rootItems[selectedRootIdx] || rootItems[0];
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize or re-initialize root node when root item or direction changes
  useEffect(() => {
    if (!currentRootItem) return;
    const node = globalCallHierarchyCoordinator.createRootTreeNode(currentRootItem, direction);
    setRootNode(node);
    setExpandedNodeIds(new Set([node.id]));
    setSelectedNodeId(node.id);

    // Automatically expand the root node to show immediate callers / callees
    expandNode(node, direction);
  }, [currentRootItem, direction]);

  const expandNode = useCallback(
    async (node: CallHierarchyTreeNode, dir: CallHierarchyDirection) => {
      if (node.isCycle || node.state === 'cycle' || node.state === 'loaded') {
        setExpandedNodeIds((prev) => new Set(prev).add(node.id));
        return;
      }

      setLoadingNodeIds((prev) => new Set(prev).add(node.id));
      try {
        await globalCallHierarchyCoordinator.expandNode(node, dir);
        setExpandedNodeIds((prev) => new Set(prev).add(node.id));
      } finally {
        setLoadingNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
        setTick((t) => t + 1);
      }
    },
    []
  );

  const toggleExpand = useCallback(
    async (node: CallHierarchyTreeNode, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (expandedNodeIds.has(node.id)) {
        setExpandedNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      } else {
        await expandNode(node, direction);
      }
    },
    [expandedNodeIds, expandNode, direction]
  );

  const handleNavigateItem = useCallback(
    async (item: QmCallHierarchyItem, e?: React.MouseEvent) => {
      e?.stopPropagation();
      await globalCallHierarchyCoordinator.navigateToItem(item);
      onClose();
    },
    [onClose]
  );

  const handleNavigateCallSite = useCallback(
    async (item: QmCallHierarchyItem, range: Range, e?: React.MouseEvent) => {
      e?.stopPropagation();
      await globalCallHierarchyCoordinator.navigateToCallSite(item, range);
      onClose();
    },
    [onClose]
  );

  // Flatten visible nodes for keyboard navigation
  const visibleNodes: CallHierarchyTreeNode[] = React.useMemo(() => {
    if (!rootNode) return [];
    const list: CallHierarchyTreeNode[] = [];

    const traverse = (n: CallHierarchyTreeNode) => {
      list.push(n);
      if (expandedNodeIds.has(n.id) && n.children) {
        for (const child of n.children) {
          traverse(child);
        }
      }
    };

    traverse(rootNode);
    return list;
  }, [rootNode, expandedNodeIds]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      const currentIndex = visibleNodes.findIndex((n) => n.id === selectedNodeId);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(visibleNodes.length - 1, (currentIndex >= 0 ? currentIndex : 0) + 1);
        if (visibleNodes[nextIndex]) {
          setSelectedNodeId(visibleNodes[nextIndex].id);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(0, (currentIndex >= 0 ? currentIndex : 0) - 1);
        if (visibleNodes[prevIndex]) {
          setSelectedNodeId(visibleNodes[prevIndex].id);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const node = visibleNodes[currentIndex];
        if (node && !expandedNodeIds.has(node.id)) {
          toggleExpand(node);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const node = visibleNodes[currentIndex];
        if (node && expandedNodeIds.has(node.id)) {
          toggleExpand(node);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const node = visibleNodes[currentIndex];
        if (node) {
          handleNavigateItem(node.item);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleNodes, selectedNodeId, expandedNodeIds, toggleExpand, handleNavigateItem, onClose]);

  // Render a single node row and its children
  const renderNode = (node: CallHierarchyTreeNode) => {
    const isExpanded = expandedNodeIds.has(node.id);
    const isSelected = selectedNodeId === node.id;
    const isLoading = loadingNodeIds.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const canExpand = !node.isCycle && node.state !== 'empty';
    const filePath = node.item.uri.split(/[\\/]/).pop() || node.item.uri;
    const startLine = node.item.selectionRange.startLine;

    return (
      <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          role="treeitem"
          aria-expanded={isExpanded}
          aria-selected={isSelected}
          onClick={() => setSelectedNodeId(node.id)}
          onDoubleClick={() => handleNavigateItem(node.item)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 8px',
            paddingLeft: `${node.depth * 18 + 8}px`,
            backgroundColor: isSelected ? 'var(--accent-subtle, rgba(99, 102, 241, 0.15))' : 'transparent',
            borderLeft: isSelected ? '3px solid var(--accent, #6366f1)' : '3px solid transparent',
            cursor: 'pointer',
            borderRadius: '4px',
            userSelect: 'none',
            fontSize: '0.85rem',
            gap: '6px',
            transition: 'background-color 0.1s ease',
          }}
        >
          {/* Chevron */}
          <button
            onClick={(e) => toggleExpand(node, e)}
            disabled={!canExpand}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px',
              cursor: canExpand ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-muted, #94a3b8)',
              opacity: canExpand ? 1 : 0.2,
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : isExpanded ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )}
          </button>

          {/* Symbol icon */}
          <SymbolIcon kind={node.item.kind} size={14} />

          {/* Symbol Name */}
          <span
            onClick={() => handleNavigateItem(node.item)}
            title="Click to jump to definition"
            style={{
              fontWeight: node.depth === 0 ? 600 : 500,
              color: 'var(--text-primary, #f1f5f9)',
              textDecoration: 'none',
            }}
          >
            {node.item.name}
          </span>

          {/* Detail */}
          {node.item.detail && (
            <span
              style={{
                color: 'var(--text-muted, #64748b)',
                fontSize: '0.78rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '160px',
              }}
            >
              {node.item.detail}
            </span>
          )}

          {/* Cycle Indicator */}
          {node.isCycle && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '0.72rem',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                padding: '1px 5px',
                borderRadius: '4px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
              title="Recursive call (Cycle detected)"
            >
              <Repeat size={10} />
              Cycle
            </span>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Call sites count (for non-root incoming/outgoing calls) */}
          {node.callSiteRanges && node.callSiteRanges.length > 0 && node.depth > 0 && (
            <span
              style={{
                fontSize: '0.72rem',
                backgroundColor: 'var(--bg-surface, #1e1e2e)',
                color: 'var(--text-muted, #94a3b8)',
                padding: '1px 6px',
                borderRadius: '10px',
                border: '1px solid var(--border-color, #313244)',
              }}
            >
              {node.callSiteRanges.length} {node.callSiteRanges.length === 1 ? 'call' : 'calls'}
            </span>
          )}

          {/* Location reference (file:line) */}
          <span
            style={{
              color: 'var(--text-muted, #64748b)',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <FileCode size={11} />
            {filePath}:{startLine}
          </span>
        </div>

        {/* Call site sub-items if expanded and node has multiple call-site ranges */}
        {isExpanded && node.callSiteRanges && node.callSiteRanges.length > 1 && node.depth > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: '2px 0' }}>
            {node.callSiteRanges.map((range, idx) => (
              <div
                key={`${node.id}:site:${idx}`}
                onClick={(e) => handleNavigateCallSite(node.item, range, e)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '2px 8px',
                  paddingLeft: `${(node.depth + 1) * 18 + 14}px`,
                  fontSize: '0.78rem',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  borderRadius: '3px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card, #262738)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                title={`Jump to call site at line ${range.startLine}`}
              >
                <Code2 size={11} color="var(--accent, #6366f1)" />
                <span>Call site #{idx + 1} at line {range.startLine}:{range.startColumn}</span>
              </div>
            ))}
          </div>
        )}

        {/* Children nodes */}
        {isExpanded && hasChildren && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {node.children!.map((child) => renderNode(child))}
          </div>
        )}

        {/* Empty state under an expanded node */}
        {isExpanded && node.state === 'empty' && (
          <div
            style={{
              paddingLeft: `${(node.depth + 1) * 18 + 14}px`,
              paddingTop: '3px',
              paddingBottom: '3px',
              fontSize: '0.78rem',
              color: 'var(--text-muted, #64748b)',
              fontStyle: 'italic',
            }}
          >
            {node.errorMessage || (direction === 'incoming' ? 'No incoming calls' : 'No outgoing calls')}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-label="Call Hierarchy"
      style={{
        position: 'fixed',
        top: '12%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '680px',
        maxHeight: '560px',
        backgroundColor: 'var(--bg-card, #1e1e2e)',
        border: '1px solid var(--border-color, #313244)',
        borderRadius: 'var(--radius-md, 8px)',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
      }}
      ref={containerRef}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color, #313244)',
          backgroundColor: 'var(--bg-surface, #181825)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>
          <GitFork size={16} color="var(--accent, #6366f1)" />
          <span>Call Hierarchy</span>
          {rootItems.length > 1 && (
            <select
              value={selectedRootIdx}
              onChange={(e) => setSelectedRootIdx(Number(e.target.value))}
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                fontSize: '0.8rem',
                padding: '2px 6px',
              }}
            >
              {rootItems.map((item, idx) => (
                <option key={item.id} value={idx}>
                  {item.name} ({item.uri.split(/[\\/]/).pop()})
                </option>
              ))}
            </select>
          )}
        </div>
        <IconButton onClick={onClose} icon={<X size={14} />} aria-label="Close" />
      </div>

      {/* Direction Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border-color, #313244)',
          backgroundColor: 'var(--bg-card, #1e1e2e)',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setDirection('incoming')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              fontSize: '0.8rem',
              fontWeight: 500,
              borderRadius: '4px',
              border: '1px solid',
              borderColor: direction === 'incoming' ? 'var(--accent, #6366f1)' : 'var(--border-color, #313244)',
              backgroundColor:
                direction === 'incoming' ? 'var(--accent-subtle, rgba(99, 102, 241, 0.2))' : 'transparent',
              color: direction === 'incoming' ? 'var(--accent, #818cf8)' : 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
            }}
          >
            <ArrowDownLeft size={14} />
            Incoming Calls (Callers)
          </button>

          <button
            onClick={() => setDirection('outgoing')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              fontSize: '0.8rem',
              fontWeight: 500,
              borderRadius: '4px',
              border: '1px solid',
              borderColor: direction === 'outgoing' ? 'var(--accent, #6366f1)' : 'var(--border-color, #313244)',
              backgroundColor:
                direction === 'outgoing' ? 'var(--accent-subtle, rgba(99, 102, 241, 0.2))' : 'transparent',
              color: direction === 'outgoing' ? 'var(--accent, #818cf8)' : 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
            }}
          >
            <ArrowUpRight size={14} />
            Outgoing Calls (Callees)
          </button>
        </div>

        {/* Root symbol context summary */}
        {currentRootItem && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              color: 'var(--text-muted, #94a3b8)',
            }}
          >
            <span>Target:</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{currentRootItem.name}</span>
          </div>
        )}
      </div>

      {/* Tree Content Area */}
      <div
        role="tree"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          minHeight: '260px',
        }}
      >
        {!rootNode ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No call hierarchy root available.
          </div>
        ) : (
          renderNode(rootNode)
        )}
      </div>

      {/* Footer / Shortcut info */}
      <div
        style={{
          padding: '6px 16px',
          borderTop: '1px solid var(--border-color, #313244)',
          backgroundColor: 'var(--bg-surface, #181825)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.72rem',
          color: 'var(--text-muted, #64748b)',
        }}
      >
        <div style={{ display: 'flex', gap: '12px' }}>
          <span><kbd style={{ padding: '1px 4px', backgroundColor: 'var(--bg-card)', borderRadius: '3px', border: '1px solid var(--border-color)' }}>↑↓</kbd> Navigate</span>
          <span><kbd style={{ padding: '1px 4px', backgroundColor: 'var(--bg-card)', borderRadius: '3px', border: '1px solid var(--border-color)' }}>→</kbd> / <kbd style={{ padding: '1px 4px', backgroundColor: 'var(--bg-card)', borderRadius: '3px', border: '1px solid var(--border-color)' }}>←</kbd> Expand / Collapse</span>
          <span><kbd style={{ padding: '1px 4px', backgroundColor: 'var(--bg-card)', borderRadius: '3px', border: '1px solid var(--border-color)' }}>Enter</kbd> Go to Symbol</span>
          <span><kbd style={{ padding: '1px 4px', backgroundColor: 'var(--bg-card)', borderRadius: '3px', border: '1px solid var(--border-color)' }}>Esc</kbd> Close</span>
        </div>
        <span>LSP Call Hierarchy</span>
      </div>
    </div>
  );
};
