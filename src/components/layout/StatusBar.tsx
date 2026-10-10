import React from 'react';
import { StatusIndicator, StatusType } from '../common/StatusIndicator';

export interface StatusBarProps {
  status: StatusType;
  encoding?: string;
  language?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  status,
  encoding = 'UTF-8',
  language = 'Markdown',
}) => {
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
        <span>QM Editor Shell Foundation</span>
        <span>•</span>
        <span>{encoding}</span>
        <span>•</span>
        <span>{language}</span>
      </div>

      <div>
        <StatusIndicator status={status} />
      </div>
    </footer>
  );
};
