import React from 'react';
import { useExplorer } from '../../state/ExplorerContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import { FileExplorerTree } from './FileExplorerTree';
import { IconButton } from '../common/IconButton';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { FolderOpen, RefreshCw, Target, Folder, FileText, Loader2, AlertCircle } from 'lucide-react';

export const FileExplorer: React.FC = () => {
  const {
    workspaceRoot,
    isLoading,
    error,
    openWorkspace,
    refreshWorkspace,
    revealActiveFile,
  } = useExplorer();

  const { registry, activateDoc } = useWorkspace();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Workspace Header Toolbar */}
      <div
        style={{
          padding: '8px 12px',
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          letterSpacing: '0.8px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-sidebar)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          <Folder size={14} style={{ color: 'var(--text-accent)' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {workspaceRoot ? workspaceRoot.name : 'NO WORKSPACE OPEN'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          {workspaceRoot && (
            <>
              <IconButton
                onClick={() => revealActiveFile()}
                aria-label="Reveal Active File in Tree"
                icon={<Target size={14} />}
              />
              <IconButton
                onClick={() => refreshWorkspace()}
                aria-label="Refresh Explorer Tree"
                icon={<RefreshCw size={14} className={isLoading ? 'spin' : ''} />}
              />
            </>
          )}
          <IconButton
            onClick={() => openWorkspace()}
            aria-label="Open Workspace Folder"
            icon={<FolderOpen size={14} />}
          />
        </div>
      </div>

      {/* Main Explorer Content Container */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {isLoading && !workspaceRoot && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
            <div>Enumerating directory...</div>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '12px',
              margin: '8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-danger, #ef4444)',
              fontSize: '0.8rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <AlertCircle size={14} />
              <strong style={{ fontWeight: 600 }}>Workspace Error</strong>
            </div>
            <div style={{ marginBottom: '8px' }}>{error}</div>
            <Button onClick={() => refreshWorkspace()} variant="secondary" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
              Retry
            </Button>
          </div>
        )}

        {!workspaceRoot && !isLoading && (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            <EmptyState
              icon={<FolderOpen size={36} />}
              title="No Folder Opened"
              description="Open a workspace directory to browse files, edit code, and inspect project resources."
              action={
                <Button variant="primary" icon={<FolderOpen size={14} />} onClick={() => openWorkspace()} style={{ width: '100%' }}>
                  Open Folder
                </Button>
              }
            />

            {/* Open Document Buffers Section */}
            {registry.openDocIds.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    marginBottom: '8px',
                  }}
                >
                  Open Buffers ({registry.openDocIds.length})
                </div>
                {registry.openDocIds.map((id) => {
                  const doc = registry.documents[id];
                  if (!doc) return null;
                  const isActive = registry.activeDocId === id;

                  return (
                    <div
                      key={doc.id}
                      onClick={() => activateDoc(doc.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
                        color: isActive ? 'var(--text-accent)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        marginBottom: '2px',
                      }}
                    >
                      <FileText size={15} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {doc.title}
                      </span>
                      {doc.isDirty && (
                        <span
                          style={{
                            height: '6px',
                            width: '6px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--text-accent)',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {workspaceRoot && <FileExplorerTree />}
      </div>
    </div>
  );
};
