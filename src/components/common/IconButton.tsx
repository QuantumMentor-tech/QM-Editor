import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string;
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  'aria-label': ariaLabel,
  active = false,
  style,
  disabled,
  ...props
}) => {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px',
    background: active ? 'var(--bg-hover)' : 'transparent',
    border: '1px solid var(--border-color)',
    color: active ? 'var(--text-accent)' : 'var(--text-primary)',
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background-color var(--transition-fast), color var(--transition-fast)',
    ...style,
  };

  return (
    <button aria-label={ariaLabel} disabled={disabled} style={baseStyles} {...props}>
      {icon}
    </button>
  );
};
