/**
 * QM Editor Tasks Panel Component
 * Phase 1, Step 20 — Tasks, Build, Run & Problem Matcher Foundation
 */

import React, { useState } from 'react';
import { useTasks } from '../../state/TaskContext';
import { useContextMenu } from '../../state/ContextMenuContext';
import { Play, Square, RotateCw, Trash2, Shield, ShieldAlert, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { TaskDefinition } from '../../core/tasks/TaskTypes';
import { EmptyState } from '../common/EmptyState';

export const TasksPanel: React.FC = () => {
  const {
    tasks,
    sessions,
    activeSession,
    setActiveSession,
    runTask,
    cancelTask,
    clearTaskOutput,
    trustState,
    setTrustState,
  } = useTasks();

  const { openContextMenu } = useContextMenu();
  const [filterType, setFilterType] = useState<string>('all');

  const filteredTasks = tasks.filter((t) => {
    if (filterType === 'all') return true;
    return t.type === filterType;
  });

  const isRunning = activeSession?.status === 'running' || activeSession?.status === 'starting';

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontSize: '0.82rem',
        overflow: 'hidden',
      }}
    >
      {/* Left Column: Task Catalog & Sessions */}
      <div
        style={{
          width: '240px',
          minWidth: '200px',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-secondary)',
        }}
      >
        {/* Trust Status Bar */}
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            backgroundColor: trustState === 'trusted' ? 'rgba(46, 160, 67, 0.08)' : 'rgba(218, 54, 51, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {trustState === 'trusted' ? (
              <Shield size={14} color="var(--accent-primary, #2ea043)" />
            ) : (
              <ShieldAlert size={14} color="#f85149" />
            )}
            <span style={{ fontWeight: 600 }}>
              {trustState === 'trusted' ? 'Workspace Trusted' : 'Workspace Untrusted'}
            </span>
          </div>

          <button
            onClick={() => setTrustState(trustState === 'trusted' ? 'untrusted' : 'trusted')}
            title="Toggle Workspace Trust Security State"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-accent)',
              fontSize: '0.72rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {trustState === 'trusted' ? 'Untrust' : 'Trust'}
          </button>
        </div>

        {/* Task Catalog Header */}
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
            Available Tasks ({tasks.length})
          </span>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{
              fontSize: '0.72rem',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '3px',
              padding: '2px 4px',
            }}
          >
            <option value="all">All</option>
            <option value="build">Build</option>
            <option value="test">Test</option>
            <option value="run">Run</option>
            <option value="lint">Lint</option>
          </select>
        </div>

        {/* Task List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
          {filteredTasks.length === 0 ? (
            <div style={{ padding: '16px 8px' }}>
              <EmptyState
                icon={<Play size={28} />}
                title={tasks.length === 0 ? 'No tasks configured' : 'No matching tasks'}
                description={
                  tasks.length === 0
                    ? 'No build, test, or run tasks defined in this workspace.'
                    : `No tasks found for category "${filterType}".`
                }
              />
            </div>
          ) : (
            filteredTasks.map((t: TaskDefinition) => {
              const isTaskRunning = sessions.some(
                (s) => s.taskId === t.id && (s.status === 'running' || s.status === 'starting')
              );

              return (
                <div
                  key={t.id}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openContextMenu('contextmenu:task', { x: e.clientX, y: e.clientY }, { taskId: t.id, task: t });
                  }}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '4px',
                    marginBottom: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '6px' }}>
                    <div style={{ fontWeight: 500, fontSize: '0.8rem' }}>{t.label}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          backgroundColor: 'var(--bg-secondary)',
                          marginRight: '4px',
                          textTransform: 'uppercase',
                          fontSize: '0.65rem',
                        }}
                      >
                        {t.type}
                      </span>
                      {t.command} {(t.args || []).join(' ')}
                    </div>
                  </div>

                  <button
                    disabled={isTaskRunning}
                    onClick={() => runTask(t.id)}
                    title={`Run ${t.label}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: isTaskRunning ? 'var(--bg-muted)' : 'var(--accent-primary)',
                      color: '#fff',
                      cursor: isTaskRunning ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <Play size={12} fill="#fff" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Recent Sessions Selector */}
        {sessions.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-color)', maxHeight: '140px', overflowY: 'auto' }}>
            <div style={{ padding: '6px 10px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Recent Runs
            </div>
            {sessions.slice(0, 5).map((s) => (
              <div
                key={s.sessionId}
                onClick={() => setActiveSession(s.sessionId)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  backgroundColor: activeSession?.sessionId === s.sessionId ? 'var(--bg-hover)' : 'transparent',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.taskLabel}
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    color:
                      s.status === 'completed'
                        ? 'var(--accent-primary)'
                        : s.status === 'failed'
                        ? '#f85149'
                        : 'var(--text-muted)',
                  }}
                >
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Output Surface & Controls */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Output Header */}
        <div
          style={{
            height: '34px',
            padding: '0 12px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 600 }}>
              {activeSession ? activeSession.taskLabel : 'Task Console'}
            </span>

            {activeSession && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor:
                    activeSession.status === 'completed'
                      ? 'rgba(46, 160, 67, 0.15)'
                      : activeSession.status === 'failed'
                      ? 'rgba(218, 54, 51, 0.15)'
                      : activeSession.status === 'running'
                      ? 'rgba(56, 139, 253, 0.15)'
                      : 'rgba(128, 128, 128, 0.15)',
                  color:
                    activeSession.status === 'completed'
                      ? '#2ea043'
                      : activeSession.status === 'failed'
                      ? '#f85149'
                      : activeSession.status === 'running'
                      ? '#58a6ff'
                      : 'var(--text-muted)',
                }}
              >
                {activeSession.status === 'completed' && <CheckCircle2 size={11} />}
                {activeSession.status === 'failed' && <XCircle size={11} />}
                {activeSession.status === 'running' && <Clock size={11} />}
                {activeSession.status.toUpperCase()}
              </span>
            )}

            {activeSession?.exitCode !== undefined && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                (exit: {activeSession.exitCode})
              </span>
            )}

            {activeSession && activeSession.problems.length > 0 && (
              <span style={{ fontSize: '0.72rem', color: '#f85149', fontWeight: 600 }}>
                {activeSession.problems.length} Problem{activeSession.problems.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isRunning && activeSession && (
              <button
                onClick={() => cancelTask(activeSession.sessionId)}
                title="Cancel Task Process"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '3px',
                  border: '1px solid #f85149',
                  backgroundColor: 'rgba(218, 54, 51, 0.1)',
                  color: '#f85149',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                <Square size={12} fill="#f85149" />
                <span>Cancel</span>
              </button>
            )}

            {activeSession && !isRunning && (
              <button
                onClick={() => runTask(activeSession.taskId)}
                title="Rerun Task"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '3px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                <RotateCw size={12} />
                <span>Rerun</span>
              </button>
            )}

            {activeSession && (
              <button
                onClick={() => clearTaskOutput(activeSession.sessionId)}
                title="Clear Output"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '3px 6px',
                  borderRadius: '3px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Monospace Output Display */}
        <div
          style={{
            flex: 1,
            padding: '10px 14px',
            backgroundColor: '#0d1117',
            color: '#c9d1d9',
            fontFamily: 'var(--font-code, monospace)',
            fontSize: '0.8rem',
            lineHeight: '1.45',
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {activeSession ? (
            activeSession.output.length > 0 ? (
              activeSession.output.map((line, idx) => (
                <div key={idx} style={{ wordBreak: 'break-word' }}>
                  {renderAnsiLine(line)}
                </div>
              ))
            ) : (
              <div style={{ color: '#8b949e', fontStyle: 'italic' }}>
                Task output is empty.
              </div>
            )
          ) : (
            <div style={{ color: '#8b949e', fontStyle: 'italic', paddingTop: '10px' }}>
              No task is currently running. Select a task from the list to build, test, or lint your project.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function renderAnsiLine(line: string): React.ReactNode {
  // Simple ANSI clean and color mapping for log display
  const cleaned = line.replace(/\r$/, '');
  if (cleaned.includes('\x1b[31m')) {
    return <span style={{ color: '#f85149' }}>{cleaned.replace(/\x1b\[[0-9;]*m/g, '')}</span>;
  }
  if (cleaned.includes('\x1b[32m')) {
    return <span style={{ color: '#3fb950' }}>{cleaned.replace(/\x1b\[[0-9;]*m/g, '')}</span>;
  }
  if (cleaned.includes('\x1b[33m')) {
    return <span style={{ color: '#d29922' }}>{cleaned.replace(/\x1b\[[0-9;]*m/g, '')}</span>;
  }
  if (cleaned.includes('\x1b[36m')) {
    return <span style={{ color: '#58a6ff' }}>{cleaned.replace(/\x1b\[[0-9;]*m/g, '')}</span>;
  }
  if (cleaned.includes('\x1b[90m')) {
    return <span style={{ color: '#8b949e' }}>{cleaned.replace(/\x1b\[[0-9;]*m/g, '')}</span>;
  }
  return cleaned.replace(/\x1b\[[0-9;]*m/g, '');
}
