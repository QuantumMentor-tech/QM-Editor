/**
 * QM Editor Code Action Preview & Confirmation Modal
 * Phase 04, Step 44 — Code Actions, Quick Fixes & Safe Code Transformation Foundation
 */

import React, { useState } from 'react';
import { CodeActionPreview } from '../../core/language-intelligence/CodeActionTypes';
import { X, Check, FileCode, AlertTriangle, Eye } from 'lucide-react';

export interface CodeActionPreviewModalProps {
  preview: CodeActionPreview;
  onApply: () => void;
  onCancel: () => void;
}

export const CodeActionPreviewModal: React.FC<CodeActionPreviewModalProps> = ({
  preview,
  onApply,
  onCancel,
}) => {
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const activeFile = preview.affectedFiles[selectedFileIndex];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="code-action-preview-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: '780px',
          maxWidth: '92vw',
          maxHeight: '85vh',
          backgroundColor: 'var(--bg-secondary, #1e1e2e)',
          border: '1px solid var(--border-color, #313244)',
          borderRadius: '8px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color, #313244)',
            backgroundColor: 'var(--bg-primary, #181825)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={16} style={{ color: 'var(--text-accent, #89b4fa)' }} />
            <h3
              id="code-action-preview-title"
              style={{
                margin: 0,
                fontSize: '0.95rem',
                fontWeight: 600,
                color: 'var(--text-primary, #cdd6f4)',
              }}
            >
              Preview: {preview.actionTitle}
            </h3>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(137, 180, 250, 0.15)',
                color: 'var(--text-accent, #89b4fa)',
              }}
            >
              {preview.providerId}
            </span>
          </div>

          <button
            onClick={onCancel}
            aria-label="Close Preview"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #a6adc8)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Confirmation Warning if multi-file or resource operations */}
        {preview.requiresConfirmation && (
          <div
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(249, 226, 175, 0.1)',
              borderBottom: '1px solid rgba(249, 226, 175, 0.25)',
              color: '#f9e2af',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertTriangle size={14} />
            <span>{preview.confirmationReason || 'Please review the proposed modifications carefully.'}</span>
          </div>
        )}

        {/* Content Body: File list on left, Diff on right */}
        <div style={{ display: 'flex', flex: 1, minHeight: '340px', overflow: 'hidden' }}>
          {/* File Selector */}
          <div
            style={{
              width: '240px',
              borderRight: '1px solid var(--border-color, #313244)',
              backgroundColor: 'var(--bg-primary, #181825)',
              overflowY: 'auto',
              padding: '8px 0',
            }}
          >
            <div
              style={{
                padding: '4px 12px 8px',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                color: 'var(--text-muted, #6c7086)',
                fontWeight: 600,
              }}
            >
              Affected Files ({preview.affectedFiles.length})
            </div>

            {preview.affectedFiles.map((file, idx) => {
              const isSelected = idx === selectedFileIndex;
              const fileName = file.resourceUri.split('/').pop() || file.resourceUri;
              return (
                <div
                  key={file.resourceUri}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedFileIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? 'rgba(137, 180, 250, 0.15)'
                      : 'transparent',
                    color: isSelected
                      ? 'var(--text-accent, #89b4fa)'
                      : 'var(--text-primary, #cdd6f4)',
                    borderLeft: isSelected ? '3px solid var(--text-accent, #89b4fa)' : '3px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <FileCode size={14} style={{ flexShrink: 0 }} />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {fileName}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '1px 5px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-secondary, #313244)',
                      color: 'var(--text-muted, #a6adc8)',
                    }}
                  >
                    {file.editsCount}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Diff View for active file */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-secondary, #1e1e2e)',
              overflow: 'hidden',
            }}
          >
            {activeFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div
                  style={{
                    padding: '6px 12px',
                    borderBottom: '1px solid var(--border-color, #313244)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted, #a6adc8)',
                    fontFamily: 'monospace',
                  }}
                >
                  {activeFile.resourceUri}
                </div>

                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px',
                    fontFamily: 'Consolas, Monaco, monospace',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                  }}
                >
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    <code style={{ color: 'var(--text-primary, #cdd6f4)' }}>
                      {activeFile.proposedContent}
                    </code>
                  </pre>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-muted, #a6adc8)',
                  fontSize: '0.85rem',
                }}
              >
                No files selected.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '10px 16px',
            borderTop: '1px solid var(--border-color, #313244)',
            backgroundColor: 'var(--bg-primary, #181825)',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              borderRadius: '4px',
              border: '1px solid var(--border-color, #313244)',
              backgroundColor: 'transparent',
              color: 'var(--text-primary, #cdd6f4)',
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            onClick={onApply}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 16px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: 'var(--text-accent, #89b4fa)',
              color: '#11111b',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            <Check size={14} />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
