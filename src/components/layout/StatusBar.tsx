import React from 'react';
import { StatusIndicator, StatusType } from '../common/StatusIndicator';
import { useWorkspace } from '../../state/WorkspaceContext';
import { useShellState } from '../../state/ShellContext';
import { useCommand } from '../../state/CommandContext';
import { useNavigation } from '../../state/NavigationContext';
import { useSourceControl } from '../../state/SourceControlContext';
import { Settings, GitBranch } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const { activeDoc, saveStatus, lastErrorMessage } = useWorkspace();
  const { state: shellState, updateEditorSettings } = useShellState();
  const { executeCommand } = useCommand();
  const { currentPos } = useNavigation();
  const { state: scState } = useSourceControl();
  const settings = shellState.editorSettings;

  const getStatusType = (): StatusType => {
    if (saveStatus === 'saving') return 'syncing';
    if (saveStatus === 'error') return 'error';
    if (!activeDoc) return 'saved';
    return activeDoc.isDirty ? 'dirty' : 'saved';
  };

  const getStatusLabel = (): string | undefined => {
    if (saveStatus === 'saving') return 'Saving...';
    if (saveStatus === 'error') return lastErrorMessage || 'Save Failed';
    if (saveStatus === 'saved') return 'Saved';
    return undefined;
  };

  const language = activeDoc?.language || 'Plaintext';
  const filePath = activeDoc?.filePath || 'Untitled Buffer';
  const indentLabel = settings.insertSpaces ? `Spaces: ${settings.tabSize}` : `Tab Size: ${settings.tabSize}`;

  const cycleTabSize = () => {
    const nextSize = settings.tabSize === 2 ? 4 : settings.tabSize === 4 ? 8 : 2;
    updateEditorSettings({ tabSize: nextSize });
  };

  return (
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {scState.isGitRepository && (
          <>
            <button
              onClick={() => executeCommand('sourceControl.openPanel')}
              title="Click to view Source Control panel"
              aria-label={`Git branch ${scState.currentBranch || 'main'}, click to open Source Control`}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                font: 'inherit',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 4px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 600,
              }}
            >
              <GitBranch size={13} style={{ color: 'var(--accent-primary)' }} />
              <span>{scState.currentBranch || 'main'}</span>
            </button>
            <span>•</span>
          </>
        )}
        <span style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filePath}
        </span>
        <span className="status-item-secondary">•</span>
        <span className="status-item-secondary">UTF-8</span>
        <span className="status-item-secondary">•</span>
        <span className="status-item-secondary" style={{ textTransform: 'capitalize' }}>{language}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {activeDoc && (
          <>
            <button
              onClick={() => executeCommand('navigation.goToLine')}
              title="Click to Go to Line / Column (Ctrl+G)"
              aria-label={`Line ${currentPos.line}, Column ${currentPos.column}, click to Go to Line`}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                font: 'inherit',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 500,
              }}
            >
              Ln {currentPos.line}, Col {currentPos.column}
            </button>
            <span>•</span>
          </>
        )}
        <button
          className="status-item-secondary"
          onClick={cycleTabSize}
          title="Click to cycle tab size"
          aria-label={`${indentLabel}, click to cycle tab size`}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            font: 'inherit',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {indentLabel}
        </button>
        <span className="status-item-secondary">•</span>
        <button
          className="status-item-secondary"
          onClick={() => executeCommand('editor.toggleWordWrap')}
          title="Click to toggle word wrap"
          aria-label={`Word wrap ${settings.wordWrap === 'on' ? 'On' : 'Off'}, click to toggle`}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            font: 'inherit',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          Wrap: {settings.wordWrap === 'on' ? 'On' : 'Off'}
        </button>
        <span className="status-item-secondary">•</span>
        <span className="status-item-secondary">{settings.fontSize}px</span>
        <span className="status-item-secondary">•</span>
        <button
          className="status-item-secondary"
          onClick={() => executeCommand('workbench.action.openSettings')}
          title="Open Editor Settings"
          aria-label="Open Settings"
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            font: 'inherit',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 4px',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <Settings size={12} /> Settings
        </button>
        <span className="status-item-secondary">•</span>
        <StatusIndicator status={getStatusType()} label={getStatusLabel()} />
      </div>
    </footer>
  );
};
