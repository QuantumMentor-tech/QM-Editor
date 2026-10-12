import React, { useState, useRef, useEffect } from 'react';
import { useCommand } from '../../state/CommandContext';
import {
  Plus,
  FolderOpen,
  Save,
  Undo2,
  Redo2,
  Search,
  FileCode,
  Terminal,
  Settings,
  MoreHorizontal,
} from 'lucide-react';
import { ResolvedSurfaceItem } from '../../core/commands/CommandSurfaceTypes';

const ICON_MAP: Record<string, React.ReactNode> = {
  Plus: <Plus size={16} />,
  FolderOpen: <FolderOpen size={16} />,
  Save: <Save size={16} />,
  Undo: <Undo2 size={16} />,
  Redo: <Redo2 size={16} />,
  Search: <Search size={16} />,
  FileCode: <FileCode size={16} />,
  Terminal: <Terminal size={16} />,
  Settings: <Settings size={16} />,
};

export const Toolbar: React.FC = () => {
  const { surfaceRegistry, getCommandContext, executeCommand } = useCommand();
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  const ctx = getCommandContext();
  const items = surfaceRegistry.getSurfaceItems('toolbar', ctx);

  // Monitor width of container for responsive reduction
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Close overflow on outside click
  useEffect(() => {
    if (!overflowOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    return () => window.removeEventListener('mousedown', handleMouseDown, true);
  }, [overflowOpen]);

  // Progressive reduction thresholds:
  // > 450px: show all 9 actions
  // 350px - 450px: show first 5 actions (New, Open, Save, Undo, Redo), overflow the rest
  // < 350px: show first 3 actions (New, Open, Save), overflow the rest
  let visibleCount = items.length;
  if (containerWidth < 350) {
    visibleCount = 3;
  } else if (containerWidth < 460) {
    visibleCount = 5;
  }

  const primaryItems = items.slice(0, visibleCount);
  const overflowItems = items.slice(visibleCount);

  const handleActionClick = async (item: ResolvedSurfaceItem) => {
    if (!item.enabled) return;
    setOverflowOpen(false);
    await executeCommand(item.commandId);
  };

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Primary Toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '0 4px',
      }}
    >
      {primaryItems.map((item) => {
        const iconNode = item.icon && ICON_MAP[item.icon] ? ICON_MAP[item.icon] : null;
        const tooltip = `${item.label}${item.formattedShortcut ? ` (${item.formattedShortcut})` : ''}`;

        return (
          <button
            key={item.commandId}
            onClick={() => handleActionClick(item)}
            disabled={!item.enabled}
            title={tooltip}
            aria-label={tooltip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '28px',
              width: '28px',
              padding: 0,
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 'var(--radius-sm)',
              color: item.enabled ? 'var(--text-primary)' : 'var(--text-muted)',
              opacity: item.enabled ? 1 : 0.45,
              cursor: item.enabled ? 'pointer' : 'default',
              transition: 'background-color 0.1s ease, border-color 0.1s ease',
            }}
            onMouseEnter={(e) => {
              if (item.enabled) {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            {iconNode}
          </button>
        );
      })}

      {/* Overflow Menu for secondary actions when width is constrained */}
      {overflowItems.length > 0 && (
        <div ref={overflowRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setOverflowOpen(!overflowOpen)}
            title="More Actions..."
            aria-label="More Actions..."
            aria-haspopup="true"
            aria-expanded={overflowOpen}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '28px',
              width: '28px',
              padding: 0,
              background: overflowOpen ? 'var(--bg-hover)' : 'transparent',
              border: '1px solid',
              borderColor: overflowOpen ? 'var(--border-color)' : 'transparent',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
          >
            <MoreHorizontal size={16} />
          </button>

          {overflowOpen && (
            <div
              role="menu"
              aria-label="Toolbar Overflow Actions"
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                zIndex: 'var(--z-dropdown, 100)' as unknown as number,
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
                minWidth: '200px',
                padding: '4px 0',
                fontSize: '0.8rem',
              }}
            >
              {overflowItems.map((item) => (
                <div
                  key={item.commandId}
                  role="menuitem"
                  aria-disabled={!item.enabled}
                  onClick={() => handleActionClick(item)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 12px',
                    cursor: item.enabled ? 'pointer' : 'default',
                    opacity: item.enabled ? 1 : 0.45,
                    color: 'var(--text-primary)',
                  }}
                  onMouseEnter={(e) => {
                    if (item.enabled) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {item.icon && ICON_MAP[item.icon]}
                    <span>{item.label}</span>
                  </div>
                  {item.formattedShortcut && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {item.formattedShortcut}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
