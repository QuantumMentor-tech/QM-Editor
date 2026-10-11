import React from 'react';
import { useFeedback } from '../../state/FeedbackContext';
import { Loader2, X } from 'lucide-react';
import { ProgressTaskState } from '../../core/feedback/FeedbackTypes';

export const ProgressItem: React.FC<{ task: ProgressTaskState; onCancel: () => void }> = ({
  task,
  onCancel,
}) => {
  const isDeterminate = task.mode === 'determinate' && task.total !== undefined && task.total > 0;
  const percent = isDeterminate
    ? Math.min(100, Math.round(((task.current || 0) / (task.total || 1)) * 100))
    : null;

  return (
    <div
      role="progressbar"
      aria-label={task.title}
      aria-valuenow={percent !== null ? percent : undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '280px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
        padding: '8px 12px',
        fontSize: '0.78rem',
        color: 'var(--text-primary)',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </span>
        </div>

        {task.cancellable && (
          <button
            onClick={onCancel}
            title="Cancel Operation"
            aria-label="Cancel Operation"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={13} />
          </button>
        )}
      </div>

      {task.message && (
        <div
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: '6px',
          }}
        >
          {task.message}
        </div>
      )}

      {/* Progress Track */}
      <div
        style={{
          height: '4px',
          width: '100%',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: '2px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {isDeterminate ? (
          <div
            style={{
              height: '100%',
              width: `${percent}%`,
              backgroundColor: 'var(--accent-primary, #58a6ff)',
              transition: 'width 0.2s ease',
            }}
          />
        ) : (
          <div
            style={{
              height: '100%',
              width: '40%',
              backgroundColor: 'var(--accent-primary, #58a6ff)',
              borderRadius: '2px',
              animation: 'indeterminatePulse 1.4s ease-in-out infinite',
            }}
          />
        )}
      </div>
    </div>
  );
};

export const ProgressHost: React.FC = () => {
  const { progressTasks, service } = useFeedback();

  if (progressTasks.length === 0) return null;

  return (
    <div
      aria-label="Background Tasks Progress"
      style={{
        position: 'fixed',
        bottom: '36px',
        left: '16px',
        zIndex: 9980,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        pointerEvents: 'auto',
      }}
    >
      {progressTasks.map((task) => (
        <ProgressItem
          key={task.id}
          task={task}
          onCancel={() => {
            const handle = service.startProgress(task);
            handle.cancel();
          }}
        />
      ))}
    </div>
  );
};
