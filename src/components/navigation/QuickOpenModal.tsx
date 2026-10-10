import React, { useState, useEffect, useRef } from 'react';
import { QuickOpenResource, workspaceIndexService } from '../../services/WorkspaceIndexService';
import { QuickOpenSearchService, QuickOpenSearchResult } from '../../services/QuickOpenSearchService';
import { RecentDocumentsService } from '../../services/RecentDocumentsService';
import { DocumentModel, WorkspaceRootModel } from '../../types';
import { Search, FileCode, AlertCircle, Loader2 } from 'lucide-react';

export interface QuickOpenModalProps {
  workspaceRoot: WorkspaceRootModel | null;
  openDocs: DocumentModel[];
  onSelectResource: (resource: QuickOpenResource) => void | Promise<void>;
  onClose: () => void;
}

export const QuickOpenModal: React.FC<QuickOpenModalProps> = ({
  workspaceRoot,
  openDocs,
  onSelectResource,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Load indexed resources
  const indexedResources = workspaceIndexService.getResources();
  const recentDocs = RecentDocumentsService.getRecentDocuments();

  const searchResults: QuickOpenSearchResult[] = QuickOpenSearchService.search(
    indexedResources,
    query,
    openDocs,
    recentDocs
  );

  const isIndexing = workspaceIndexService.isIndexing();

  // Auto-focus search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset selection index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view safely
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const handleSelect = async (item: QuickOpenSearchResult) => {
    await onSelectResource(item.resource);
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
        handleSelect(searchResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const renderHighlights = (text: string, highlights: [number, number][]) => {
    if (!highlights || highlights.length === 0) return text;

    const parts: React.ReactNode[] = [];
    let lastIdx = 0;

    highlights.forEach(([start, end], idx) => {
      if (start > lastIdx) {
        parts.push(text.slice(lastIdx, start));
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
          {text.slice(start, end)}
        </span>
      );
      lastIdx = end;
    });

    if (lastIdx < text.length) {
      parts.push(text.slice(lastIdx));
    }

    return parts;
  };

  return (
    <div
      role="dialog"
      aria-label="Quick Open File Search"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        maxWidth: '580px',
        maxHeight: '440px',
        margin: '0 auto',
      }}
    >
      {/* Input Search Bar */}
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
          aria-controls="quick-open-list"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search files by name or path... (Ctrl+P)"
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
        {isIndexing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
            <span>Indexing...</span>
          </div>
        )}
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

      {/* Header Stats */}
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
          {workspaceRoot ? `${searchResults.length} files in ${workspaceRoot.name}` : `${searchResults.length} files available`}
        </span>
        <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <kbd style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
            ↑↓
          </kbd>{' '}
          Navigate
          <kbd style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
            Enter
          </kbd>{' '}
          Open
          <kbd style={{ backgroundColor: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '3px', border: '1px solid var(--border-color)' }}>
            Esc
          </kbd>{' '}
          Close
        </span>
      </div>

      {/* Results Listbox */}
      <div
        id="quick-open-list"
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
            <span>
              {workspaceRoot
                ? `No files matching "${query}" found in workspace`
                : 'No open workspace. Open a folder to search workspace files.'}
            </span>
          </div>
        ) : (
          searchResults.map((item, idx) => {
            const isSelected = idx === selectedIndex;

            return (
              <div
                key={item.resource.id}
                ref={isSelected ? selectedItemRef : null}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--accent-color)' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {/* Left side: File icon & path info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <FileCode
                    size={16}
                    style={{
                      color: isSelected ? 'var(--accent-color)' : 'var(--text-muted)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                        {renderHighlights(item.resource.name, item.nameHighlights)}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                      }}
                    >
                      {renderHighlights(item.resource.relativePath, item.pathHighlights)}
                    </span>
                  </div>
                </div>

                {/* Right side: Status badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
                  {item.isOpen && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        color: '#00d2ff',
                        backgroundColor: 'rgba(0, 210, 255, 0.12)',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        border: '1px solid rgba(0, 210, 255, 0.3)',
                      }}
                    >
                      OPEN
                    </span>
                  )}
                  {item.isRecent && !item.isOpen && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        color: 'var(--accent-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      RECENT
                    </span>
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
