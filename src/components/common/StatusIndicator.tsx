import React from 'react';

export type StatusType =
  | 'saved'
  | 'dirty'
  | 'error'
  | 'syncing'
  | 'info'
  | 'warning'
  | 'offline'
  | 'online';

export interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  compact?: boolean;
  style?: React.CSSProperties;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  compact = false,
  style,
}) => {
  const getStatusColor = (): string => {
    switch (status) {
      case 'saved':
      case 'online':
        return 'var(--color-success, #10b981)';
      case 'dirty':
      case 'warning':
        return 'var(--color-warning, #f59e0b)';
      case 'error':
      case 'offline':
        return 'var(--color-error, #ef4444)';
      case 'syncing':
      case 'info':
      default:
        return 'var(--text-accent, #38bdf8)';
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
      case 'info':
        return 'Info';
      case 'warning':
        return 'Warning';
      case 'offline':
        return 'Offline';
      case 'online':
        return 'Online';
    }
  };

  const getStatusSymbol = (): string => {
    switch (status) {
      case 'saved':
      case 'online':
        return '✓';
      case 'dirty':
        return '●';
      case 'error':
      case 'offline':
        return '✕';
      case 'syncing':
        return '⟳';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  const color = getStatusColor();
  const text = label || getDefaultLabel();

  return (
    <div
      role="status"
      aria-label={`${getDefaultLabel()}: ${text}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.78rem',
        color,
        ...style,
      }}
      className="qm-status-indicator"
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '12px',
          height: '12px',
          fontSize: '0.7rem',
          fontWeight: 700,
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        {getStatusSymbol()}
      </span>
      {!compact && <span>{text}</span>}
    </div>
  );
};
