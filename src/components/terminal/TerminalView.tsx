/**
 * QM Editor Terminal View Component
 * Phase 1, Step 19 — Integrated Terminal & Safe Process Execution Foundation
 */

import React, { useState } from 'react';
import { useTerminal } from '../../state/TerminalContext';
import { TerminalScreen } from './TerminalScreen';
import { Plus, Trash2, Ban, Terminal as TerminalIcon, X, Edit2 } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';

export const TerminalView: React.FC = () => {
  const {
    sessions,
    activeSessionId,
    activeSession,
    createTerminal,
    closeTerminal,
    switchTerminal,
    clearActiveTerminal,
    renameTerminal,
    writeToActive,
  } = useTerminal();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditingTitle(currentTitle);
  };

  const handleFinishRename = (id: string) => {
    if (editingTitle.trim().length > 0) {
      renameTerminal(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Terminal Session Header Tabs & Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-header)',
          padding: '2px 8px',
          minHeight: '30px',
        }}
      >
        {/* Tabs List */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', flex: 1 }}>
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isEditing = editingId === session.id;

            return (
              <div
                key={session.id}
                onClick={() => switchTerminal(session.id)}
                onDoubleClick={() => handleStartRename(session.id, session.title)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isActive ? 'var(--bg-panel)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 600 : 400,
                  borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  maxWidth: '160px',
                }}
              >
                <TerminalIcon size={12} style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)', flexShrink: 0 }} />

                {isEditing ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => handleFinishRename(session.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishRename(session.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                    style={{
                      width: '70px',
                      background: 'var(--bg-editor)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontSize: '0.75rem',
                      padding: '1px 3px',
                      borderRadius: '2px',
                    }}
                  />
                ) : (
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {session.title}
                  </span>
                )}

                {/* Session status dot */}
                <span
                  title={`Status: ${session.status}`}
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor:
                      session.status === 'running'
                        ? 'var(--success, #2ea043)'
                        : session.status === 'failed'
                        ? 'var(--error, #f85149)'
                        : 'var(--text-muted)',
                    flexShrink: 0,
                  }}
                />

                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(session.id);
                  }}
                  aria-label={`Close ${session.title}`}
                  icon={<X size={11} />}
                />
              </div>
            );
          })}
        </div>

        {/* Toolbar actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          <IconButton
            onClick={() => createTerminal()}
            aria-label="New Terminal Session (Ctrl+Shift+`)"
            icon={<Plus size={14} />}
          />
          <IconButton
            onClick={clearActiveTerminal}
            aria-label="Clear Terminal Display"
            icon={<Ban size={13} />}
          />
          {activeSession && (
            <IconButton
              onClick={() => handleStartRename(activeSession.getId(), activeSession.getTitle())}
              aria-label="Rename Terminal Session"
              icon={<Edit2 size={13} />}
            />
          )}
          {activeSession && (
            <IconButton
              onClick={() => closeTerminal(activeSession.getId())}
              aria-label="Kill Active Terminal Process"
              icon={<Trash2 size={13} />}
            />
          )}
        </div>
      </div>

      {/* Terminal Screen Body */}
      {sessions.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-panel)' }}>
          <EmptyState
            icon={<TerminalIcon size={32} />}
            title="No Active Terminal Sessions"
            description="Create an integrated terminal session to execute build commands, run test runners, or use CLI tools."
            action={
              <Button variant="secondary" icon={<Plus size={14} />} onClick={() => createTerminal()}>
                Create Terminal
              </Button>
            }
          />
        </div>
      ) : activeSession ? (
        <TerminalScreen session={activeSession} onUserInput={writeToActive} />
      ) : null}
    </div>
  );
};
