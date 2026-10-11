import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useContextMenu } from '../../state/ContextMenuContext';
import { useCommand } from '../../state/CommandContext';
import { Check } from 'lucide-react';
import { ResolvedMenuGroup, ResolvedSurfaceItem } from '../../core/commands/CommandSurfaceTypes';

export const ContextMenu: React.FC = () => {
  const { menuState, closeContextMenu } = useContextMenu();
  const { surfaceRegistry, getCommandContext, executeCommand } = useCommand();
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const ctx = getCommandContext(menuState.target);
  const groups: ResolvedMenuGroup[] = menuState.isOpen
    ? surfaceRegistry.getSurfaceGroups(menuState.surfaceId, ctx)
    : [];

  const allItems: ResolvedSurfaceItem[] = groups.flatMap((g) => g.items);

  // Viewport clamping & position adjustment
  useLayoutEffect(() => {
    if (!menuState.isOpen || !menuRef.current) return;

    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const padding = 8;

    let x = menuState.position.x;
    let y = menuState.position.y;

    if (x + rect.width > window.innerWidth - padding) {
      x = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (y + rect.height > window.innerHeight - padding) {
      y = Math.max(padding, window.innerHeight - rect.height - padding);
    }

    setAdjustedPos({ x, y });
    setActiveIndex(-1);
  }, [menuState.isOpen, menuState.position.x, menuState.position.y]);

  // Click outside and escape listeners
  useEffect(() => {
    if (!menuState.isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    const handleWindowBlur = () => {
      closeContextMenu();
    };

    const handleResize = () => {
      closeContextMenu();
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('resize', handleResize);
    };
  }, [menuState.isOpen, closeContextMenu]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!menuState.isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeContextMenu();
      return;
    }

    const enabledIndices = allItems
      .map((item, idx) => (item.enabled ? idx : -1))
      .filter((idx) => idx !== -1);

    if (enabledIndices.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      const currentPos = enabledIndices.indexOf(activeIndex);
      const nextPos = currentPos < enabledIndices.length - 1 ? currentPos + 1 : 0;
      setActiveIndex(enabledIndices[nextPos]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      const currentPos = enabledIndices.indexOf(activeIndex);
      const prevPos = currentPos > 0 ? currentPos - 1 : enabledIndices.length - 1;
      setActiveIndex(enabledIndices[prevPos]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (activeIndex >= 0 && activeIndex < allItems.length) {
        const item = allItems[activeIndex];
        if (item.enabled) {
          handleItemClick(item);
        }
      }
    }
  };

  const handleItemClick = async (item: ResolvedSurfaceItem) => {
    if (!item.enabled) return;
    closeContextMenu();
    await executeCommand(item.commandId, menuState.target);
  };

  if (!menuState.isOpen || groups.length === 0) {
    return null;
  }

  let itemCounter = 0;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Context Menu"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        top: `${adjustedPos.y}px`,
        left: `${adjustedPos.x}px`,
        zIndex: 9999,
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
        minWidth: '190px',
        maxWidth: '320px',
        padding: '4px 0',
        fontSize: '0.8rem',
        color: 'var(--text-primary)',
        userSelect: 'none',
        outline: 'none',
      }}
    >
      {groups.map((group, groupIdx) => (
        <React.Fragment key={group.groupId}>
          {groupIdx > 0 && (
            <div
              role="separator"
              style={{
                height: '1px',
                backgroundColor: 'var(--border-color)',
                margin: '4px 0',
              }}
            />
          )}
          {group.items.map((item) => {
            const currentItemIdx = itemCounter++;
            const isItemActive = activeIndex === currentItemIdx;

            return (
              <div
                key={item.commandId}
                role="menuitem"
                aria-disabled={!item.enabled}
                aria-label={item.label}
                onClick={() => handleItemClick(item)}
                onMouseEnter={() => {
                  if (item.enabled) setActiveIndex(currentItemIdx);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 12px',
                  cursor: item.enabled ? 'pointer' : 'default',
                  opacity: item.enabled ? 1 : 0.45,
                  backgroundColor:
                    item.enabled && isItemActive
                      ? 'var(--bg-active, rgba(59, 130, 246, 0.2))'
                      : 'transparent',
                  color:
                    item.enabled && isItemActive
                      ? 'var(--text-accent, #58a6ff)'
                      : 'var(--text-primary)',
                  transition: 'background-color 0.1s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span
                    style={{
                      width: '14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {item.checked && <Check size={13} style={{ color: 'var(--text-accent)' }} />}
                  </span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </span>
                </div>

                {item.formattedShortcut && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                      marginLeft: '16px',
                      flexShrink: 0,
                    }}
                  >
                    {item.formattedShortcut}
                  </span>
                )}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};
