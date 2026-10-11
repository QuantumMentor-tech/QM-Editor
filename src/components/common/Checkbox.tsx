import React, { useEffect, useRef } from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  isInvalid?: boolean;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({
  checked = false,
  indeterminate = false,
  onChange,
  label,
  description,
  isInvalid = false,
  disabled = false,
  style,
  id,
  ...props
}, forwardedRef) => {
  const localRef = useRef<HTMLInputElement>(null);
  const inputRef = (forwardedRef as React.RefObject<HTMLInputElement>) || localRef;

  useEffect(() => {
    if (inputRef && 'current' in inputRef && inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate, inputRef]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.checked);
    }
  };

  return (
    <label
      htmlFor={id}
      style={{
        display: 'inline-flex',
        alignItems: description ? 'flex-start' : 'center',
        gap: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        userSelect: 'none',
        ...style,
      }}
      className="qm-checkbox-label"
    >
      <input
        ref={inputRef}
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-invalid={isInvalid ? 'true' : undefined}
        onChange={handleChange}
        style={{
          width: '16px',
          height: '16px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          accentColor: 'var(--accent-primary, #0284c7)',
          marginTop: description ? '2px' : '0',
        }}
        {...props}
      />

      {(label || description) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {label && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 400 }}>
              {label}
            </span>
          )}
          {description && (
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
});

Checkbox.displayName = 'Checkbox';
