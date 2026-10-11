import React from 'react';

export interface PanelProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const Panel: React.FC<PanelProps> = ({
  children,
  header,
  footer,
  style,
  className = '',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-panel, #1e293b)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style,
      }}
      className={`qm-panel ${className}`}
    >
      {header && (
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-header, #1e293b)',
            fontWeight: 600,
            fontSize: '0.85rem',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
          className="qm-panel-header"
        >
          {header}
        </div>
      )}

      <div style={{ flex: 1, padding: '12px', overflow: 'auto' }} className="qm-panel-content">
        {children}
      </div>

      {footer && (
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-status, #0f172a)',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
          }}
          className="qm-panel-footer"
        >
          {footer}
        </div>
      )}
    </div>
  );
};

export interface PanelHeaderProps {
  title: React.ReactNode;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  leading,
  actions,
  style,
}) => {
  return (
    <div
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-header, #1e293b)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...style,
      }}
      className="qm-panel-header"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {leading}
        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
          {title}
        </span>
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{actions}</div>}
    </div>
  );
};

export interface PanelContentProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const PanelContent: React.FC<PanelContentProps> = ({ children, style }) => {
  return (
    <div style={{ flex: 1, padding: '12px', overflow: 'auto', ...style }} className="qm-panel-content">
      {children}
    </div>
  );
};

export interface PanelFooterProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const PanelFooter: React.FC<PanelFooterProps> = ({ children, style }) => {
  return (
    <div
      style={{
        padding: '8px 14px',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-status, #0f172a)',
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        ...style,
      }}
      className="qm-panel-footer"
    >
      {children}
    </div>
  );
};
