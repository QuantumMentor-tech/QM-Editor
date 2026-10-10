import React from 'react';
import { ThemeMode } from '../../types';
import { Button } from '../common/Button';
import { IconButton } from '../common/IconButton';
import { Badge } from '../common/Badge';
import { Save, Sun, Moon } from 'lucide-react';

export interface HeaderProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  isDirty?: boolean;
  onSave?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  onToggleTheme,
  isDirty = false,
  onSave,
}) => {
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
        <Badge variant="accent">v0.1.0 Shell</Badge>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Button
          onClick={onSave}
          disabled={!isDirty}
          variant={isDirty ? 'primary' : 'secondary'}
          icon={<Save size={16} />}
        >
          Save
        </Button>

        <IconButton
          onClick={onToggleTheme}
          aria-label="Toggle Theme"
          icon={theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        />
      </div>
    </header>
  );
};
