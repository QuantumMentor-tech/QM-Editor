import React from 'react';
import { StatusIndicator, StatusType } from '../common/StatusIndicator';
import { useWorkspace } from '../../state/WorkspaceContext';

export const StatusBar: React.FC = () => {
  const { activeDoc, saveStatus, lastErrorMessage } = useWorkspace();

  const getStatusType = (): StatusType => {
    if (saveStatus === 'saving') return 'syncing';
    if (saveStatus === 'error') return 'error';
    if (!activeDoc) return 'saved';
    return activeDoc.isDirty ? 'dirty' : 'saved';
  };

  const getStatusLabel = (): string | undefined => {
    if (saveStatus === 'saving') return 'Saving...';
    if (saveStatus === 'error') return lastErrorMessage || 'Save Failed';
    if (saveStatus === 'saved') return 'Saved';
    return undefined;
  };

  const language = activeDoc?.language || 'Plaintext';
  const filePath = activeDoc?.filePath || 'Untitled Buffer';

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
        <span style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filePath}
        </span>
        <span>•</span>
        <span>UTF-8</span>
        <span>•</span>
        <span style={{ textTransform: 'capitalize' }}>{language}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <StatusIndicator status={getStatusType()} label={getStatusLabel()} />
      </div>
    </footer>
  );
};
