import React from 'react';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'warning'
  | 'success'
  | 'error'
  | 'neutral'
  | 'muted';

export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  style,
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'accent':
        return { backgroundColor: 'var(--accent-primary)', color: '#ffffff' };
      case 'warning':
        return { backgroundColor: 'var(--color-warning, #f59e0b)', color: '#ffffff' };
      case 'success':
        return { backgroundColor: 'var(--color-success, #10b981)', color: '#ffffff' };
      case 'error':
        return { backgroundColor: 'var(--color-error, #ef4444)', color: '#ffffff' };
      case 'muted':
        return { backgroundColor: 'var(--bg-hover)', color: 'var(--text-muted)' };
      case 'neutral':
        return { backgroundColor: 'var(--bg-secondary, #334155)', color: 'var(--text-secondary)' };
      case 'secondary':
        return { backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' };
      case 'primary':
      default:
        return { backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)' };
    }
  };

  const isSm = size === 'sm';

  const badgeStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: isSm ? '1px 6px' : '2px 8px',
    borderRadius: '12px',
    fontSize: isSm ? '0.7rem' : '0.75rem',
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    ...getVariantStyles(),
    ...style,
  };

  return (
    <span style={badgeStyles} className="qm-badge">
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </span>
  );
};
