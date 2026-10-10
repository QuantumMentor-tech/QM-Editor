import React, { useState } from 'react';
import { useShellState } from '../../state/ShellContext';
import { RecentDocumentsService } from '../../services/RecentDocumentsService';
import { RecentDocument } from '../../types';
import { Button } from '../common/Button';
import { Clock, FileText, Trash2, ExternalLink } from 'lucide-react';

export interface RecentDocumentsModalProps {
  onOpenRecent: (uri: string) => void;
}

export const RecentDocumentsModal: React.FC<RecentDocumentsModalProps> = ({ onOpenRecent }) => {
  const { closeDialog } = useShellState();
  const [documents, setDocuments] = useState<RecentDocument[]>(() => RecentDocumentsService.getRecentDocuments());

  const handleSelect = (uri: string) => {
    onOpenRecent(uri);
    closeDialog();
  };

  const handleClear = () => {
    RecentDocumentsService.clearRecentDocuments();
    setDocuments([]);
  };

  const formatRelativeTime = (timestamp: number): string => {
    const diffMs = Date.now() - timestamp;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '460px', padding: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>
          <Clock size={18} /> Recently Opened Files
        </div>
        {documents.length > 0 && (
          <Button variant="secondary" onClick={handleClear} icon={<Trash2 size={14} />}>
            Clear History
          </Button>
        )}
      </div>

      {documents.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          No recently opened files found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
          {documents.map((doc) => (
            <button
              key={doc.uri}
              onClick={() => handleSelect(doc.uri)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-editor)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-header)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-editor)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <FileText size={16} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.uri}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                <span>{formatRelativeTime(doc.lastOpened)}</span>
                <ExternalLink size={14} />
              </div>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
        <Button variant="secondary" onClick={closeDialog}>
          Close
        </Button>
      </div>
    </div>
  );
};
