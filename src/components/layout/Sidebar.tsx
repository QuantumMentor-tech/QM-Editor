import React from 'react';
import { FileText, FolderOpen, PanelLeftClose, PanelLeft, Plus } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { useShellState } from '../../state/ShellContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import { useCommand } from '../../state/CommandContext';

export const Sidebar: React.FC = () => {
  const { state } = useShellState();
  const { registry, activateDoc } = useWorkspace();
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
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          fontWeight: 600,
          fontSize: '0.8rem',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          letterSpacing: '0.8px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderOpen size={16} />
          <span>Explorer</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <IconButton
            onClick={() => executeCommand('document.new')}
            aria-label="New Document (Ctrl+N)"
            icon={<Plus size={14} />}
          />
          <IconButton
            onClick={() => executeCommand('shell.toggleSidebar')}
            aria-label="Collapse Sidebar (Ctrl+B)"
            icon={<PanelLeftClose size={16} />}
          />
        </div>
      </div>

      <div style={{ padding: '8px', flex: 1, overflowY: 'auto' }}>
        {registry.openDocIds.map((id) => {
          const doc = registry.documents[id];
          if (!doc) return null;
          const isActive = registry.activeDocId === id;

          return (
            <div
              key={doc.id}
              onClick={() => activateDoc(doc.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                color: isActive ? 'var(--text-accent)' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                marginBottom: '2px',
                transition: 'background-color var(--transition-fast)',
              }}
            >
              <FileText size={16} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {doc.title}
              </span>
              {doc.isDirty && (
                <span
                  style={{
                    height: '6px',
                    width: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--text-accent)',
                    marginLeft: 'auto',
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
