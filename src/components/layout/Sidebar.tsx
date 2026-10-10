import React from 'react';
import { PanelLeftClose, PanelLeft, Plus } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { useShellState } from '../../state/ShellContext';
import { useCommand } from '../../state/CommandContext';
import { FileExplorer } from '../explorer/FileExplorer';

export const Sidebar: React.FC = () => {
  const { state } = useShellState();
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
        }}
      >
        <IconButton
          onClick={() => executeCommand('shell.toggleSidebar')}
          aria-label="Expand Sidebar (Ctrl+B)"
          icon={<PanelLeft size={18} />}
        />
      </div>
    );
  }

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
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-header)',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.8px' }}>
          PRIMARY SIDEBAR
        </span>
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
        <FileExplorer />
      </div>
    </aside>
  );
};
