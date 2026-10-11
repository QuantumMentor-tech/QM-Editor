import React from 'react';

export interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  showValue?: boolean;
  formatValue?: (v: number) => string;
  disabled?: boolean;
  id?: string;
  style?: React.CSSProperties;
}

export const Slider: React.FC<SliderProps> = ({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  showValue = true,
  formatValue,
  disabled = false,
  id,
  style,
}) => {
  const displayVal = formatValue ? formatValue(value) : String(value);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        width: '100%',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
      className="qm-slider-container"
    >
      {(label || showValue) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {label && (
            <label htmlFor={id} style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
              {label}
            </label>
          )}
          {showValue && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-accent)', fontFamily: 'var(--font-code)' }}>
              {displayVal}
            </span>
          )}
        </div>
      )}

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%',
          accentColor: 'var(--accent-primary, #0284c7)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      />
    </div>
  );
};
