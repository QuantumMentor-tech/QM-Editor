import React from 'react';

export type IconButtonVariant = 'ghost' | 'secondary' | 'outline' | 'primary';
export type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  active?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  'aria-label': ariaLabel,
  variant = 'secondary',
  size = 'md',
  active = false,
  style,
  disabled,
  type = 'button',
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    if (active) {
      return {
        backgroundColor: 'var(--bg-hover)',
        color: 'var(--text-accent)',
        border: '1px solid var(--border-color)',
      };
    }
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--accent-primary)',
          color: '#ffffff',
          border: '1px solid transparent',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--text-primary)',
          border: '1px solid transparent',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
        };
      case 'secondary':
      default:
        return {
          backgroundColor: 'transparent',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return { width: '24px', height: '24px', padding: '2px', fontSize: '0.75rem' };
      case 'lg':
        return { width: '36px', height: '36px', padding: '6px', fontSize: '1rem' };
      case 'md':
      default:
        return { width: '28px', height: '28px', padding: '4px', fontSize: '0.85rem' };
    }
  };

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background-color var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast)',
    userSelect: 'none',
    boxSizing: 'border-box',
    ...getVariantStyles(),
    ...getSizeStyles(),
    ...style,
  };

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      aria-pressed={active ? 'true' : 'false'}
      title={props.title || ariaLabel}
      disabled={disabled}
      className={`qm-icon-button qm-icon-button-${variant} qm-icon-button-${size} ${active ? 'qm-icon-button-active' : ''} ${props.className || ''}`.trim()}
      style={baseStyles}
      {...props}
    >
      {icon}
    </button>
  );
};
