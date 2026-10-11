import React, { useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, AlertCircle, FileText, X, Play } from 'lucide-react';
import { useShellState } from '../../state/ShellContext';
import { useTerminal } from '../../state/TerminalContext';
import { useTasks } from '../../state/TaskContext';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { TasksPanel } from '../tasks/TasksPanel';
import { ProblemsPanel } from '../problems/ProblemsPanel';
import { IconButton } from '../common/IconButton';

export const SecondaryPanel: React.FC = () => {
  const { state, setActivePanelView, togglePanel, setPanelHeight } = useShellState();
  const { sessions } = useTerminal();
  const { allProblems } = useTasks();
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newHeight = window.innerHeight - e.clientY;
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setPanelHeight]);

  if (!state.panelOpen) return null;

  const currentHeight = state.panelHeight || 240;

  return (
    <div
      role="region"
      aria-label="Console Panel"
      style={{
        height: `${currentHeight}px`,
        backgroundColor: 'var(--bg-panel)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Draggable & Keyboard-Accessible Resizer Bar (Rule 38, Step 25) */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize Console Panel (Arrow keys to adjust, double click to reset)"
        aria-valuenow={currentHeight}
        aria-valuemin={120}
        aria-valuemax={600}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setPanelHeight(currentHeight + 20);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setPanelHeight(currentHeight - 20);
          } else if (e.key === 'Home') {
            e.preventDefault();
            setPanelHeight(120);
          } else if (e.key === 'End') {
            e.preventDefault();
            setPanelHeight(600);
          }
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          isDraggingRef.current = true;
        }}
        onDoubleClick={() => {
          setPanelHeight(240);
        }}
        title="Drag or use Arrow Up/Down to resize panel. Double-click to reset."
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '5px',
          cursor: 'row-resize',
          zIndex: 10,
          backgroundColor: 'transparent',
          transition: 'background-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
        }}
        onMouseLeave={(e) => {
          if (!isDraggingRef.current) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      />

      {/* Panel Tabs Header Bar */}
      <div
        style={{
          padding: '4px 10px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          fontWeight: 600,
          backgroundColor: 'var(--bg-header)',
        }}
      >
        <div role="tablist" aria-label="Console Panel Views" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            role="tab"
            aria-selected={state.activePanelView === 'terminal'}
            aria-label={`Terminal${sessions.length > 0 ? ` (${sessions.length} sessions)` : ''}`}
            tabIndex={state.activePanelView === 'terminal' ? 0 : -1}
            onClick={() => setActivePanelView('terminal')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: state.activePanelView === 'terminal' ? 'var(--text-accent)' : 'var(--text-muted)',
              borderBottom: state.activePanelView === 'terminal' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              paddingBottom: '2px',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              fontWeight: 600,
              fontSize: 'inherit',
            }}
          >
            <TerminalIcon size={13} />
            <span>Terminal {sessions.length > 0 ? `(${sessions.length})` : ''}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={state.activePanelView === 'tasks'}
            aria-label="Tasks"
            tabIndex={state.activePanelView === 'tasks' ? 0 : -1}
            onClick={() => setActivePanelView('tasks')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: state.activePanelView === 'tasks' ? 'var(--text-accent)' : 'var(--text-muted)',
              borderBottom: state.activePanelView === 'tasks' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              paddingBottom: '2px',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              fontWeight: 600,
              fontSize: 'inherit',
            }}
          >
            <Play size={13} />
            <span>Tasks</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={state.activePanelView === 'problems'}
            aria-label={`Problems (${allProblems.length})`}
            tabIndex={state.activePanelView === 'problems' ? 0 : -1}
            onClick={() => setActivePanelView('problems')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: state.activePanelView === 'problems' ? 'var(--text-accent)' : 'var(--text-muted)',
              borderBottom: state.activePanelView === 'problems' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              paddingBottom: '2px',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              fontWeight: 600,
              fontSize: 'inherit',
            }}
          >
            <AlertCircle size={13} />
            <span>Problems ({allProblems.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={state.activePanelView === 'output'}
            aria-label="Console Output"
            tabIndex={state.activePanelView === 'output' ? 0 : -1}
            onClick={() => setActivePanelView('output')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: state.activePanelView === 'output' ? 'var(--text-accent)' : 'var(--text-muted)',
              borderBottom: state.activePanelView === 'output' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              paddingBottom: '2px',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              fontWeight: 600,
              fontSize: 'inherit',
            }}
          >
            <FileText size={13} />
            <span>Console / Output</span>
          </button>
        </div>

        <IconButton
          onClick={togglePanel}
          aria-label="Close Panel (Ctrl+J)"
          icon={<X size={14} />}
        />
      </div>

      {/* Main Panel Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {state.activePanelView === 'terminal' && <TerminalPanel />}
        {state.activePanelView === 'tasks' && <TasksPanel />}
        {state.activePanelView === 'problems' && <ProblemsPanel />}

        {state.activePanelView === 'output' && (
          <div
            style={{
              flex: 1,
              padding: '10px 14px',
              fontFamily: 'var(--font-code)',
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              overflowY: 'auto',
            }}
          >
            <div>[QM Editor Output] Shell state management initialized. Active View: {state.activeView}.</div>
          </div>
        )}
      </div>
    </div>
  );
};
