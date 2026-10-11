import React from 'react';

export type DividerOrientation = 'horizontal' | 'vertical';
export type DividerSpacing = 'none' | 'sm' | 'md' | 'lg';

export interface DividerProps {
  orientation?: DividerOrientation;
  spacing?: DividerSpacing;
  label?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  spacing = 'md',
  label,
  style,
}) => {
  const isHorizontal = orientation === 'horizontal';

  const getSpacingPx = (): string => {
    switch (spacing) {
      case 'none':
        return '0';
      case 'sm':
        return '4px';
      case 'lg':
        return '16px';
      case 'md':
      default:
        return '8px';
    }
  };

  const margin = getSpacingPx();

  if (isHorizontal && label) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: `${margin} 0`,
          width: '100%',
          ...style,
        }}
        className="qm-divider-with-label"
      >
        <span style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <span style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
      </div>
    );
  }

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      style={{
        backgroundColor: 'var(--border-color)',
        ...(isHorizontal
          ? {
              width: '100%',
              height: '1px',
              margin: `${margin} 0`,
            }
          : {
              width: '1px',
              height: '100%',
              margin: `0 ${margin}`,
            }),
        flexShrink: 0,
        ...style,
      }}
      className="qm-divider"
    />
  );
};
