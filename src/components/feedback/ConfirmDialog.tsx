import React, { useEffect, useRef, useState } from 'react';
import { useFeedback } from '../../state/FeedbackContext';
import { AlertCircle, AlertTriangle, Info, HelpCircle } from 'lucide-react';

export const ConfirmDialog: React.FC = () => {
  const { activeConfirm, resolveActiveConfirm } = useFeedback();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus management & focus trap
  useEffect(() => {
    if (!activeConfirm) return undefined;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setIsSubmitting(false);

    // Safe default: focus Cancel button by default to prevent accidental destructive execution
    setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        resolveActiveConfirm('cancelled');
      } else if (e.key === 'Tab') {
        // Trap focus between Cancel and Confirm buttons
        if (e.shiftKey) {
          if (document.activeElement === cancelButtonRef.current) {
            e.preventDefault();
            confirmButtonRef.current?.focus();
          }
        } else {
          if (document.activeElement === confirmButtonRef.current) {
            e.preventDefault();
            cancelButtonRef.current?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [activeConfirm, resolveActiveConfirm]);

  if (!activeConfirm) return null;

  const handleConfirm = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    resolveActiveConfirm('confirmed');
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    resolveActiveConfirm('cancelled');
  };

  const isDestructive = Boolean(activeConfirm.isDestructive);

  const renderIcon = () => {
    if (isDestructive || activeConfirm.severity === 'error') {
      return <AlertCircle size={22} color="var(--error, #f85149)" />;
    }
    if (activeConfirm.severity === 'warning') {
      return <AlertTriangle size={22} color="var(--warning, #d29922)" />;
    }
    if (activeConfirm.severity === 'info') {
      return <Info size={22} color="var(--accent-primary, #58a6ff)" />;
    }
    return <HelpCircle size={22} color="var(--accent-primary, #58a6ff)" />;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 'var(--z-modal, 1000)' as unknown as number,
        backdropFilter: 'blur(3px)',
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '460px',
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md, 0 8px 24px rgba(0, 0, 0, 0.5))',
          padding: '20px',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
          <div style={{ marginTop: '2px', flexShrink: 0 }}>{renderIcon()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              id="confirm-dialog-title"
              style={{
                margin: '0 0 6px 0',
                fontSize: '1.05rem',
                fontWeight: 600,
                color: isDestructive ? 'var(--error, #f85149)' : 'var(--text-primary)',
              }}
            >
              {activeConfirm.title}
            </h3>
            <p
              id="confirm-dialog-desc"
              style={{
                margin: 0,
                fontSize: '0.85rem',
                lineHeight: '1.5',
                color: 'var(--text-secondary)',
              }}
            >
              {activeConfirm.message}
            </p>
            {activeConfirm.details && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-code, monospace)',
                  color: 'var(--text-muted)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {activeConfirm.details}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
          <button
            ref={cancelButtonRef}
            onClick={handleCancel}
            disabled={isSubmitting}
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              fontWeight: 500,
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            {activeConfirm.cancelLabel || 'Cancel'}
          </button>

          <button
            ref={confirmButtonRef}
            onClick={handleConfirm}
            disabled={isSubmitting}
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: isDestructive ? 'var(--error, #f85149)' : 'var(--accent-primary, #58a6ff)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: '#ffffff',
              cursor: isSubmitting ? 'wait' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {activeConfirm.confirmLabel || (isDestructive ? 'Delete' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
