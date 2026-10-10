import React from 'react';

export type StatusType = 'saved' | 'dirty' | 'error' | 'syncing';

export interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, label }) => {
  const getStatusColor = (): string => {
    switch (status) {
      case 'saved':
        return '#10b981'; // Green
      case 'dirty':
        return '#f59e0b'; // Amber
      case 'error':
        return '#ef4444'; // Red
      case 'syncing':
        return 'var(--text-accent)'; // Blue
    }
  };

  const getDefaultLabel = (): string => {
    switch (status) {
      case 'saved':
        return 'Saved';
      case 'dirty':
        return 'Unsaved Changes';
      case 'error':
        return 'Error';
      case 'syncing':
        return 'Syncing...';
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
      <span
        style={{
          height: '8px',
          width: '8px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          display: 'inline-block',
        }}
      />
      <span style={{ color: getStatusColor() }}>{label || getDefaultLabel()}</span>
    </div>
  );
};
