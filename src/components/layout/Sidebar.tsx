import React from 'react';
import { PanelLeftClose, PanelLeft, Plus, FolderTree, GitBranch } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { useShellState } from '../../state/ShellContext';
import { useCommand } from '../../state/CommandContext';
import { FileExplorer } from '../explorer/FileExplorer';
import { SourceControlPanel } from '../source-control/SourceControlPanel';

export const Sidebar: React.FC = () => {
  const { state, setSidebarView } = useShellState();
  const { executeCommand } = useCommand();

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
      </div>
    );
  }

  const isExplorer = state.sidebarView === 'explorer';

  return (
    <aside
      style={{
        width: `${state.sidebarWidth}px`,
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
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
            onClick={() => setSidebarView('scm')}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.75rem',
              color: !isExplorer ? 'var(--accent-primary)' : 'var(--text-muted)',
              borderBottom: !isExplorer ? '2px solid var(--accent-primary)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <GitBranch size={13} /> Source Control
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
        {isExplorer ? <FileExplorer /> : <SourceControlPanel />}
      </div>
    </aside>
  );
};
