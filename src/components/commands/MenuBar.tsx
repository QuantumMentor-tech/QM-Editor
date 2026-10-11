import React, { useState, useRef, useEffect } from 'react';
import { useCommand } from '../../state/CommandContext';
import { Check } from 'lucide-react';
import { MenuBarCategory, ResolvedMenuGroup, ResolvedSurfaceItem } from '../../core/commands/CommandSurfaceTypes';

export const MenuBar: React.FC = () => {
  const { surfaceRegistry, getCommandContext, executeCommand } = useCommand();
  const [openCategoryId, setOpenCategoryId] = useState<MenuBarCategory | null>(null);
  const [activeItemIndex, setActiveItemIndex] = useState<number>(-1);
  const menubarRef = useRef<HTMLDivElement>(null);
  const menuDropdownRef = useRef<HTMLDivElement>(null);

  const ctx = getCommandContext();
  const menuBarData = surfaceRegistry.getResolvedMenuBar(ctx);

  const currentCategory = menuBarData.find((cat) => cat.id === openCategoryId);
  const currentItems: ResolvedSurfaceItem[] = currentCategory
    ? currentCategory.groups.flatMap((g) => g.items)
    : [];

  // Close when clicking outside
  useEffect(() => {
    if (!openCategoryId) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (
        menubarRef.current &&
        !menubarRef.current.contains(e.target as Node) &&
        menuDropdownRef.current &&
        !menuDropdownRef.current.contains(e.target as Node)
      ) {
        setOpenCategoryId(null);
        setActiveItemIndex(-1);
      }
    };

    const handleWindowBlur = () => {
      setOpenCategoryId(null);
      setActiveItemIndex(-1);
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [openCategoryId]);

  // Keyboard navigation on MenuBar
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const categoryIds = menuBarData.map((c) => c.id);
    const currentCatIndex = openCategoryId ? categoryIds.indexOf(openCategoryId) : -1;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpenCategoryId(null);
      setActiveItemIndex(-1);
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      const nextIndex = currentCatIndex < categoryIds.length - 1 ? currentCatIndex + 1 : 0;
      setOpenCategoryId(categoryIds[nextIndex]);
      setActiveItemIndex(-1);
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      const prevIndex = currentCatIndex > 0 ? currentCatIndex - 1 : categoryIds.length - 1;
      setOpenCategoryId(categoryIds[prevIndex]);
      setActiveItemIndex(-1);
      return;
    }

    if (openCategoryId && currentItems.length > 0) {
      const enabledIndices = currentItems
        .map((item, idx) => (item.enabled ? idx : -1))
        .filter((idx) => idx !== -1);

      if (enabledIndices.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        const currentPos = enabledIndices.indexOf(activeItemIndex);
        const nextPos = currentPos < enabledIndices.length - 1 ? currentPos + 1 : 0;
        setActiveItemIndex(enabledIndices[nextPos]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const currentPos = enabledIndices.indexOf(activeItemIndex);
        const prevPos = currentPos > 0 ? currentPos - 1 : enabledIndices.length - 1;
        setActiveItemIndex(enabledIndices[prevPos]);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (activeItemIndex >= 0 && activeItemIndex < currentItems.length) {
          const item = currentItems[activeItemIndex];
          if (item.enabled) {
            handleItemClick(item);
          }
        }
      }
    }
  };

  const handleItemClick = async (item: ResolvedSurfaceItem) => {
    if (!item.enabled) return;
    setOpenCategoryId(null);
    setActiveItemIndex(-1);
    await executeCommand(item.commandId);
  };

  const toggleCategory = (catId: MenuBarCategory) => {
    if (openCategoryId === catId) {
      setOpenCategoryId(null);
      setActiveItemIndex(-1);
    } else {
      setOpenCategoryId(catId);
      setActiveItemIndex(-1);
    }
  };

  const handleMouseEnterCategory = (catId: MenuBarCategory) => {
    if (openCategoryId && openCategoryId !== catId) {
      setOpenCategoryId(catId);
      setActiveItemIndex(-1);
    }
  };

  let globalItemCounter = 0;

  return (
    <div
      ref={menubarRef}
      role="menubar"
      aria-label="Application Menu"
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '100%',
        userSelect: 'none',
        position: 'relative',
        fontSize: '0.8rem',
      }}
    >
      {menuBarData.map((category) => {
        const isOpen = openCategoryId === category.id;

        return (
          <div key={category.id} style={{ position: 'relative' }}>
            <button
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={isOpen}
              onClick={() => toggleCategory(category.id)}
              onMouseEnter={() => handleMouseEnterCategory(category.id)}
              style={{
                background: isOpen ? 'var(--bg-active, rgba(59, 130, 246, 0.2))' : 'transparent',
                border: 'none',
                color: isOpen ? 'var(--text-accent)' : 'var(--text-primary)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: isOpen ? 600 : 400,
                transition: 'background-color 0.1s ease',
              }}
            >
              {category.label}
            </button>

            {/* Dropdown Menu Overlay */}
            {isOpen && (
              <div
                ref={menuDropdownRef}
                role="menu"
                aria-label={`${category.label} Menu`}
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '2px',
                  zIndex: 9999,
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
                  minWidth: '220px',
                  maxWidth: '320px',
                  padding: '4px 0',
                  color: 'var(--text-primary)',
                }}
              >
                {category.groups.map((group: ResolvedMenuGroup, groupIdx: number) => (
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
                    {group.items.map((item: ResolvedSurfaceItem) => {
                      const itemIdx = globalItemCounter++;
                      const isItemActive = activeItemIndex === itemIdx;

                      return (
                        <div
                          key={item.commandId}
                          role="menuitem"
                          aria-disabled={!item.enabled}
                          aria-label={item.label}
                          onClick={() => handleItemClick(item)}
                          onMouseEnter={() => {
                            if (item.enabled) setActiveItemIndex(itemIdx);
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
                              {item.checked && (
                                <Check size={13} style={{ color: 'var(--text-accent)' }} />
                              )}
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
            )}
          </div>
        );
      })}
    </div>
  );
};
