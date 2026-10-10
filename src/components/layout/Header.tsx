import React from 'react';
import { useShellState } from '../../state/ShellContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import { useCommand } from '../../state/CommandContext';
import { Button } from '../common/Button';
import { IconButton } from '../common/IconButton';
import { Badge } from '../common/Badge';
import { Save, Sun, Moon, Terminal, Plus, FolderOpen } from 'lucide-react';

export const Header: React.FC = () => {
  const { state } = useShellState();
  const { activeDoc } = useWorkspace();
  const { executeCommand, canExecuteCommand } = useCommand();

  const canSave = canExecuteCommand('file.save');

  return (
    <header
      style={{
        height: 'var(--header-height)',
        backgroundColor: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img
          src="/QM Editor Logo.png"
          alt="QM Editor Logo"
          style={{ height: '28px', width: 'auto', borderRadius: 'var(--radius-sm)' }}
        />
        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
          QM EDITOR
        </span>
        <Badge variant="accent">v0.1.0 Storage Engine</Badge>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Button
          onClick={() => executeCommand('file.new')}
          variant="secondary"
          icon={<Plus size={16} />}
        >
          New File
        </Button>

        <Button
          onClick={() => executeCommand('file.open')}
          variant="secondary"
          icon={<FolderOpen size={16} />}
        >
          Open File
        </Button>

        <Button
          onClick={() => executeCommand('file.save')}
          disabled={!canSave || !activeDoc}
          variant={canSave ? 'primary' : 'secondary'}
          icon={<Save size={16} />}
        >
          Save (Ctrl+S)
        </Button>

        <IconButton
          onClick={() => executeCommand('shell.togglePanel')}
          active={state.panelOpen}
          aria-label="Toggle Console Panel"
          icon={<Terminal size={18} />}
        />

        <IconButton
          onClick={() => executeCommand('shell.toggleTheme')}
          aria-label="Toggle Theme Mode"
          icon={state.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        />
      </div>
    </header>
  );
};
