import React from 'react';
import { StatusIndicator, StatusType } from '../common/StatusIndicator';
import { useWorkspace } from '../../state/WorkspaceContext';

export const StatusBar: React.FC = () => {
  const { activeDoc } = useWorkspace();

  const status: StatusType = activeDoc ? (activeDoc.isDirty ? 'dirty' : 'saved') : 'saved';
  const language = activeDoc?.language || 'Plaintext';

  return (
    <footer
      style={{
        height: 'var(--statusbar-height)',
        backgroundColor: 'var(--bg-status)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span>QM Editor Workspace Model</span>
        <span>•</span>
        <span>UTF-8</span>
        <span>•</span>
        <span style={{ textTransform: 'capitalize' }}>{language}</span>
      </div>

      <div>
        <StatusIndicator status={status} />
      </div>
    </footer>
  );
};
