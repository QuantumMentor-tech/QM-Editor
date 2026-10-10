import React from 'react';

export interface PanelProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Panel: React.FC<PanelProps> = ({ children, header, footer, style }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {header && (
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-header)',
            fontWeight: 600,
            fontSize: '0.85rem',
            color: 'var(--text-primary)',
          }}
        >
          {header}
        </div>
      )}

      <div style={{ flex: 1, padding: '12px', overflow: 'auto' }}>{children}</div>

      {footer && (
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-status)',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
};
