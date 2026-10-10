import React, { useState } from 'react';
import { ThemeMode, DocumentModel } from './types';
import { FileText, Moon, Sun, FolderOpen, Save } from 'lucide-react';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [sidebarOpen] = useState<boolean>(true);
  
  const [documents, setDocuments] = useState<Record<string, DocumentModel>>({
    'doc-1': {
      id: 'doc-1',
      title: 'Welcome.md',
      content: '# Welcome to QM Editor\n\nQM Editor is a high-performance document and code editor.\n\n- Phase 01: Baseline Audit & Technical Architecture Established.\n- Step 02: Scaffolding and Core Layout Shell initialized.\n\nStart typing to edit your document.',
      language: 'markdown',
      isDirty: false,
      lastSavedTimestamp: Date.now(),
    },
  });
  
  const [activeDocId, setActiveDocId] = useState<string>('doc-1');

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const activeDoc = documents[activeDocId];

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setDocuments((prev) => ({
      ...prev,
      [activeDocId]: {
        ...prev[activeDocId],
        content: newContent,
        isDirty: true,
      },
    }));
  };

  const handleSave = () => {
    if (!activeDoc) return;
    setDocuments((prev) => ({
      ...prev,
      [activeDocId]: {
        ...prev[activeDocId],
        isDirty: false,
        lastSavedTimestamp: Date.now(),
      },
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      {/* Header Shell */}
      <header
        style={{
          height: 'var(--header-height)',
          backgroundColor: 'var(--bg-header)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="/QM Editor Logo.png"
            alt="QM Editor Logo"
            style={{ height: '28px', width: 'auto', borderRadius: '4px' }}
          />
          <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
            QM EDITOR
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 600,
            }}
          >
            v0.1.0 Architecture Baseline
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleSave}
            disabled={!activeDoc?.isDirty}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: activeDoc?.isDirty ? 'var(--accent-primary)' : 'var(--bg-hover)',
              color: activeDoc?.isDirty ? '#ffffff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: activeDoc?.isDirty ? 'pointer' : 'default',
              fontWeight: 500,
              fontSize: '0.85rem',
            }}
          >
            <Save size={16} /> Save
          </button>

          <button
            onClick={toggleTheme}
            title="Toggle Theme"
            style={{
              background: 'none',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar Panel */}
        {sidebarOpen && (
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
                padding: '12px 16px',
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
              <span>Explorer</span>
              <FolderOpen size={16} />
            </div>
            <div style={{ padding: '8px' }}>
              {Object.values(documents).map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setActiveDocId(doc.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: activeDocId === doc.id ? 'var(--bg-hover)' : 'transparent',
                    color: activeDocId === doc.id ? 'var(--text-accent)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  <FileText size={16} />
                  <span>{doc.title}</span>
                  {doc.isDirty && (
                    <span
                      style={{
                        height: '6px',
                        width: '6px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--text-accent)',
                        marginLeft: 'auto',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Editor Central Workspace */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-editor)' }}>
          {/* Tab Bar */}
          <div
            style={{
              height: '36px',
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

          {/* Textarea Code/Document Editor Area */}
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              value={activeDoc?.content || ''}
              onChange={handleContentChange}
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
          </div>
        </main>
      </div>

      {/* Status Bar */}
      <footer
        style={{
          height: 'var(--statusbar-height)',
          backgroundColor: 'var(--bg-status)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
        }}
      >
        <div>QM Editor Base Architecture | UTF-8</div>
        <div>
          {activeDoc?.isDirty ? (
            <span style={{ color: '#f59e0b' }}>Unsaved Changes</span>
          ) : (
            <span style={{ color: '#10b981' }}>Saved</span>
          )}
        </div>
      </footer>
    </div>
  );
};
