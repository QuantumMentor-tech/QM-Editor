import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useWorkspace } from '../../state/WorkspaceContext';
import { globalLanguageRegistry } from '../../core/languageRegistry';
import { LanguageDefinition } from '../../types';
import { Check, Search, X } from 'lucide-react';

export interface LanguageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({ isOpen, onClose }) => {
  const { activeDoc, changeDocLanguage } = useWorkspace();
  const [filterText, setFilterText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allLanguages = useMemo(() => globalLanguageRegistry.getAllLanguages(), []);

  const filteredLanguages = useMemo(() => {
    if (!filterText.trim()) return allLanguages;
    const query = filterText.toLowerCase().trim();
    return allLanguages.filter(
      (lang) =>
        lang.displayName.toLowerCase().includes(query) ||
        lang.id.toLowerCase().includes(query) ||
        lang.extensions.some((ext) => ext.toLowerCase().includes(query)) ||
        lang.aliases.some((alias) => alias.toLowerCase().includes(query))
    );
  }, [allLanguages, filterText]);

  useEffect(() => {
    if (isOpen) {
      setFilterText('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filterText]);

  if (!isOpen || !activeDoc) return null;

  const handleSelectLanguage = (lang: LanguageDefinition) => {
    changeDocLanguage(activeDoc.id, lang.id);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredLanguages.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredLanguages.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredLanguages.length > 0 && selectedIndex < filteredLanguages.length) {
        handleSelectLanguage(filteredLanguages[selectedIndex]);
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '80px',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '440px',
          maxHeight: '480px',
          backgroundColor: 'var(--bg-card, #1e1e2e)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Search Header Input */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Select Language Mode (e.g. Python, TypeScript)..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
            }}
          />
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Filtered Languages List */}
        <div
          ref={listRef}
          role="listbox"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
          }}
        >
          {filteredLanguages.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No matching languages found.
            </div>
          ) : (
            filteredLanguages.map((lang, index) => {
              const isCurrent = activeDoc.language.toLowerCase() === lang.id.toLowerCase();
              const isFocused = index === selectedIndex;

              return (
                <div
                  key={lang.id}
                  role="option"
                  aria-selected={isCurrent}
                  onClick={() => handleSelectLanguage(lang)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isFocused ? 'var(--bg-hover)' : 'transparent',
                    color: isCurrent ? 'var(--text-accent)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    marginBottom: '2px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '16px', display: 'flex', alignItems: 'center' }}>
                      {isCurrent && <Check size={16} style={{ color: 'var(--text-accent)' }} />}
                    </div>
                    <span style={{ fontWeight: isCurrent ? 600 : 400 }}>{lang.displayName}</span>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {lang.extensions.map((ext) => `.${ext}`).join(', ')}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
