import React from 'react';

export interface ListProps {
  children: React.ReactNode;
  'aria-label'?: string;
  style?: React.CSSProperties;
  className?: string;
}

export const List: React.FC<ListProps> = ({
  children,
  'aria-label': ariaLabel,
  style,
  className = '',
}) => {
  return (
    <div
      role="list"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
      className={`qm-list ${className}`}
    >
      {children}
    </div>
  );
};

export interface ListItemProps {
  children?: React.ReactNode;
  leading?: React.ReactNode;
  title?: React.ReactNode;
  secondary?: React.ReactNode;
  trailing?: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
  tabIndex?: number;
}

export const ListItem: React.FC<ListItemProps> = ({
  children,
  leading,
  title,
  secondary,
  trailing,
  selected = false,
  disabled = false,
  onClick,
  style,
  className = '',
  tabIndex,
}) => {
  const isInteractive = Boolean(onClick);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isInteractive || disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      role="listitem"
      tabIndex={isInteractive && !disabled ? (tabIndex ?? 0) : undefined}
      aria-selected={selected}
      aria-disabled={disabled ? 'true' : undefined}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: selected ? 'var(--bg-active-tab, #090d16)' : 'transparent',
        borderLeft: selected ? '3px solid var(--accent-primary, #0284c7)' : '3px solid transparent',
        color: 'var(--text-primary)',
        cursor: disabled ? 'not-allowed' : isInteractive ? 'pointer' : 'default',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
        userSelect: 'none',
        boxSizing: 'border-box',
        outline: 'none',
        ...style,
      }}
      className={`qm-list-item ${className}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
        {leading && (
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'var(--text-muted)' }}>
            {leading}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          {title && (
            <div
              style={{
                fontSize: '0.84rem',
                fontWeight: selected ? 600 : 400,
                color: selected ? 'var(--text-accent)' : 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </div>
          )}
          {secondary && (
            <div
              style={{
                fontSize: '0.74rem',
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {secondary}
            </div>
          )}
          {children}
        </div>
      </div>

      {trailing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
          {trailing}
        </div>
      )}
    </div>
  );
};
