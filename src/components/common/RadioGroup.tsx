import React from 'react';

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  name: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  'aria-label'?: string;
  style?: React.CSSProperties;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({
  name,
  options,
  value,
  onChange,
  orientation = 'vertical',
  'aria-label': ariaLabel,
  style,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (index + 1) % options.length;
      while (options[nextIndex]?.disabled && nextIndex !== index) {
        nextIndex = (nextIndex + 1) % options.length;
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (index - 1 + options.length) % options.length;
      while (options[nextIndex]?.disabled && nextIndex !== index) {
        nextIndex = (nextIndex - 1 + options.length) % options.length;
      }
    }

    if (nextIndex !== index && !options[nextIndex]?.disabled) {
      onChange(options[nextIndex].value);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        gap: orientation === 'vertical' ? '8px' : '16px',
        ...style,
      }}
      className="qm-radio-group"
    >
      {options.map((opt, idx) => {
        const isSelected = opt.value === value;
        return (
          <label
            key={opt.value}
            style={{
              display: 'inline-flex',
              alignItems: opt.description ? 'flex-start' : 'center',
              gap: '8px',
              cursor: opt.disabled ? 'not-allowed' : 'pointer',
              opacity: opt.disabled ? 0.6 : 1,
              userSelect: 'none',
            }}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={isSelected}
              disabled={opt.disabled}
              onChange={() => onChange(opt.value)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              style={{
                width: '16px',
                height: '16px',
                cursor: opt.disabled ? 'not-allowed' : 'pointer',
                accentColor: 'var(--accent-primary, #0284c7)',
                marginTop: opt.description ? '2px' : 0,
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                {opt.label}
              </span>
              {opt.description && (
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {opt.description}
                </span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
};
