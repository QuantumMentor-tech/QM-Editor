import React from 'react';
import { StatusIndicator, StatusType } from '../common/StatusIndicator';
import { useWorkspace } from '../../state/WorkspaceContext';
import { useShellState } from '../../state/ShellContext';
import { useCommand } from '../../state/CommandContext';
import { useNavigation } from '../../state/NavigationContext';
import { Settings } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const { activeDoc, saveStatus, lastErrorMessage } = useWorkspace();
  const { state: shellState, updateEditorSettings } = useShellState();
  const { executeCommand } = useCommand();
  const { currentPos } = useNavigation();
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
        <span style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filePath}
        </span>
        <span>•</span>
        <span>UTF-8</span>
        <span>•</span>
        <span style={{ textTransform: 'capitalize' }}>{language}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {activeDoc && (
          <>
            <button
              onClick={() => executeCommand('navigation.goToLine')}
              title="Click to Go to Line / Column (Ctrl+G)"
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
          onClick={cycleTabSize}
          title="Click to cycle tab size"
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
        <span>•</span>
        <button
          onClick={() => executeCommand('editor.toggleWordWrap')}
          title="Click to toggle word wrap"
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
        <span>•</span>
        <span>{settings.fontSize}px</span>
        <span>•</span>
        <button
          onClick={() => executeCommand('workbench.action.openSettings')}
          title="Open Editor Settings"
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
        <span>•</span>
        <StatusIndicator status={getStatusType()} label={getStatusLabel()} />
      </div>
    </footer>
  );
};
