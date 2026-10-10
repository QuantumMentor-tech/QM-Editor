import React from 'react';
import { DocumentModel } from '../../types';
import { FileText, FolderOpen, PanelLeftClose, PanelLeft } from 'lucide-react';
import { IconButton } from '../common/IconButton';

export interface SidebarProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  documents: Record<string, DocumentModel>;
  activeDocId: string | null;
  onSelectDoc: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggleOpen,
  documents,
  activeDocId,
  onSelectDoc,
}) => {
  if (!isOpen) {
    return (
      <div
        style={{
          width: '40px',
          backgroundColor: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: '8px',
        }}
      >
        <IconButton
          onClick={onToggleOpen}
          aria-label="Expand Sidebar"
          icon={<PanelLeft size={18} />}
        />
      </div>
    );
  }

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          fontWeight: 600,
          fontSize: '0.8rem',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          letterSpacing: '0.8px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FolderOpen size={16} />
          <span>Explorer</span>
        </div>
        <IconButton
          onClick={onToggleOpen}
          aria-label="Collapse Sidebar"
          icon={<PanelLeftClose size={16} />}
        />
      </div>

      <div style={{ padding: '8px', flex: 1, overflowY: 'auto' }}>
        {Object.values(documents).map((doc) => {
          const isActive = activeDocId === doc.id;
          return (
            <div
              key={doc.id}
              onClick={() => onSelectDoc(doc.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                color: isActive ? 'var(--text-accent)' : 'var(--text-primary)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                marginBottom: '2px',
                transition: 'background-color var(--transition-fast)',
              }}
            >
              <FileText size={16} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {doc.title}
              </span>
              {doc.isDirty && (
                <span
                  style={{
                    height: '6px',
                    width: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--text-accent)',
                    marginLeft: 'auto',
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
