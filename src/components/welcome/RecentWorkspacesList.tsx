import React, { useState, useEffect } from 'react';
import { RecentWorkspacesService, RecentWorkspace } from '../../services/RecentWorkspacesService';
import { useCommand } from '../../state/CommandContext';
import { List, ListItem } from '../common/List';
import { EmptyState } from '../common/EmptyState';
import { IconButton } from '../common/IconButton';
import { Folder, Trash2, Clock } from 'lucide-react';

export const RecentWorkspacesList: React.FC = () => {
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([]);
  const { executeCommand } = useCommand();

  useEffect(() => {
    setRecentWorkspaces(RecentWorkspacesService.getRecentWorkspaces());
  }, []);

  const handleRemove = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    const updated = RecentWorkspacesService.removeRecentWorkspace(path);
    setRecentWorkspaces(updated);
  };

  const formatTime = (timestamp: number): string => {
    try {
      const diffMs = Date.now() - timestamp;
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
        boxSizing: 'border-box',
      }}
      className="qm-welcome-recent-workspaces"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '0.85rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            color: 'var(--text-muted)',
          }}
        >
          Recent Workspaces
        </h2>

        {recentWorkspaces.length > 0 && (
          <button
            type="button"
            onClick={() => {
              RecentWorkspacesService.clearRecentWorkspaces();
              setRecentWorkspaces([]);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.74rem',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
            }}
            title="Clear all recent workspace history (does not delete files)"
          >
            Clear All
          </button>
        )}
      </div>

      {recentWorkspaces.length === 0 ? (
        <div
          style={{
            border: '1px dashed var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            backgroundColor: 'var(--bg-app)',
          }}
        >
          <EmptyState
            icon={<Clock size={28} />}
            title="No Recent Workspaces"
            description="Project directories you open will appear here for instant resumption."
          />
        </div>
      ) : (
        <div
          style={{
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-app)',
            overflow: 'hidden',
          }}
        >
          <List aria-label="Recent Workspaces History">
            {recentWorkspaces.map((ws) => (
              <ListItem
                key={ws.path}
                leading={<Folder size={16} style={{ color: 'var(--text-accent)' }} />}
                title={ws.name}
                secondary={ws.path}
                onClick={() => executeCommand('workspace.open')}
                trailing={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {formatTime(ws.lastOpened)}
                    </span>
                    <IconButton
                      icon={<Trash2 size={13} />}
                      aria-label={`Remove ${ws.name} from recent workspaces`}
                      title="Remove from Recent (does not delete folder)"
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleRemove(e, ws.path)}
                    />
                  </div>
                }
              />
            ))}
          </List>
        </div>
      )}
    </div>
  );
};
