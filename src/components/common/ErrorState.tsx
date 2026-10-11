import React, { useState } from 'react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  details?: string;
  onRetry?: () => void;
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  details,
  onRetry,
  action,
  style,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        textAlign: 'center',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
      className="qm-error-state"
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          color: 'var(--color-error, #ef4444)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          marginBottom: '12px',
        }}
        aria-hidden="true"
      >
        ⚠
      </div>

      <h3
        style={{
          margin: '0 0 6px 0',
          fontSize: '0.96rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: '0 0 16px 0',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          maxWidth: '400px',
          lineHeight: 1.4,
        }}
      >
        {message}
      </p>

      {(onRetry || action || details) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onRetry && (
              <Button variant="primary" size="sm" onClick={onRetry}>
                Try Again
              </Button>
            )}
            {action}
            {details && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </Button>
            )}
          </div>

          {details && showDetails && (
            <pre
              style={{
                marginTop: '10px',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-editor, #090d16)',
                border: '1px solid var(--border-color)',
                color: 'var(--color-error, #ef4444)',
                fontFamily: 'var(--font-code)',
                fontSize: '0.74rem',
                textAlign: 'left',
                maxWidth: '450px',
                maxHeight: '160px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {details}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
