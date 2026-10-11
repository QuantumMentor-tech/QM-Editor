import React from 'react';

export type ToggleSize = 'sm' | 'md';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  size?: ToggleSize;
  id?: string;
  style?: React.CSSProperties;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  id,
  style,
}) => {
  const isSm = size === 'sm';
  const width = isSm ? '32px' : '40px';
  const height = isSm ? '18px' : '22px';
  const circleSize = isSm ? '14px' : '18px';
  const translateActive = isSm ? '14px' : '18px';

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: description ? 'flex-start' : 'center',
        gap: '10px',
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        ...style,
      }}
      onClick={handleClick}
      className="qm-toggle-container"
    >
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        style={{
          width,
          height,
          backgroundColor: checked ? 'var(--accent-primary, #0284c7)' : 'var(--bg-hover, #334155)',
          border: '1px solid var(--border-color)',
          borderRadius: '9999px',
          position: 'relative',
          padding: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
          outline: 'none',
          flexShrink: 0,
          marginTop: description ? '2px' : 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '1px',
            left: '1px',
            width: circleSize,
            height: circleSize,
            backgroundColor: '#ffffff',
            borderRadius: '50%',
            transition: 'transform var(--transition-fast)',
            transform: checked ? `translateX(${translateActive})` : 'translateX(0)',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
          }}
        />
      </button>

      {(label || description) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {label && (
            <span style={{ fontSize: isSm ? '0.78rem' : '0.84rem', color: 'var(--text-primary)' }}>
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
    </div>
  );
};
