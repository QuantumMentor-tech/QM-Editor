import React from 'react';

export type TextareaSize = 'sm' | 'md' | 'lg';
export type TextareaVariant = 'default' | 'error' | 'warning';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  textareaSize?: TextareaSize;
  variant?: TextareaVariant;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
  isInvalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({
  textareaSize = 'md',
  variant = 'default',
  resize = 'vertical',
  isInvalid = false,
  disabled,
  style,
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

  const getFontSize = (): string => {
    switch (textareaSize) {
      case 'sm':
        return '0.78rem';
      case 'lg':
        return '0.95rem';
      case 'md':
      default:
        return '0.85rem';
    }
  };

  const baseStyles: React.CSSProperties = {
    width: '100%',
    backgroundColor: 'var(--bg-editor, #090d16)',
    border: `1px solid ${getBorderColor()}`,
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontSize: getFontSize(),
    fontFamily: 'inherit',
    padding: '8px 10px',
    outline: 'none',
    resize,
    boxSizing: 'border-box',
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
    transition: 'border-color var(--transition-fast)',
    ...style,
  };

  return (
    <textarea
      ref={ref}
      disabled={disabled}
      aria-invalid={isInvalid ? 'true' : undefined}
      style={baseStyles}
      {...props}
    />
  );
});

Textarea.displayName = 'Textarea';
