import React from 'react';

export type InputSize = 'sm' | 'md' | 'lg';
export type InputVariant = 'default' | 'error' | 'warning';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  inputSize?: InputSize;
  variant?: InputVariant;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  isInvalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  inputSize = 'md',
  variant = 'default',
  leadingIcon,
  trailingIcon,
  clearable = false,
  onClear,
  isInvalid = false,
  disabled,
  style,
  value,
  ...props
}, ref) => {
  const effectiveVariant = isInvalid ? 'error' : variant;

  const getBorderColor = (): string => {
    switch (effectiveVariant) {
      case 'error':
        return 'var(--color-error, #ef4444)';
      case 'warning':
        return 'var(--color-warning, #f59e0b)';
      case 'default':
      default:
        return 'var(--border-color)';
    }
  };

  const getSizeStyles = (): { height: string; fontSize: string; padding: string } => {
    switch (inputSize) {
      case 'sm':
        return { height: '26px', fontSize: '0.78rem', padding: '2px 8px' };
      case 'lg':
        return { height: '40px', fontSize: '0.95rem', padding: '8px 12px' };
      case 'md':
      default:
        return { height: '32px', fontSize: '0.85rem', padding: '4px 10px' };
    }
  };

  const sizeStyle = getSizeStyles();

  const containerStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    width: '100%',
    height: sizeStyle.height,
    backgroundColor: 'var(--bg-editor, #090d16)',
    border: `1px solid ${getBorderColor()}`,
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
    boxSizing: 'border-box',
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
    ...style,
  };

  const inputElementStyles: React.CSSProperties = {
    flex: 1,
    height: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'inherit',
    fontSize: sizeStyle.fontSize,
    padding: sizeStyle.padding,
    boxSizing: 'border-box',
    width: '100%',
    fontFamily: 'inherit',
  };

  return (
    <div style={containerStyles} className="qm-input-container">
      {leadingIcon && (
        <span style={{ display: 'inline-flex', alignItems: 'center', paddingLeft: '8px', color: 'var(--text-muted)' }}>
          {leadingIcon}
        </span>
      )}

      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={isInvalid ? 'true' : undefined}
        value={value}
        style={inputElementStyles}
        {...props}
      />

      {clearable && value && !disabled && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear input"
          tabIndex={-1}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0 6px',
            fontSize: '0.9rem',
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          ✕
        </button>
      )}

      {trailingIcon && (
        <span style={{ display: 'inline-flex', alignItems: 'center', paddingRight: '8px', color: 'var(--text-muted)' }}>
          {trailingIcon}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
