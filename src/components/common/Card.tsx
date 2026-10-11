import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, style, className = '', onClick }) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-panel, #1e293b)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style,
      }}
      className={`qm-card ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  style?: React.CSSProperties;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  description,
  actions,
  style,
}) => {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '12px',
        ...style,
      }}
      className="qm-card-header"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </h4>
        {description && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {description}
          </span>
        )}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{actions}</div>}
    </div>
  );
};

export interface CardContentProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const CardContent: React.FC<CardContentProps> = ({ children, style }) => {
  return (
    <div style={{ padding: '14px 16px', ...style }} className="qm-card-content">
      {children}
    </div>
  );
};

export interface CardFooterProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, style }) => {
  return (
    <div
      style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-status, #0f172a)',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '8px',
        ...style,
      }}
      className="qm-card-footer"
    >
      {children}
    </div>
  );
};
