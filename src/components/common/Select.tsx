import React from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export type SelectSize = 'sm' | 'md' | 'lg';
export type SelectVariant = 'default' | 'error' | 'warning';

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: SelectOption[];
  selectSize?: SelectSize;
  variant?: SelectVariant;
  isInvalid?: boolean;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  options,
  selectSize = 'md',
  variant = 'default',
  isInvalid = false,
  placeholder,
  disabled,
  style,
  children,
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
    switch (selectSize) {
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

  const selectStyles: React.CSSProperties = {
    width: '100%',
    height: sizeStyle.height,
    backgroundColor: 'var(--bg-editor, #090d16)',
    border: `1px solid ${getBorderColor()}`,
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: sizeStyle.fontSize,
    padding: sizeStyle.padding,
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    boxSizing: 'border-box',
    transition: 'border-color var(--transition-fast)',
    ...style,
  };

  return (
    <select
      ref={ref}
      disabled={disabled}
      aria-invalid={isInvalid ? 'true' : undefined}
      style={selectStyles}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option
          key={String(opt.value)}
          value={opt.value}
          disabled={opt.disabled}
          style={{
            backgroundColor: 'var(--bg-panel, #1e293b)',
            color: 'var(--text-primary, #f8fafc)',
          }}
        >
          {opt.label}
        </option>
      ))}
      {children}
    </select>
  );
});

Select.displayName = 'Select';
