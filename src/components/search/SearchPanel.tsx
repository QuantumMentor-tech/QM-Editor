import React, { useEffect, useRef } from 'react';
import { useSearch } from '../../state/SearchContext';
import { useWorkspace } from '../../state/WorkspaceContext';
import { IconButton } from '../common/IconButton';
import { Button } from '../common/Button';
import { ChevronUp, ChevronDown, X, Replace, ReplaceAll, AlertCircle, ChevronRight } from 'lucide-react';

export const SearchPanel: React.FC = () => {
  const {
    isOpen,
    isReplaceOpen,
    query,
    replaceText,
    matches,
    currentMatchIndex,
    searchError,
    currentMatch,
    closeSearch,
    setQueryText,
    setReplaceText,
    toggleCaseSensitive,
    toggleWholeWord,
    toggleRegex,
    findNext,
    findPrevious,
    replaceCurrent,
    replaceAll,
    openSearch,
  } = useSearch();

  const { activeDoc } = useWorkspace();
  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when search opens
  useEffect(() => {
    if (isOpen) {
      if (isReplaceOpen) {
        replaceInputRef.current?.focus();
      } else {
        findInputRef.current?.focus();
      }
    }
  }, [isOpen, isReplaceOpen]);

  if (!isOpen) return null;

  const isReadOnly = Boolean(activeDoc?.fileResource?.readOnly);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSearch();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        findPrevious();
      } else {
        findNext();
      }
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        right: '24px',
        zIndex: 100,
        width: '360px',
        backgroundColor: 'var(--bg-card, #1e1e2e)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
        padding: '10px 14px',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Search Input Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <IconButton
          onClick={() => openSearch(!isReplaceOpen)}
          aria-label="Toggle Replace Row"
          icon={isReplaceOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          style={{ flexShrink: 0 }}
        />

        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            ref={findInputRef}
            type="text"
            value={query.text}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Find in active document..."
            style={{
              width: '100%',
              height: '28px',
              paddingLeft: '8px',
              paddingRight: '64px',
              backgroundColor: 'var(--bg-input, #11111b)',
              border: searchError ? '1px solid var(--text-danger, #ef4444)' : '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              outline: 'none',
            }}
          />

          {/* Match Count Indicator */}
          <span
            style={{
              position: 'absolute',
              right: '8px',
              fontSize: '0.72rem',
              color: matches.length > 0 ? 'var(--text-muted)' : query.text ? 'var(--text-danger, #ef4444)' : 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          >
            {!query.text
              ? ''
              : matches.length > 0
              ? `${currentMatchIndex + 1} of ${matches.length}`
              : 'No results'}
          </span>
        </div>

        {/* Option Toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button
            onClick={toggleCaseSensitive}
            title="Match Case (Aa)"
            aria-pressed={query.caseSensitive}
            style={{
              height: '26px',
              padding: '0 6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: query.caseSensitive ? 'var(--bg-active, rgba(59, 130, 246, 0.25))' : 'transparent',
              color: query.caseSensitive ? 'var(--text-accent)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Aa
          </button>

          <button
            onClick={toggleWholeWord}
            title="Match Whole Word (\b)"
            aria-pressed={query.wholeWord}
            style={{
              height: '26px',
              padding: '0 6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: query.wholeWord ? 'var(--bg-active, rgba(59, 130, 246, 0.25))' : 'transparent',
              color: query.wholeWord ? 'var(--text-accent)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            \b
          </button>

          <button
            onClick={toggleRegex}
            title="Use Regular Expression (.*)"
            aria-pressed={query.regex}
            style={{
              height: '26px',
              padding: '0 6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              backgroundColor: query.regex ? 'var(--bg-active, rgba(59, 130, 246, 0.25))' : 'transparent',
              color: query.regex ? 'var(--text-accent)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            .*
          </button>
        </div>

        {/* Navigation Buttons */}
        <IconButton
          onClick={findPrevious}
          disabled={matches.length === 0}
          aria-label="Find Previous (Shift+F3)"
          icon={<ChevronUp size={16} />}
        />
        <IconButton
          onClick={findNext}
          disabled={matches.length === 0}
          aria-label="Find Next (F3)"
          icon={<ChevronDown size={16} />}
        />
        <IconButton
          onClick={closeSearch}
          aria-label="Close Search (Escape)"
          icon={<X size={16} />}
        />
      </div>

      {/* Replace Row */}
      {isReplaceOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ flex: 1 }}>
            <input
              ref={replaceInputRef}
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  replaceCurrent();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  closeSearch();
                }
              }}
              placeholder={isReadOnly ? 'Document is read-only' : 'Replace with...'}
              disabled={isReadOnly}
              style={{
                width: '100%',
                height: '28px',
                padding: '0 8px',
                backgroundColor: 'var(--bg-input, #11111b)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                outline: 'none',
                opacity: isReadOnly ? 0.6 : 1,
              }}
            />
          </div>

          <Button
            onClick={replaceCurrent}
            disabled={isReadOnly || !currentMatch}
            variant="secondary"
            icon={<Replace size={14} />}
            style={{ fontSize: '0.75rem', height: '28px', padding: '0 8px' }}
          >
            Replace
          </Button>

          <Button
            onClick={replaceAll}
            disabled={isReadOnly || matches.length === 0}
            variant="secondary"
            icon={<ReplaceAll size={14} />}
            style={{ fontSize: '0.75rem', height: '28px', padding: '0 8px' }}
          >
            Replace All
          </Button>
        </div>
      )}

      {/* Regex Syntax Error Banner */}
      {searchError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.75rem',
            color: 'var(--text-danger, #ef4444)',
            padding: '4px 6px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{searchError}</span>
        </div>
      )}
    </div>
  );
};
