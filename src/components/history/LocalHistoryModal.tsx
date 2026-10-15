/**
 * QM Editor Local History Modal
 * Phase 05, Step 53 — Local History, Document Snapshots & Versioned Content Persistence
 */

import React, { useState, useEffect } from 'react';
import { useShellState } from '../../state/ShellContext';
import {
  globalLocalHistoryCoordinator,
  LocalHistoryEntryDTO,
  HistoryPreview,
} from '../../core/local-history';
import { globalDocumentEngine } from '../../core/documents';
import { Button } from '../common/Button';
import {
  History,
  RotateCcw,
  Trash2,
  PlusCircle,
  Clock,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export interface LocalHistoryModalProps {
  resourceUri?: string;
}

export const LocalHistoryModal: React.FC<LocalHistoryModalProps> = ({ resourceUri }) => {
  const { closeDialog } = useShellState();

  const activeDoc = globalDocumentEngine.getActiveDocument();
  const targetUri = resourceUri || activeDoc?.resourceUri || '';
  const targetTitle = activeDoc?.title || (targetUri ? targetUri.split('/').pop() : 'Document');

  const [entries, setEntries] = useState<LocalHistoryEntryDTO[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [preview, setPreview] = useState<HistoryPreview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const loadEntries = async () => {
    if (!targetUri) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const historyEntries = await globalLocalHistoryCoordinator.getHistory(targetUri);
      setEntries(historyEntries);
      if (historyEntries.length > 0 && !selectedEntryId) {
        setSelectedEntryId(historyEntries[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntries();
  }, [targetUri]);

  useEffect(() => {
    if (!targetUri || !selectedEntryId) {
      setPreview(null);
      return;
    }

    let active = true;
    (async () => {
      const p = await globalLocalHistoryCoordinator.previewEntry(targetUri, selectedEntryId);
      if (active) {
        setPreview(p);
      }
    })();

    return () => {
      active = false;
    };
  }, [targetUri, selectedEntryId]);

  const handleCreateSnapshot = async () => {
    if (!activeDoc) return;
    setActionLoading(true);
    try {
      await globalLocalHistoryCoordinator.createSnapshot(activeDoc.id, {
        source: 'manual',
        label: 'Manual snapshot',
      });
      await loadEntries();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (entryId: string) => {
    if (!targetUri || !entryId) return;
    setActionLoading(true);
    try {
      const res = await globalLocalHistoryCoordinator.restoreEntry(targetUri, entryId);
      if (res.status === 'restored') {
        closeDialog();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!targetUri || !entryId) return;
    setActionLoading(true);
    try {
      await globalLocalHistoryCoordinator.deleteEntry(targetUri, entryId);
      const remaining = entries.filter((e) => e.id !== entryId);
      setEntries(remaining);
      if (selectedEntryId === entryId) {
        setSelectedEntryId(remaining.length > 0 ? remaining[0].id : null);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!targetUri) return;
    if (window.confirm(`Clear all local history snapshots for "${targetTitle}"?`)) {
      setActionLoading(true);
      try {
        await globalLocalHistoryCoordinator.clearHistory(targetUri);
        setEntries([]);
        setSelectedEntryId(null);
        setPreview(null);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const formatRelativeTime = (timestamp: number): string => {
    const diffMs = Date.now() - timestamp;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const getSourceBadgeStyle = (source: string) => {
    switch (source) {
      case 'manual':
        return { backgroundColor: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' };
      case 'preRestore':
        return { backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#eab308' };
      case 'save':
      default:
        return { backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' };
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        width: '680px',
        maxWidth: '90vw',
        padding: '4px',
      }}
    >
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          <History size={18} style={{ color: 'var(--accent-color)' }} />
          Local History for <span style={{ color: 'var(--accent-color)' }}>{targetTitle}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeDoc && (
            <Button
              variant="secondary"
              onClick={handleCreateSnapshot}
              disabled={actionLoading}
              icon={<PlusCircle size={14} />}
            >
              Snapshot Now
            </Button>
          )}
          {entries.length > 0 && (
            <Button
              variant="secondary"
              onClick={handleClearHistory}
              disabled={actionLoading}
              icon={<Trash2 size={14} />}
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          Loading local history snapshots...
        </div>
      ) : entries.length === 0 ? (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--bg-editor)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-muted)',
            fontSize: '0.88rem',
          }}
        >
          <Clock size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5 }} />
          <div>No local history snapshots recorded yet for this document.</div>
          <div style={{ fontSize: '0.78rem', marginTop: '6px', opacity: 0.8 }}>
            Historical versions are automatically captured whenever you save your work.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '12px', minHeight: '340px', maxHeight: '420px' }}>
          {/* Version List Sidebar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {entries.map((entry) => {
              const isSelected = entry.id === selectedEntryId;
              const badgeStyle = getSourceBadgeStyle(entry.source);
              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedEntryId(entry.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                    backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.08)' : 'var(--bg-editor)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        ...badgeStyle,
                      }}
                    >
                      {entry.source}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>rev: {entry.documentRevision}</span>
                    <span>{entry.contentSize} bytes</span>
                  </div>
                  {entry.label && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                      {entry.label}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Preview & Action Pane */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-editor)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              padding: '12px',
              overflow: 'hidden',
            }}
          >
            {preview && preview.entry ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Captured on <strong>{new Date(preview.entry.createdAt).toLocaleString()}</strong>
                    </div>
                    {preview.isIdenticalToCurrent ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#22c55e' }}>
                        <CheckCircle size={14} /> Matches current
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#38bdf8' }}>
                        <AlertCircle size={14} /> Differs from current
                      </span>
                    )}
                  </div>

                  {/* Content Preview Box */}
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      lineHeight: '1.4',
                      padding: '8px',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      borderRadius: 'var(--radius-sm)',
                      overflowY: 'auto',
                      maxHeight: '230px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {preview.historicalContent || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Empty document content</span>}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                  <Button
                    variant="destructive"
                    onClick={() => handleDeleteEntry(preview.entry!.id)}
                    disabled={actionLoading}
                    icon={<Trash2 size={14} />}
                  >
                    Delete Version
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleRestore(preview.entry!.id)}
                    disabled={actionLoading || preview.isIdenticalToCurrent}
                    icon={<RotateCcw size={14} />}
                  >
                    Restore This Version
                  </Button>
                </div>
              </>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Select a version on the left to preview.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
