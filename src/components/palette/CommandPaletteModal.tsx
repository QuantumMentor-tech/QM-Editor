import React, { useState, useEffect, useRef } from 'react';
import { CommandRegistry } from '../../core/commands/CommandRegistry';
import { CommandContext as CommandContextType } from '../../core/commands/CommandTypes';
import { CommandSearchService, CommandSearchResult } from '../../services/CommandSearchService';
import { ShortcutManager } from '../../core/commands/ShortcutManager';
import { Search, Command as CommandIcon, AlertCircle } from 'lucide-react';

export interface CommandPaletteModalProps {
  registry: CommandRegistry;
  commandContext: CommandContextType;
  onExecuteCommand: (id: string) => void | Promise<void>;
  onClose: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  registry,
  commandContext,
  onExecuteCommand,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  const allCommands = registry.getAll();
  const searchResults: CommandSearchResult[] = CommandSearchService.search(
    allCommands,
    query,
    commandContext
  );

  // Focus input automatically on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view safely
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const handleExecute = async (item: CommandSearchResult) => {
    if (!item.isAvailable) return;
    await onExecuteCommand(item.command.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % searchResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSelectedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      if (searchResults.length > 0) {
        setSelectedIndex(searchResults.length - 1);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0 && selectedIndex < searchResults.length) {
        handleExecute(searchResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const renderHighlightedLabel = (label: string, highlights: [number, number][]) => {
    if (!highlights || highlights.length === 0) return label;

    const parts: React.ReactNode[] = [];
    let lastIdx = 0;

    highlights.forEach(([start, end], idx) => {
      if (start > lastIdx) {
        parts.push(label.slice(lastIdx, start));
      }
      parts.push(
        <span
          key={idx}
          style={{
            fontWeight: 700,
            color: 'var(--accent-color)',
            textDecoration: 'underline',
          }}
        >
          {label.slice(start, end)}
        </span>
      );
      lastIdx = end;
    });

    if (lastIdx < label.length) {
      parts.push(label.slice(lastIdx));
    }

    return parts;
  };

  return (
    <div
      role="dialog"
      aria-label="Command Palette"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        maxWidth: '560px',
        maxHeight: '440px',
        margin: '0 auto',
      }}
    >
      {/* Search Input Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '8px 12px',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--accent-color)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 0 8px rgba(0, 210, 255, 0.15)',
        }}
      >
        <Search size={18} style={{ color: 'var(--accent-color)' }} />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={searchResults.length > 0}
          aria-controls="command-palette-list"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command or search... (e.g. Save, Undo, Go to Line)"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.95rem',
            fontFamily: 'inherit',
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear Search"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              padding: '2px 6px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Results Header / Stats */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 4px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        <span>
          {searchResults.length} {searchResults.length === 1 ? 'command' : 'commands'} available
        </span>
        <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <kbd style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
            ↑↓
          </kbd>{' '}
          Navigate
          <kbd style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
            Enter
          </kbd>{' '}
          Select
          <kbd style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
            Esc
          </kbd>{' '}
          Close
        </span>
      </div>

      {/* Commands List */}
      <div
        id="command-palette-list"
        ref={listRef}
        role="listbox"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          maxHeight: '300px',
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        {searchResults.length === 0 ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={24} style={{ opacity: 0.6 }} />
            <span>No matching commands found for &quot;{query}&quot;</span>
          </div>
        ) : (
          searchResults.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const formattedShortcut = item.command.shortcut
              ? ShortcutManager.formatShortcut(item.command.shortcut)
              : null;

            return (
              <div
                key={item.command.id}
                ref={isSelected ? selectedItemRef : null}
                role="option"
                aria-selected={isSelected}
                aria-disabled={!item.isAvailable}
                onClick={() => handleExecute(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--accent-color)' : '3px solid transparent',
                  cursor: item.isAvailable ? 'pointer' : 'not-allowed',
                  opacity: item.isAvailable ? 1 : 0.5,
                  transition: 'background-color 0.15s ease',
                }}
              >
                {/* Left: Command info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <CommandIcon
                    size={15}
                    style={{
                      color: isSelected ? 'var(--accent-color)' : 'var(--text-muted)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          color: 'var(--accent-color)',
                          backgroundColor: 'var(--bg-secondary)',
                          padding: '1px 5px',
                          borderRadius: '3px',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        {item.command.category}
                      </span>
                      <span
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: isSelected ? 600 : 400,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {renderHighlightedLabel(item.command.label, item.labelHighlights)}
                      </span>
                    </div>

                    {item.command.description && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {item.command.description}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Shortcut badge / Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                  {!item.isAvailable && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                      }}
                    >
                      Disabled
                    </span>
                  )}
                  {formattedShortcut && (
                    <kbd
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                      }}
                    >
                      {formattedShortcut}
                    </kbd>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
