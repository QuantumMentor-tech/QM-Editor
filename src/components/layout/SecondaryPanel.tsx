import React from 'react';
import { Terminal, AlertCircle } from 'lucide-react';

export interface SecondaryPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const SecondaryPanel: React.FC<SecondaryPanelProps> = ({ isOpen }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        height: '180px',
        backgroundColor: 'var(--bg-panel)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '6px 14px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          gap: '16px',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-accent)' }}>
          <Terminal size={14} />
          <span>Console / Output</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertCircle size={14} />
          <span>Problems (0)</span>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          padding: '10px 14px',
          fontFamily: 'var(--font-code)',
          fontSize: '0.82rem',
          color: 'var(--text-muted)',
        }}
      >
        [QM Editor Output] Shell initialized. Ready for operations.
      </div>
    </div>
  );
};
