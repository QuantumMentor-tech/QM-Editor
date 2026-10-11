import React from 'react';
import { useCommand } from '../../state/CommandContext';
import { Card } from '../common/Card';
import { Terminal, Settings, Search, LayoutTemplate } from 'lucide-react';

export const WelcomeQuickAccess: React.FC = () => {
  const { executeCommand } = useCommand();

  const links = [
    {
      title: 'Command Palette',
      shortcut: 'Ctrl+Shift+P',
      description: 'Discover and execute any editor action',
      icon: <Terminal size={18} style={{ color: 'var(--text-accent)' }} />,
      commandId: 'workbench.action.showCommands',
    },
    {
      title: 'Quick Open',
      shortcut: 'Ctrl+P',
      description: 'Quickly find and open files by filename',
      icon: <Search size={18} style={{ color: 'var(--text-accent)' }} />,
      commandId: 'workbench.action.quickOpen',
    },
    {
      title: 'Settings',
      shortcut: 'Ctrl+,',
      description: 'Configure themes, editor preferences, and density',
      icon: <Settings size={18} style={{ color: 'var(--text-accent)' }} />,
      commandId: 'workbench.action.openSettings',
    },
    {
      title: 'Reset Layout',
      shortcut: 'Alt+Shift+L',
      description: 'Restore sidebar, console, and density defaults',
      icon: <LayoutTemplate size={18} style={{ color: 'var(--text-accent)' }} />,
      commandId: 'workbench.action.resetLayout',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        boxSizing: 'border-box',
      }}
      className="qm-welcome-quick-access"
    >
      <h2
        style={{
          margin: 0,
          fontSize: '0.85rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          color: 'var(--text-muted)',
        }}
      >
        Discover & Tools
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '10px',
        }}
      >
        {links.map((link) => (
          <Card
            key={link.title}
            onClick={() => executeCommand(link.commandId)}
            style={{
              cursor: 'pointer',
              padding: '12px 14px',
              backgroundColor: 'var(--bg-app)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {link.icon}
                <span style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                  {link.title}
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-code)',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-hover)',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {link.shortcut}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {link.description}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
};
