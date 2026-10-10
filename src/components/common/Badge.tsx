import React from 'react';

export type BadgeVariant = 'primary' | 'accent' | 'warning' | 'success' | 'muted';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'primary', style }) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'accent':
        return { backgroundColor: 'var(--accent-primary)', color: '#ffffff' };
      case 'warning':
        return { backgroundColor: '#f59e0b', color: '#ffffff' };
      case 'success':
        return { backgroundColor: '#10b981', color: '#ffffff' };
      case 'muted':
        return { backgroundColor: 'var(--bg-hover)', color: 'var(--text-muted)' };
      case 'primary':
      default:
        return { backgroundColor: 'var(--bg-hover)', color: 'var(--text-primary)' };
    }
  };

  const badgeStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1,
    ...getVariantStyles(),
    ...style,
  };

  return <span style={badgeStyles}>{children}</span>;
};
