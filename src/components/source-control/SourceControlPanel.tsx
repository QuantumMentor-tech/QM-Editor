/**
 * QM Editor Source Control Panel Component
 * Phase 1, Step 18 — Git Integration & Source Control Foundation
 */

import React, { useState } from 'react';
import { useSourceControl } from '../../state/SourceControlContext';
import { useShellState } from '../../state/ShellContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import { SourceControlDiffModal } from './SourceControlDiffModal';
import { SourceControlFileStatus } from '../../core/source-control/SourceControlTypes';
import { GitBranch, RotateCw, GitCompare, FileCode, AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';

export const SourceControlPanel: React.FC = () => {
  const { state: scState, refresh, getDiff } = useSourceControl();
  const { openDialog, closeDialog } = useShellState();
  const { openDocs, activateDoc, openFilePath } = useWorkspace();

  const [changesOpen, setChangesOpen] = useState(true);
  const [untrackedOpen, setUntrackedOpen] = useState(true);

  const handleRefresh = async () => {
    await refresh();
  };

  const handleInspectDiff = async (fileStatus: SourceControlFileStatus) => {
    const diffResult = await getDiff(fileStatus.path);
    openDialog(
      `Diff: ${fileStatus.relativePath}`,
      <SourceControlDiffModal diffResult={diffResult} onClose={closeDialog} />
    );
  };

  const handleOpenFile = async (fileStatus: SourceControlFileStatus) => {
    const existing = openDocs.find(
      (d) =>
        (d.fileResource && d.fileResource.uri.toLowerCase() === fileStatus.path.toLowerCase()) ||
        (d.filePath && d.filePath.toLowerCase() === fileStatus.path.toLowerCase())
    );
    if (existing) {
      activateDoc(existing.id);
    } else if (openFilePath) {
      await openFilePath(fileStatus.path);
    }
  };

  const getStatusBadge = (status: SourceControlFileStatus) => {
    switch (status.displayStatus) {
      case 'modified':
        return <span style={{ color: 'var(--warning)', fontWeight: 700, fontSize: '0.75rem' }}>M</span>;
      case 'untracked':
        return <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.75rem' }}>U</span>;
      case 'deleted':
        return <span style={{ color: 'var(--error)', fontWeight: 700, fontSize: '0.75rem' }}>D</span>;
      case 'staged':
        return <span style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.75rem' }}>S</span>;
      case 'conflict':
        return <span style={{ color: 'var(--accent-error, #f85149)', fontWeight: 700, fontSize: '0.75rem' }}>C</span>;
      default:
        return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>•</span>;
    }
  };

  if (scState.isLoading && !scState.lastRefreshedTimestamp) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <RotateCw size={24} className="spin" style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
        <div>Checking repository status...</div>
      </div>
    );
  }

  if (scState.error) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <EmptyState
          icon={<AlertCircle size={32} style={{ color: 'var(--error, #f85149)' }} />}
          title="Source Control Error"
          description={scState.error}
          action={
            <Button variant="secondary" onClick={handleRefresh}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!scState.isGitRepository) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <EmptyState
          icon={<AlertCircle size={32} />}
          title="No Git Repository Detected"
          description="This workspace is not a Git repository. Initialize or open a Git repository to track file changes."
        />
      </div>
    );
  }

  const workingTreeFiles = scState.workingTreeFiles;
  const untrackedFiles = scState.untrackedFiles;
  const totalChanges = workingTreeFiles.length + untrackedFiles.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontSize: '0.82rem' }}>
      {/* Header Info */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-header)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
          <GitBranch size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {scState.currentBranch || 'main'}
          </span>
          {scState.isDetachedHead && (
            <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'var(--warning)', color: '#000', fontWeight: 600 }}>
              Detached
            </span>
          )}
        </div>
        <IconButton
          onClick={handleRefresh}
          aria-label="Refresh Source Control Status"
          icon={<RotateCw size={14} className={scState.isLoading ? 'spin' : ''} />}
        />
      </div>

      {/* Changes list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {totalChanges === 0 ? (
          <div style={{ padding: '24px 16px' }}>
            <EmptyState
              icon={<CheckCircle2 size={32} style={{ color: 'var(--success, #2ea043)' }} />}
              title="Working tree clean"
              description="No changes detected in the working tree. All files are up to date."
            />
          </div>
        ) : (
          <>
            {/* Working Tree Changes Group */}
            {workingTreeFiles.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <button
                  onClick={() => setChangesOpen(!changesOpen)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {changesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Changes ({workingTreeFiles.length})</span>
                </button>

                {changesOpen &&
                  workingTreeFiles.map((file) => (
                    <div
                      key={file.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 12px 4px 20px',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                      }}
                      onClick={() => handleOpenFile(file)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <FileCode size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file.relativePath}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectDiff(file);
                          }}
                          aria-label={`Inspect diff for ${file.relativePath}`}
                          icon={<GitCompare size={13} />}
                        />
                        {getStatusBadge(file)}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Untracked Files Group */}
            {untrackedFiles.length > 0 && (
              <div>
                <button
                  onClick={() => setUntrackedOpen(!untrackedOpen)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {untrackedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>Untracked ({untrackedFiles.length})</span>
                </button>

                {untrackedOpen &&
                  untrackedFiles.map((file) => (
                    <div
                      key={file.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 12px 4px 20px',
                        cursor: 'pointer',
                        borderRadius: 'var(--radius-sm)',
                      }}
                      onClick={() => handleOpenFile(file)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <FileCode size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file.relativePath}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectDiff(file);
                          }}
                          aria-label={`Inspect diff for ${file.relativePath}`}
                          icon={<GitCompare size={13} />}
                        />
                        {getStatusBadge(file)}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
