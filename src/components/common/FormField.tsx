import React from 'react';

export interface FormFieldProps {
  id: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  warning?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  description,
  error,
  warning,
  required = false,
  disabled = false,
  style,
  children,
}) => {
  const labelId = `${id}-label`;
  const descId = `${id}-desc`;
  const errorId = `${id}-error`;

  const describedByParts: string[] = [];
  if (description) describedByParts.push(descId);
  if (error || warning) describedByParts.push(errorId);
  const ariaDescribedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        width: '100%',
        boxSizing: 'border-box',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
      className="qm-form-field"
    >
      {label && (
        <label
          id={labelId}
          htmlFor={id}
          style={{
            fontSize: '0.82rem',
            fontWeight: 500,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            userSelect: 'none',
          }}
        >
          {label}
          {required && (
            <span style={{ color: 'var(--color-error, #ef4444)' }} aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {description && (
        <div
          id={descId}
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      )}

      <div style={{ width: '100%' }}>
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<any>, {
              id: (children.props as any).id || id,
              'aria-describedby':
                (children.props as any)['aria-describedby'] || ariaDescribedBy,
              'aria-invalid': error ? 'true' : (children.props as any)['aria-invalid'],
              disabled: disabled || (children.props as any).disabled,
            })
          : children}
      </div>

      {error && (
        <div
          id={errorId}
          role="alert"
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-error, #ef4444)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {!error && warning && (
        <div
          id={errorId}
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-warning, #f59e0b)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>ℹ</span>
          <span>{warning}</span>
        </div>
      )}
    </div>
  );
};
