import React, { useState } from 'react';
import { useFeedback } from '../../state/FeedbackContext';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import { FeedbackMessage, FeedbackSeverity } from '../../core/feedback/FeedbackTypes';

const SEVERITY_ICONS: Record<FeedbackSeverity, React.ReactNode> = {
  success: <CheckCircle2 size={16} color="var(--success, #2ea043)" />,
  info: <Info size={16} color="var(--accent-primary, #58a6ff)" />,
  warning: <AlertTriangle size={16} color="var(--warning, #d29922)" />,
  error: <AlertCircle size={16} color="var(--error, #f85149)" />,
};

const SEVERITY_BORDERS: Record<FeedbackSeverity, string> = {
  success: 'var(--success, #2ea043)',
  info: 'var(--accent-primary, #58a6ff)',
  warning: 'var(--warning, #d29922)',
  error: 'var(--error, #f85149)',
};

export const ToastItem: React.FC<{ toast: FeedbackMessage; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleCopyDetails = () => {
    if (toast.details && navigator.clipboard) {
      navigator.clipboard.writeText(toast.details);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      role={toast.severity === 'error' ? 'alert' : 'status'}
      aria-live={toast.severity === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: '300px',
        maxWidth: '440px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderLeft: `4px solid ${SEVERITY_BORDERS[toast.severity]}`,
        borderRadius: 'var(--radius-sm)',
        boxShadow: isHovered ? '0 6px 18px rgba(0, 0, 0, 0.55)' : '0 4px 14px rgba(0, 0, 0, 0.4)',
        padding: '10px 12px',
        color: 'var(--text-primary)',
        fontSize: '0.82rem',
        userSelect: 'text',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0 }}>
          <div style={{ marginTop: '1px', flexShrink: 0 }}>
            {SEVERITY_ICONS[toast.severity]}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {toast.title && (
              <div style={{ fontWeight: 600, fontSize: '0.84rem', marginBottom: '2px' }}>
                {toast.title}
              </div>
            )}
            <div style={{ lineHeight: '1.4', wordBreak: 'break-word' }}>
              {toast.message}
              {toast.repeatCount && toast.repeatCount > 1 && (
                <span
                  style={{
                    marginLeft: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--text-accent)',
                    backgroundColor: 'var(--bg-tertiary)',
                    padding: '1px 5px',
                    borderRadius: '3px',
                  }}
                >
                  ×{toast.repeatCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {toast.dismissible !== false && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss notification"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Action Buttons */}
      {toast.actions && toast.actions.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', paddingLeft: '24px' }}>
          {toast.actions.map((act) => (
            <button
              key={act.id}
              onClick={async () => {
                await act.run();
                onDismiss();
              }}
              style={{
                backgroundColor: act.isPrimary ? 'var(--accent-primary, #58a6ff)' : 'var(--bg-tertiary)',
                color: act.isPrimary ? '#ffffff' : 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '3px 8px',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {act.label}
            </button>
          ))}
        </div>
      )}

      {/* Optional Technical Details Toggle */}
      {toast.details && (
        <div style={{ marginTop: '8px', paddingLeft: '24px' }}>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-accent)',
              fontSize: '0.72rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: 0,
            }}
          >
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span>{showDetails ? 'Hide Details' : 'View Details'}</span>
          </button>

          {showDetails && (
            <div
              style={{
                marginTop: '6px',
                padding: '6px 8px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-code, monospace)',
                fontSize: '0.72rem',
                maxHeight: '120px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                position: 'relative',
              }}
            >
              <button
                onClick={handleCopyDetails}
                title="Copy Sanitized Technical Details"
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '3px',
                  padding: '2px 4px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '0.68rem',
                }}
              >
                {copied ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              {toast.details}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ToastHost: React.FC = () => {
  const { toasts, dismiss } = useFeedback();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      style={{
        position: 'fixed',
        bottom: '36px',
        right: '16px',
        zIndex: 9990,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '8px',
        pointerEvents: 'auto',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  );
};
