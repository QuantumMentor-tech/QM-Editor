import React from 'react';
import { useShellState } from '../../state/ShellContext';
import { useCommand } from '../../state/CommandContext';
import { IconButton } from '../common/IconButton';
import { MenuBar } from '../commands/MenuBar';
import { Toolbar } from '../commands/Toolbar';
import { Sun, Moon, Terminal, ChevronLeft, ChevronRight, Search } from 'lucide-react';

export const Header: React.FC = () => {
  const { state } = useShellState();
  const { executeCommand, canExecuteCommand } = useCommand();

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
        padding: '0 12px',
        zIndex: 'var(--z-header, 20)',
        gap: '12px',
      }}
    >
      {/* Left: Branding & Application Menu Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <img
          src="/QM Editor Logo.png"
          alt="QM Editor Logo"
          style={{ height: '26px', width: 'auto', borderRadius: 'var(--radius-sm)' }}
        />
        <span
          style={{
            fontWeight: 700,
            fontSize: '0.95rem',
            color: 'var(--text-primary)',
            letterSpacing: '0.5px',
            marginRight: '6px',
          }}
        >
          QM EDITOR
        </span>

        {/* Application Menu Bar */}
        <MenuBar />
      </div>

      {/* Center: Command Palette Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, maxWidth: '420px' }}>
        <button
          onClick={() => executeCommand('workbench.action.showCommands')}
          aria-label="Search Commands (Ctrl+Shift+P)"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            maxWidth: '380px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px 10px',
            color: 'var(--text-muted)',
            fontSize: '0.78rem',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Search size={13} style={{ color: 'var(--accent-color)' }} />
            <span>Search commands...</span>
          </div>
          <kbd
            style={{
              fontSize: '0.68rem',
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

      {/* Right: Navigation, Primary Toolbar & Shell Toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Navigation History */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            borderRight: '1px solid var(--border-color)',
            paddingRight: '6px',
          }}
        >
          <IconButton
            onClick={() => executeCommand('navigation.back')}
            disabled={!canBack}
            aria-label="Navigate Back (Alt+Left)"
            icon={<ChevronLeft size={16} />}
          />
          <IconButton
            onClick={() => executeCommand('navigation.forward')}
            disabled={!canForward}
            aria-label="Navigate Forward (Alt+Right)"
            icon={<ChevronRight size={16} />}
          />
        </div>

        {/* Primary Unified Toolbar */}
        <Toolbar />

        {/* Shell Toggles */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            borderLeft: '1px solid var(--border-color)',
            paddingLeft: '6px',
          }}
        >
          <IconButton
            onClick={() => executeCommand('shell.togglePanel')}
            active={state.panelOpen}
            aria-label="Toggle Console Panel"
            icon={<Terminal size={16} />}
          />

          <IconButton
            onClick={() => executeCommand('shell.toggleTheme')}
            aria-label="Toggle Theme Mode"
            icon={state.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          />
        </div>
      </div>
    </header>
  );
};
