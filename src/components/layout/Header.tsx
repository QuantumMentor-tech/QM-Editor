import React from 'react';
import { useShellState } from '../../state/ShellContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import { Button } from '../common/Button';
import { IconButton } from '../common/IconButton';
import { Badge } from '../common/Badge';
import { Save, Sun, Moon, Terminal, Plus } from 'lucide-react';

export const Header: React.FC = () => {
  const { state, toggleTheme, togglePanel } = useShellState();
  const { activeDoc, saveDoc, createDoc, registry } = useWorkspace();

  const isDirty = activeDoc?.isDirty || false;

  const handleSave = () => {
    if (activeDoc) {
      saveDoc(activeDoc.id);
    }
  };

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
        <Badge variant="accent">v0.1.0 Workspace</Badge>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Button
          onClick={() => createDoc(`Untitled-${registry.openDocIds.length + 1}.txt`)}
          variant="secondary"
          icon={<Plus size={16} />}
        >
          New Document
        </Button>

        <Button
          onClick={handleSave}
          disabled={!isDirty || !activeDoc}
          variant={isDirty ? 'primary' : 'secondary'}
          icon={<Save size={16} />}
        >
          Save
        </Button>

        <IconButton
          onClick={togglePanel}
          active={state.panelOpen}
          aria-label="Toggle Console Panel"
          icon={<Terminal size={18} />}
        />

        <IconButton
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          icon={state.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        />
      </div>
    </header>
  );
};
