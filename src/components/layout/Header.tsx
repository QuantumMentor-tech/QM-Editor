import React from 'react';
import { useShellState } from '../../state/ShellContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import { useCommand } from '../../state/CommandContext';
import { Button } from '../common/Button';
import { IconButton } from '../common/IconButton';
import { Badge } from '../common/Badge';
import { Save, Sun, Moon, Terminal, Plus, FolderOpen, Settings, ChevronLeft, ChevronRight, Clock, Search } from 'lucide-react';

export const Header: React.FC = () => {
  const { state } = useShellState();
  const { activeDoc } = useWorkspace();
  const { executeCommand, canExecuteCommand } = useCommand();

  const canSave = canExecuteCommand('file.save');
  const canBack = canExecuteCommand('navigation.back');
  const canForward = canExecuteCommand('navigation.forward');

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

        {/* Command Palette Trigger Button */}
        <button
          onClick={() => executeCommand('workbench.action.showCommands')}
          aria-label="Search Commands (Ctrl+Shift+P)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 10px',
            color: 'var(--text-muted)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            marginLeft: '8px',
            transition: 'border-color 0.15s ease',
          }}
        >
          <Search size={14} style={{ color: 'var(--accent-color)' }} />
          <span>Search commands...</span>
          <kbd
            style={{
              fontSize: '0.7rem',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              padding: '1px 4px',
              borderRadius: '3px',
              border: '1px solid var(--border-color)',
            }}
          >
            Ctrl+Shift+P
          </kbd>
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderRight: '1px solid var(--border-color)', paddingRight: '8px' }}>
          <IconButton
            onClick={() => executeCommand('navigation.back')}
            disabled={!canBack}
            aria-label="Navigate Back (Alt+Left)"
            icon={<ChevronLeft size={18} />}
          />
          <IconButton
            onClick={() => executeCommand('navigation.forward')}
            disabled={!canForward}
            aria-label="Navigate Forward (Alt+Right)"
            icon={<ChevronRight size={18} />}
          />
        </div>

        <IconButton
          onClick={() => executeCommand('file.openRecent')}
          aria-label="Recently Opened Files (Ctrl+Shift+R)"
          icon={<Clock size={18} />}
        />

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
          onClick={() => executeCommand('workbench.action.openSettings')}
          aria-label="Editor Settings"
          icon={<Settings size={18} />}
        />

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
