import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  trailingIcon,
  isLoading = false,
  loadingText,
  fullWidth = false,
  disabled,
  style,
  type = 'button',
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: 'var(--accent-primary)',
          color: '#ffffff',
          border: '1px solid transparent',
        };
      case 'destructive':
        return {
          backgroundColor: 'var(--color-error, #ef4444)',
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
          backgroundColor: 'var(--bg-hover)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return { padding: '4px 8px', fontSize: '0.78rem', height: '26px' };
      case 'lg':
        return { padding: '10px 20px', fontSize: '0.95rem', height: '40px' };
      case 'md':
      default:
        return { padding: '6px 14px', fontSize: '0.85rem', height: '32px' };
    }
  };

  const baseStyles: React.CSSProperties = {
    display: fullWidth ? 'flex' : 'inline-flex',
    width: fullWidth ? '100%' : 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 500,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.6 : 1,
    transition: 'background-color var(--transition-fast), border-color var(--transition-fast), opacity var(--transition-fast)',
    userSelect: 'none',
    boxSizing: 'border-box',
    ...getVariantStyles(),
    ...getSizeStyles(),
    ...style,
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading ? 'true' : undefined}
      className={`qm-button qm-button-${variant} qm-button-${size} ${props.className || ''}`.trim()}
      style={baseStyles}
      {...props}
    >
      {isLoading ? (
        <span
          style={{
            animation: 'spin 1s linear infinite',
            display: 'inline-block',
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          ⟳
        </span>
      ) : (
        icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
      )}
      {isLoading && loadingText ? (
        <span>{loadingText}</span>
      ) : (
        children && <span>{children}</span>
      )}
      {!isLoading && trailingIcon && (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>{trailingIcon}</span>
      )}
    </button>
  );
};
