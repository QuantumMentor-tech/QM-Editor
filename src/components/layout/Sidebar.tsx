import React, { useRef, useEffect } from 'react';
import { PanelLeftClose, PanelLeft, Plus, FolderTree, GitBranch, ListTree } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { useShellState } from '../../state/ShellContext';
import { useCommand } from '../../state/CommandContext';
import { FileExplorer } from '../explorer/FileExplorer';
import { SourceControlPanel } from '../source-control/SourceControlPanel';
import { OutlinePanel } from '../symbols/OutlinePanel';

export const Sidebar: React.FC = () => {
  const { state, setSidebarView, setSidebarWidth } = useShellState();
  const { executeCommand } = useCommand();
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      setSidebarWidth(e.clientX);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setSidebarWidth]);

  if (!state.sidebarOpen) {
    return (
      <div
        style={{
          width: '40px',
          backgroundColor: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '8px',
          gap: '8px',
        }}
      >
        <IconButton
          onClick={() => executeCommand('shell.toggleSidebar')}
          aria-label="Expand Sidebar (Ctrl+B)"
          icon={<PanelLeft size={18} />}
        />
        <IconButton
          onClick={() => {
            setSidebarView('explorer');
          }}
          aria-label="File Explorer"
          icon={<FolderTree size={16} />}
        />
        <IconButton
          onClick={() => {
            setSidebarView('scm');
          }}
          aria-label="Source Control"
          icon={<GitBranch size={16} />}
        />
        <IconButton
          onClick={() => {
            setSidebarView('outline');
          }}
          aria-label="Symbol Outline"
          icon={<ListTree size={16} />}
        />
      </div>
    );
  }

  const isExplorer = state.sidebarView === 'explorer';

  return (
    <aside
      aria-label="Sidebar"
      style={{
        width: `${state.sidebarWidth}px`,
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Draggable & Keyboard-Accessible Vertical Resizer (Step 25, Rule 8, 21, 22) */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize Primary Sidebar (Arrow keys to adjust, double click to reset)"
        aria-valuenow={state.sidebarWidth}
        aria-valuemin={160}
        aria-valuemax={500}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            setSidebarWidth(state.sidebarWidth + 20);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setSidebarWidth(state.sidebarWidth - 20);
          } else if (e.key === 'Home') {
            e.preventDefault();
            setSidebarWidth(160);
          } else if (e.key === 'End') {
            e.preventDefault();
            setSidebarWidth(500);
          }
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          isDraggingRef.current = true;
        }}
        onDoubleClick={() => {
          setSidebarWidth(260);
        }}
        title="Drag or use Arrow Left/Right to resize sidebar. Double-click to reset."
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '5px',
          cursor: 'col-resize',
          zIndex: 'var(--z-resizer, 10)',
          backgroundColor: 'transparent',
          transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
        }}
        onMouseLeave={(e) => {
          if (!isDraggingRef.current) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      />

      <div
        style={{
          padding: '4px 8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-header)',
        }}
      >
        <div role="tablist" aria-label="Sidebar Views" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            role="tab"
            aria-selected={isExplorer}
            aria-label="File Explorer"
            onClick={() => setSidebarView('explorer')}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.75rem',
              color: isExplorer ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderBottom: isExplorer ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <FolderTree size={13} /> Explorer
          </button>

          <button
            role="tab"
            aria-selected={state.sidebarView === 'scm'}
            aria-label="Source Control"
            onClick={() => setSidebarView('scm')}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.75rem',
              color: state.sidebarView === 'scm' ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderBottom: state.sidebarView === 'scm' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <GitBranch size={13} /> SCM
          </button>

          <button
            role="tab"
            aria-selected={state.sidebarView === 'outline'}
            aria-label="Symbol Outline"
            onClick={() => setSidebarView('outline')}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.75rem',
              color: state.sidebarView === 'outline' ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderBottom: state.sidebarView === 'outline' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ListTree size={13} /> Outline
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <IconButton
            onClick={() => executeCommand('file.new')}
            aria-label="New File (Ctrl+N)"
            icon={<Plus size={14} />}
          />
          <IconButton
            onClick={() => executeCommand('shell.toggleSidebar')}
            aria-label="Collapse Sidebar (Ctrl+B)"
            icon={<PanelLeftClose size={16} />}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {state.sidebarView === 'explorer' && <FileExplorer />}
        {state.sidebarView === 'scm' && <SourceControlPanel />}
        {state.sidebarView === 'outline' && <OutlinePanel />}
      </div>
    </aside>
  );
};
