import React from 'react';
import { WorkspaceReplacePlan } from '../../services/WorkspaceReplaceService';
import { Button } from '../common/Button';
import { AlertTriangle, CheckCircle, FileCode } from 'lucide-react';

export interface WorkspaceReplaceModalProps {
  plan: WorkspaceReplacePlan;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const WorkspaceReplaceModal: React.FC<WorkspaceReplaceModalProps> = ({
  plan,
  onConfirm,
  onClose,
}) => {
  return (
    <div
      role="dialog"
      aria-label="Confirm Workspace Replace"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        maxWidth: '540px',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <AlertTriangle size={22} style={{ color: 'var(--accent-color)' }} />
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
            Confirm Multi-File Replacement
          </h4>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Search MAY be fast. Replace MUST be deliberate.
          </p>
        </div>
      </div>

      <div
        style={{
          padding: '12px 14px',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.88rem',
          lineHeight: '1.5',
        }}
      >
        Replace <strong>{plan.totalMatchesCount}</strong> occurrences of &quot;
        <span style={{ color: 'var(--accent-color)' }}>{plan.query.query}</span>&quot; with &quot;
        <span style={{ color: '#00d2ff' }}>{plan.replaceText}</span>&quot; across{' '}
        <strong>{plan.readyFilesCount}</strong> ready target files?
      </div>

      {plan.blockedFilesCount > 0 && (
        <div
          style={{
            padding: '10px 12px',
            backgroundColor: 'rgba(255, 170, 0, 0.12)',
            border: '1px solid rgba(255, 170, 0, 0.3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            color: '#ffaa00',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} />
          <span>
            {plan.blockedFilesCount} {plan.blockedFilesCount === 1 ? 'file is' : 'files are'} blocked (unsaved open edits or read-only) and will be skipped safely.
          </span>
        </div>
      )}

      {/* Target File Plans List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          maxHeight: '200px',
          overflowY: 'auto',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        {plan.filePlans.map((fp) => (
          <div
            key={fp.resource.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-panel)',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <FileCode size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontWeight: 600 }}>{fp.resource.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                ({fp.resource.relativePath})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '1px 5px',
                  borderRadius: '3px',
                }}
              >
                {fp.matches.length} {fp.matches.length === 1 ? 'match' : 'matches'}
              </span>

              {fp.status === 'ready' ? (
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: '#00d2ff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <CheckCircle size={12} /> Ready
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: '#ffaa00',
                    fontStyle: 'italic',
                  }}
                >
                  {fp.status === 'dirty_open' ? 'Unsaved Edit' : 'Blocked'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
        <Button onClick={onClose} variant="secondary">
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={plan.readyFilesCount === 0}
          variant="primary"
        >
          Confirm Replacement ({plan.readyFilesCount} files)
        </Button>
      </div>
    </div>
  );
};
