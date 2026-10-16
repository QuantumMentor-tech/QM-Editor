/**
 * QM Editor Rename Modal Dialog
 * Phase 06, Step 62 — LSP Rename, Prepare Rename & Safe Multi-File Workspace Edit Integration
 */

import React, { useState, useEffect, useRef } from 'react';
import { Range } from '../../core/navigation/LocationTypes';
import { LspWorkspaceEditValidator } from '../../core/lsp/rename/LspWorkspaceEditValidator';
import { Edit3, X, AlertCircle } from 'lucide-react';
import { IconButton } from '../common/IconButton';

export interface RenameModalProps {
  currentName: string;
  range?: Range;
  isOpen: boolean;
  onRename: (newName: string) => Promise<void> | void;
  onClose: () => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  currentName,
  isOpen,
  onRename,
  onClose,
}) => {
  const [newName, setNewName] = useState(currentName);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
      setValidationError(null);
      setIsSubmitting(false);

      // Focus and select the text
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, currentName]);

  // Real-time validation
  useEffect(() => {
    if (!isOpen) return;

    const validation = LspWorkspaceEditValidator.validateNewName(newName, currentName);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid symbol name.');
    } else {
      setValidationError(null);
    }
  }, [newName, currentName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (validationError || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onRename(newName.trim());
      onClose();
    } catch {
      // Errors handled by coordinator
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && !validationError) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-modal-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          width: '420px',
          maxWidth: '92vw',
          backgroundColor: 'var(--bg-panel, #1e1e2e)',
          borderRadius: 'var(--radius-lg, 10px)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            backgroundColor: 'var(--bg-surface, #181825)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--text-primary, #cdd6f4)' }}>
            <Edit3 size={16} style={{ color: 'var(--accent-primary, #89b4fa)' }} />
            <span id="rename-modal-title">Rename Symbol</span>
          </div>
          <IconButton onClick={onClose} icon={<X size={14} />} aria-label="Close dialog" />
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="rename-input"
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary, #a6adc8)',
                fontWeight: 500,
              }}
            >
              New name for <code style={{ color: 'var(--accent-primary, #89b4fa)' }}>{currentName}</code>:
            </label>
            <input
              id="rename-input"
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={isSubmitting}
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '0.9rem',
                backgroundColor: 'var(--bg-input, #11111b)',
                color: 'var(--text-primary, #cdd6f4)',
                border: `1px solid ${validationError ? 'var(--status-error, #f38ba8)' : 'var(--border-color, rgba(255, 255, 255, 0.15))'}`,
                borderRadius: 'var(--radius-sm, 6px)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Validation Error Message */}
          {validationError && (
            <div
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--status-error, #f38ba8)',
                fontSize: '0.78rem',
              }}
            >
              <AlertCircle size={14} />
              <span>{validationError}</span>
            </div>
          )}

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '4px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '6px 14px',
                fontSize: '0.84rem',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary, #a6adc8)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                borderRadius: 'var(--radius-sm, 6px)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={Boolean(validationError) || isSubmitting}
              style={{
                padding: '6px 16px',
                fontSize: '0.84rem',
                fontWeight: 600,
                backgroundColor: validationError ? 'var(--bg-disabled, rgba(255, 255, 255, 0.08))' : 'var(--accent-primary, #89b4fa)',
                color: validationError ? 'var(--text-muted, #6c7086)' : '#11111b',
                border: 'none',
                borderRadius: 'var(--radius-sm, 6px)',
                cursor: validationError ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              {isSubmitting ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
