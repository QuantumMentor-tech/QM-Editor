import React from 'react';
import { useWorkspace } from '../../state/WorkspaceContext';
import { EditorSurface } from '../editor/EditorSurface';
import { FileText, X, Plus } from 'lucide-react';
import { IconButton } from '../common/IconButton';

export const MainWorkspace: React.FC = () => {
  const { registry, activeDoc, activateDoc, closeDoc, updateText, createDoc } = useWorkspace();

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
      {/* Tab Bar Strip */}
      <div
        style={{
          height: 'var(--header-height)',
          backgroundColor: 'var(--bg-app)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '4px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        {registry.openDocIds.map((id) => {
          const doc = registry.documents[id];
          if (!doc) return null;
          const isActive = registry.activeDocId === id;

          return (
            <div
              key={doc.id}
              onClick={() => activateDoc(doc.id)}
              style={{
                height: '100%',
                padding: '0 12px',
                backgroundColor: isActive ? 'var(--bg-editor)' : 'transparent',
                borderTop: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                borderRight: '1px solid var(--border-color)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.85rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background-color var(--transition-fast)',
              }}
            >
              <FileText size={14} color={isActive ? 'var(--text-accent)' : 'var(--text-muted)'} />
              <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {doc.title}
              </span>
              {doc.isDirty && (
                <span style={{ color: 'var(--text-accent)', fontSize: '0.75rem' }}>●</span>
              )}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  closeDoc(doc.id);
                }}
                aria-label={`Close ${doc.title}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  marginLeft: '4px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <X size={12} />
              </span>
            </div>
          );
        })}

        {/* Quick New File Tab Action */}
        <div style={{ padding: '0 8px' }}>
          <IconButton
            onClick={() => createDoc(`Untitled-${registry.openDocIds.length + 1}.txt`)}
            aria-label="New Document"
            icon={<Plus size={14} />}
          />
        </div>
      </div>

      {/* Editor Surface Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {activeDoc ? (
          <EditorSurface
            key={activeDoc.id}
            document={activeDoc}
            onContentChange={(newContent) => updateText(activeDoc.id, newContent)}
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
              gap: '14px',
            }}
          >
            <FileText size={54} strokeWidth={1} />
            <h3 style={{ fontWeight: 500, fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
              No Open Documents in Workspace
            </h3>
            <p style={{ fontSize: '0.85rem' }}>Create a new document to start editing.</p>
            <button
              onClick={() => createDoc('Untitled-1.txt')}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              + Create New Document
            </button>
          </div>
        )}
      </div>
    </main>
  );
};
