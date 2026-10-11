import React from 'react';
import { FocusTrap } from '../accessibility/FocusTrap';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  const titleId = `dialog-title-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div
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
        zIndex: 'var(--z-modal, 1000)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <FocusTrap
        active={isOpen}
        scope="dialog"
        onEscape={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          width: '90%',
          maxWidth: '480px',
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          padding: '20px',
          color: 'var(--text-primary)',
          outline: 'none',
        }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '12px',
          }}
        >
          <h3 id={titleId} style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close Dialog"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '1.2rem',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            ✕
          </button>
        </div>
        <div>{children}</div>
      </FocusTrap>
    </div>
  );
};
