import React, { useRef, useEffect } from 'react';
import { useWorkspace } from '../../state/WorkspaceContext';
import { useExplorer } from '../../state/ExplorerContext';
import { useShellState } from '../../state/ShellContext';
import { useCommand } from '../../state/CommandContext';
import { useContextMenu } from '../../state/ContextMenuContext';
import { EditorSurface } from '../editor/EditorSurface';
import { FileText, X, Plus } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { StartCenter } from '../welcome/StartCenter';

export const MainWorkspace: React.FC = () => {
  const { registry, activeDoc, activateDoc, closeDoc, updateText, createDoc } = useWorkspace();
  const { workspaceRoot } = useExplorer();
  const { state, closeWelcome } = useShellState();
  const { executeCommand } = useCommand();
  const { openContextMenu } = useContextMenu();
  const tabListRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active tab into view when active tab changes (Rule 26)
  useEffect(() => {
    if (!tabListRef.current) return;
    const activeTabEl = tabListRef.current.querySelector<HTMLElement>('[aria-selected="true"]');
    if (activeTabEl && typeof activeTabEl.scrollIntoView === 'function') {
      activeTabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [registry.activeDocId]);

  // Determine whether Welcome / Start Center should be displayed
  const isWelcomeActive =
    state.activeView === 'welcome' || (!workspaceRoot && registry.openDocIds.length === 0);

  const handleActivateDoc = (id: string) => {
    closeWelcome();
    activateDoc(id);
  };

  const handleCreateDoc = (title?: string) => {
    closeWelcome();
    createDoc(title);
  };

  if (isWelcomeActive && (!activeDoc || state.activeView === 'welcome')) {
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
        <StartCenter />
      </main>
    );
  }

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
        ref={tabListRef}
        role="tablist"
        aria-label="Editor Document Tabs"
        style={{
          height: 'var(--tab-height, var(--header-height))',
          backgroundColor: 'var(--bg-app)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '4px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
        }}
      >
        {registry.openDocIds.map((id, index) => {
          const doc = registry.documents[id];
          if (!doc) return null;
          const isActive = registry.activeDocId === id;
          const tabLabel = `${doc.title}${doc.isDirty ? ', modified' : ''}${isActive ? ', active document' : ''}`;

          return (
            <div
              key={doc.id}
              role="tab"
              aria-selected={isActive}
              aria-label={tabLabel}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleActivateDoc(doc.id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  const nextIndex = (index + 1) % registry.openDocIds.length;
                  handleActivateDoc(registry.openDocIds[nextIndex]);
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const prevIndex = (index - 1 + registry.openDocIds.length) % registry.openDocIds.length;
                  handleActivateDoc(registry.openDocIds[prevIndex]);
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  handleActivateDoc(registry.openDocIds[0]);
                } else if (e.key === 'End') {
                  e.preventDefault();
                  handleActivateDoc(registry.openDocIds[registry.openDocIds.length - 1]);
                } else if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleActivateDoc(doc.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleActivateDoc(doc.id);
                openContextMenu(
                  'contextmenu:tab',
                  { x: e.clientX, y: e.clientY },
                  { documentId: doc.id, filePath: doc.filePath, doc }
                );
              }}
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
                <span
                  title="Unsaved changes"
                  aria-label="Unsaved changes"
                  style={{ color: 'var(--text-accent)', fontSize: '0.75rem' }}
                >
                  ●
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeDoc(doc.id);
                }}
                aria-label={`Close ${doc.title}`}
                title={`Close ${doc.title}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
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
              </button>
            </div>
          );
        })}

        {/* Quick New File Tab Action */}
        <div style={{ padding: '0 8px' }}>
          <IconButton
            onClick={() => handleCreateDoc(`Untitled-${registry.openDocIds.length + 1}.txt`)}
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
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              boxSizing: 'border-box',
            }}
          >
            <EmptyState
              icon={<FileText size={48} strokeWidth={1.5} />}
              title="No Open Documents in Workspace"
              description="Select a file from the explorer or create a new document to start editing."
              action={
                <Button
                  variant="primary"
                  icon={<Plus size={14} />}
                  onClick={() => handleCreateDoc('Untitled-1.txt')}
                >
                  Create New Document
                </Button>
              }
              secondaryAction={
                <Button
                  variant="secondary"
                  icon={<FileText size={14} />}
                  onClick={() => executeCommand('file.open')}
                >
                  Open File...
                </Button>
              }
            />
          </div>
        )}
      </div>
    </main>
  );
};
