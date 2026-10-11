import React from 'react';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  style?: React.CSSProperties;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  label = 'Loading...',
  style,
}) => {
  const getDimension = (): number => {
    switch (size) {
      case 'sm':
        return 14;
      case 'lg':
        return 28;
      case 'md':
      default:
        return 20;
    }
  };

  const dim = getDimension();

  return (
    <div
      role="status"
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        ...style,
      }}
      className="qm-spinner"
    >
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          animation: 'spin 1s linear infinite',
          color: 'var(--accent-primary, #0284c7)',
        }}
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', border: 0 }}>
        {label}
      </span>
    </div>
  );
};

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '16px',
  borderRadius = 'var(--radius-sm, 4px)',
  style,
}) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--bg-hover, #334155)',
        animation: 'pulse 1.5s ease-in-out infinite',
        boxSizing: 'border-box',
        ...style,
      }}
      aria-hidden="true"
      className="qm-skeleton"
    />
  );
};
