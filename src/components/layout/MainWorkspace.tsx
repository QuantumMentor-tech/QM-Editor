import React from 'react';
import { DocumentModel } from '../../types';
import { FileText } from 'lucide-react';

export interface MainWorkspaceProps {
  activeDoc: DocumentModel | null;
  onContentChange: (newContent: string) => void;
}

export const MainWorkspace: React.FC<MainWorkspaceProps> = ({
  activeDoc,
  onContentChange,
}) => {
  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-editor)',
        overflow: 'hidden',
      }}
    >
      {/* Active Tab Bar */}
      <div
        style={{
          height: 'var(--header-height)',
          backgroundColor: 'var(--bg-app)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '4px',
        }}
      >
        {activeDoc && (
          <div
            style={{
              height: '100%',
              padding: '0 16px',
              backgroundColor: 'var(--bg-editor)',
              borderTop: '2px solid var(--accent-primary)',
              borderRight: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}
          >
            <FileText size={14} color="var(--text-accent)" />
            <span>{activeDoc.title}</span>
            {activeDoc.isDirty && <span style={{ color: 'var(--text-accent)' }}>●</span>}
          </div>
        )}
      </div>

      {/* Editor Content Surface */}
      <div style={{ flex: 1, position: 'relative' }}>
        {activeDoc ? (
          <textarea
            value={activeDoc.content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="Write content here..."
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: 'transparent',
              color: 'var(--text-primary)',
              border: 'none',
              outline: 'none',
              padding: '16px',
              fontFamily: 'var(--font-code)',
              fontSize: '0.95rem',
              lineHeight: '1.6',
              resize: 'none',
            }}
          />
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              gap: '12px',
            }}
          >
            <FileText size={48} strokeWidth={1} />
            <p style={{ fontSize: '0.95rem' }}>No document open in workspace</p>
          </div>
        )}
      </div>
    </main>
  );
};
