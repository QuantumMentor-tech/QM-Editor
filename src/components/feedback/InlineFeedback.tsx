import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { FeedbackSeverity } from '../../core/feedback/FeedbackTypes';

export interface InlineFeedbackProps {
  severity?: Extract<FeedbackSeverity, 'error' | 'warning' | 'info'>;
  message: string;
  id?: string;
  className?: string;
  compact?: boolean;
}

export const InlineFeedback: React.FC<InlineFeedbackProps> = ({
  severity = 'error',
  message,
  id,
  className,
  compact = false,
}) => {
  if (!message) return null;

  const isError = severity === 'error';
  const isWarning = severity === 'warning';

  const iconColor = isError
    ? 'var(--error, #f85149)'
    : isWarning
    ? 'var(--warning, #d29922)'
    : 'var(--accent-primary, #58a6ff)';

  const textColor = isError
    ? 'var(--error, #f85149)'
    : isWarning
    ? 'var(--warning, #d29922)'
    : 'var(--text-secondary)';

  return (
    <div
      id={id}
      className={className}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '4px' : '6px',
        fontSize: compact ? '0.72rem' : '0.78rem',
        color: textColor,
        lineHeight: 1.3,
        marginTop: compact ? '2px' : '4px',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
        {isError && <AlertCircle size={compact ? 12 : 14} color={iconColor} />}
        {isWarning && <AlertTriangle size={compact ? 12 : 14} color={iconColor} />}
        {severity === 'info' && <Info size={compact ? 12 : 14} color={iconColor} />}
      </span>
      <span>{message}</span>
    </div>
  );
};
