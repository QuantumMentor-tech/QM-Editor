import React from 'react';
import { Terminal, AlertCircle } from 'lucide-react';
import { useShellState } from '../../state/ShellContext';

export const SecondaryPanel: React.FC = () => {
  const { state, setActivePanelView } = useShellState();

  if (!state.panelOpen) return null;

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
        <div
          onClick={() => setActivePanelView('output')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: state.activePanelView === 'output' ? 'var(--text-accent)' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          <Terminal size={14} />
          <span>Console / Output</span>
        </div>
        <div
          onClick={() => setActivePanelView('problems')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: state.activePanelView === 'problems' ? 'var(--text-accent)' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
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
        {state.activePanelView === 'output' && (
          <div>[QM Editor Output] Shell state management initialized. Active View: {state.activeView}.</div>
        )}
        {state.activePanelView === 'problems' && <div>No problems detected in workspace.</div>}
        {state.activePanelView === 'terminal' && <div>Terminal environment initialized.</div>}
      </div>
    </div>
  );
};
