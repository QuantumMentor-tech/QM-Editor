import React, { useState } from 'react';
import { ThemeMode, DocumentModel } from './types';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MainWorkspace } from './components/layout/MainWorkspace';
import { SecondaryPanel } from './components/layout/SecondaryPanel';
import { StatusBar } from './components/layout/StatusBar';
import { OverlayLayer } from './components/layout/OverlayLayer';
import { updateDocumentContent, markDocumentSaved } from './core/document';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [panelOpen, setPanelOpen] = useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  const [documents, setDocuments] = useState<Record<string, DocumentModel>>({
    'doc-1': {
      id: 'doc-1',
      title: 'Welcome.md',
      content: '# Welcome to QM Editor\n\nQM Editor is a high-performance document and code editor.\n\n- Phase 01 Step 04: Official Core Application Shell & UI Foundation Established.\n- Modular layout components (Header, Sidebar, Workspace, Secondary Panel, Status Bar, Overlay Layer).\n\nStart typing to edit your document.',
      language: 'markdown',
      isDirty: false,
      lastSavedTimestamp: Date.now(),
    },
  });

  const [activeDocId, setActiveDocId] = useState<string | null>('doc-1');

  const activeDoc = activeDocId ? documents[activeDocId] : null;

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const handleContentChange = (newContent: string) => {
    if (!activeDocId || !documents[activeDocId]) return;
    const updated = updateDocumentContent(documents[activeDocId], newContent);
    setDocuments((prev) => ({
      ...prev,
      [activeDocId]: updated,
    }));
  };

  const handleSave = () => {
    if (!activeDocId || !documents[activeDocId]) return;
    const saved = markDocumentSaved(documents[activeDocId]);
    setDocuments((prev) => ({
      ...prev,
      [activeDocId]: saved,
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      {/* 1. Header Layout Shell */}
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        isDirty={activeDoc?.isDirty || false}
        onSave={handleSave}
      />

      {/* 2. Main Workspace Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar Explorer */}
        <Sidebar
          isOpen={sidebarOpen}
          onToggleOpen={() => setSidebarOpen((prev) => !prev)}
          documents={documents}
          activeDocId={activeDocId}
          onSelectDoc={(id) => setActiveDocId(id)}
        />

        {/* Central Workspace + Secondary Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MainWorkspace activeDoc={activeDoc} onContentChange={handleContentChange} />
          <SecondaryPanel isOpen={panelOpen} onToggle={() => setPanelOpen((prev) => !prev)} />
        </div>
      </div>

      {/* 3. Status Bar Footer */}
      <StatusBar
        status={activeDoc?.isDirty ? 'dirty' : 'saved'}
        language={activeDoc?.language || 'Plaintext'}
      />

      {/* 4. Global Overlay Layer */}
      <OverlayLayer
        dialogOpen={dialogOpen}
        onCloseDialog={() => setDialogOpen(false)}
        dialogTitle="QM Editor System Info"
      />
    </div>
  );
};
