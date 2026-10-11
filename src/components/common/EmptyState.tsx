import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  style,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        textAlign: 'center',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
      className="qm-empty-state"
    >
      {icon && (
        <div
          style={{
            fontSize: '2rem',
            color: 'var(--text-muted, #64748b)',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}

      <h3
        style={{
          margin: 0,
          fontSize: '0.96rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: description ? '6px' : '16px',
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            maxWidth: '360px',
            lineHeight: 1.4,
          }}
        >
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
};
