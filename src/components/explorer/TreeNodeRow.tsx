import React from 'react';
import { TreeNodeModel } from '../../types';
import { useSourceControl } from '../../state/SourceControlContext';
import { useContextMenu } from '../../state/ContextMenuContext';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Loader2, AlertCircle } from 'lucide-react';

export interface TreeNodeRowProps {
  node: TreeNodeModel;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isActive: boolean;
  onToggle: (node: TreeNodeModel) => void;
  onSelect: (node: TreeNodeModel) => void;
  onActivate: (node: TreeNodeModel) => void;
}

export const TreeNodeRow: React.FC<TreeNodeRowProps> = ({
  node,
  depth,
  isExpanded,
  isSelected,
  isActive,
  onToggle,
  onSelect,
  onActivate,
}) => {
  const isDirectory = node.kind === 'directory';
  const { state: scState } = useSourceControl();
  const { openContextMenu } = useContextMenu();

  const fileStatus = !isDirectory && scState.isGitRepository
    ? scState.fileStatuses.get(node.uri.toLowerCase())
    : undefined;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(node);
    openContextMenu('contextmenu:explorer', { x: e.clientX, y: e.clientY }, { uri: node.uri, node });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node);
    if (isDirectory) {
      onToggle(node);
    } else {
      onActivate(node);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onActivate(node);
  };

  const getBackgroundColor = (): string => {
    if (isActive) return 'var(--bg-active, rgba(59, 130, 246, 0.15))';
    if (isSelected) return 'var(--bg-hover)';
    return 'transparent';
  };

  const getTextColor = (): string => {
    if (isActive) return 'var(--text-accent)';
    return 'var(--text-primary)';
  };

  const renderStatusBadge = () => {
    if (!fileStatus || fileStatus.displayStatus === 'unmodified') return null;
    let color = 'var(--text-muted)';
    let badge = '•';

    switch (fileStatus.displayStatus) {
      case 'modified':
        color = 'var(--warning)';
        badge = 'M';
        break;
      case 'untracked':
        color = 'var(--success)';
        badge = 'U';
        break;
      case 'deleted':
        color = 'var(--error)';
        badge = 'D';
        break;
      case 'staged':
        color = 'var(--accent-primary)';
        badge = 'S';
        break;
      case 'conflict':
        color = 'var(--accent-error, #f85149)';
        badge = 'C';
        break;
    }

    return (
      <span
        title={`Git Status: ${fileStatus.displayStatus}`}
        style={{
          color,
          fontWeight: 700,
          fontSize: '0.7rem',
          marginLeft: '4px',
          flexShrink: 0,
        }}
      >
        {badge}
      </span>
    );
  };

  const accessibleLabel = `${node.name}${isDirectory ? (isExpanded ? ', expanded folder' : ', collapsed folder') : ''}${fileStatus ? `, Git ${fileStatus.displayStatus}` : ''}${isActive ? ', active document' : ''}`;

  return (
    <div
      role="treeitem"
      aria-level={depth}
      aria-expanded={isDirectory ? isExpanded : undefined}
      aria-selected={isSelected}
      aria-label={accessibleLabel}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        paddingLeft: `${Math.max(12, depth * 14)}px`,
        paddingRight: '12px',
        height: '28px',
        lineHeight: '28px',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: getBackgroundColor(),
        color: getTextColor(),
        cursor: 'pointer',
        fontSize: '0.85rem',
        userSelect: 'none',
        transition: 'background-color var(--transition-fast)',
        margin: '1px 0',
        outline: isSelected ? '1px solid var(--border-focus)' : 'none',
        outlineOffset: '-1px',
      }}
    >
      {/* Expand/Collapse Chevron Indicator */}
      <div
        style={{
          width: '16px',
          height: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        onClick={(e) => {
          if (isDirectory) {
            e.stopPropagation();
            onToggle(node);
          }
        }}
      >
        {isDirectory && (
          node.isLoading ? (
            <Loader2 size={12} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          ) : isExpanded ? (
            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
          ) : (
            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
          )
        )}
      </div>

      {/* Node Kind Icon */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {isDirectory ? (
          isExpanded ? (
            <FolderOpen size={16} style={{ color: '#60a5fa' }} />
          ) : (
            <Folder size={16} style={{ color: '#60a5fa' }} />
          )
        ) : (
          <FileText size={15} style={{ color: isActive ? 'var(--text-accent)' : 'var(--text-muted)' }} />
        )}
      </div>

      {/* Item Name */}
      <span
        style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flex: 1,
          fontWeight: isActive || isSelected ? 500 : 400,
        }}
        title={node.name}
      >
        {node.name}
      </span>

      {/* Git Status Badge */}
      {renderStatusBadge()}

      {/* Error indicator */}
      {node.error && (
        <div title={node.error} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <AlertCircle size={14} style={{ color: 'var(--text-danger, #ef4444)' }} />
        </div>
      )}
    </div>
  );
};
