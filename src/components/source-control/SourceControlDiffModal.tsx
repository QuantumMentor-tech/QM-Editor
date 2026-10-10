/**
 * QM Editor Source Control Diff Inspection Modal
 * Phase 1, Step 18 — Git Integration & Source Control Foundation
 */

import React from 'react';
import { SourceControlDiffResult } from '../../core/source-control/SourceControlTypes';
import { GitCompare, AlertTriangle, FileCode } from 'lucide-react';
import { Button } from '../common/Button';

export interface SourceControlDiffModalProps {
  diffResult: SourceControlDiffResult;
  onClose: () => void;
}

export const SourceControlDiffModal: React.FC<SourceControlDiffModalProps> = ({ diffResult, onClose }) => {
  const fileName = diffResult.filePath.split('/').pop() || diffResult.filePath || 'File Diff';

  const renderDiffLines = () => {
    if (diffResult.isBinary) {
      return (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <AlertTriangle size={32} style={{ color: 'var(--warning)', marginBottom: '8px' }} />
          <p style={{ fontWeight: 600 }}>Binary File Comparison Unsupported</p>
          <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>
            {diffResult.error || 'Binary files cannot be compared in text diff mode.'}
          </p>
        </div>
      );
    }

    if (diffResult.error) {
      return (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--error)' }}>
          <AlertTriangle size={32} style={{ marginBottom: '8px' }} />
          <p style={{ fontWeight: 600 }}>Diff Inspection Failed</p>
          <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>{diffResult.error}</p>
        </div>
      );
    }

    const origLines = diffResult.originalContent ? diffResult.originalContent.split('\n') : [];
    const modLines = diffResult.modifiedContent ? diffResult.modifiedContent.split('\n') : [];

    if (origLines.length === 0 && modLines.length === 0) {
      return (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p>No content changes detected.</p>
        </div>
      );
    }

    return (
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: '0.82rem',
          lineHeight: '1.5',
          overflowX: 'auto',
          backgroundColor: 'var(--bg-editor)',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          maxHeight: '420px',
        }}
      >
        {modLines.map((line, idx) => {
          const origLine = origLines[idx];
          const isAdded = origLine === undefined || origLine !== line;
          const isDeleted = origLine !== undefined && origLines.length > modLines.length && idx >= modLines.length;

          let bg = 'transparent';
          let prefix = ' ';
          let color = 'var(--text-primary)';

          if (isAdded) {
            bg = 'rgba(46, 160, 67, 0.15)';
            prefix = '+';
            color = 'var(--success)';
          } else if (isDeleted) {
            bg = 'rgba(248, 81, 73, 0.15)';
            prefix = '-';
            color = 'var(--error)';
          }

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                backgroundColor: bg,
                color,
                padding: '2px 6px',
                borderRadius: '2px',
              }}
            >
              <span style={{ width: '40px', color: 'var(--text-muted)', userSelect: 'none' }}>{idx + 1}</span>
              <span style={{ width: '20px', fontWeight: 700, userSelect: 'none' }}>{prefix}</span>
              <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{line}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-label={`Diff Inspection for ${fileName}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        minWidth: '580px',
        maxWidth: '800px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <GitCompare size={20} style={{ color: 'var(--accent-primary)' }} />
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Diff Inspection — {fileName}</span>
        <span
          style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-active)',
            color: 'var(--text-muted)',
            marginLeft: 'auto',
          }}
        >
          Read-Only Comparison
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <FileCode size={14} />
        <span style={{ wordBreak: 'break-all' }}>{diffResult.filePath}</span>
      </div>

      {renderDiffLines()}

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
        <Button variant="secondary" onClick={onClose}>
          Close Inspection
        </Button>
      </div>
    </div>
  );
};
