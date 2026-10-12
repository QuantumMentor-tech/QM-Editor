/**
 * QM Editor Go to Symbol Modal (Document & Workspace)
 * Phase 04, Step 35 — Symbol Infrastructure, Outline & Symbol Navigation
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DocumentModel } from '../../types';
import {
  DocumentSymbol,
  WorkspaceSymbol,
} from '../../core/symbols/SymbolTypes';
import { globalSymbolService } from '../../core/symbols/SymbolService';
import { CancellationTokenSource } from '../../core/symbols/CancellationToken';
import { SymbolIcon } from './SymbolIcon';
import { Search, Loader2 } from 'lucide-react';
import { EmptyState } from '../common/EmptyState';

export interface GoToSymbolModalProps {
  initialMode?: 'document' | 'workspace';
  activeDoc: DocumentModel | null;
  onNavigate: (uri: string, line: number, column: number) => void;
  onClose: () => void;
}

interface FlattenedSymbolItem {
  id: string;
  name: string;
  kind: DocumentSymbol['kind'];
  detail?: string;
  containerName?: string;
  uri: string;
  line: number;
  column: number;
}

export const GoToSymbolModal: React.FC<GoToSymbolModalProps> = ({
  initialMode = 'document',
  activeDoc,
  onNavigate,
  onClose,
}) => {
  const [query, setQuery] = useState<string>(initialMode === 'workspace' ? '#' : '@');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [docSymbols, setDocSymbols] = useState<DocumentSymbol[]>([]);
  const [workspaceSymbols, setWorkspaceSymbols] = useState<WorkspaceSymbol[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);
  const ctsRef = useRef<CancellationTokenSource | null>(null);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
    if (inputRef.current) {
      inputRef.current.setSelectionRange(1, 1);
    }
  }, []);

  const isWorkspaceMode = query.startsWith('#');
  const cleanFilter = (query.startsWith('@') || query.startsWith('#') ? query.slice(1) : query).trim().toLowerCase();

  // Load document symbols when in document mode
  useEffect(() => {
    if (isWorkspaceMode || !activeDoc) {
      setDocSymbols([]);
      return;
    }

    ctsRef.current?.cancel();
    const cts = new CancellationTokenSource();
    ctsRef.current = cts;

    setIsLoading(true);
    globalSymbolService
      .getDocumentSymbols(activeDoc, cts.token)
      .then((symbols) => {
        if (!cts.token.isCancellationRequested) {
          setDocSymbols(symbols);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cts.token.isCancellationRequested) {
          setIsLoading(false);
        }
      });

    return () => {
      cts.cancel();
    };
  }, [activeDoc, isWorkspaceMode]);

  // Load workspace symbols when in workspace mode
  useEffect(() => {
    if (!isWorkspaceMode) {
      setWorkspaceSymbols([]);
      return;
    }

    ctsRef.current?.cancel();
    const cts = new CancellationTokenSource();
    ctsRef.current = cts;

    setIsLoading(true);
    globalSymbolService
      .getWorkspaceSymbols(cleanFilter, cts.token)
      .then((symbols) => {
        if (!cts.token.isCancellationRequested) {
          setWorkspaceSymbols(symbols);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cts.token.isCancellationRequested) {
          setIsLoading(false);
        }
      });

    return () => {
      cts.cancel();
    };
  }, [isWorkspaceMode, cleanFilter]);

  // Flatten document symbols
  const flatDocSymbols = useMemo(() => {
    if (isWorkspaceMode) return [];
    const result: FlattenedSymbolItem[] = [];

    const recurse = (syms: DocumentSymbol[], parent?: string) => {
      for (const s of syms) {
        result.push({
          id: `${s.name}-${s.range.startLine}-${s.range.startColumn}`,
          name: s.name,
          kind: s.kind,
          detail: s.detail,
          containerName: s.containerName || parent,
          uri: activeDoc?.filePath || activeDoc?.title || '',
          line: s.range.startLine,
          column: s.range.startColumn,
        });
        if (s.children && s.children.length > 0) {
          recurse(s.children, s.name);
        }
      }
    };

    recurse(docSymbols);
    return result;
  }, [docSymbols, isWorkspaceMode, activeDoc]);

  // Filtered items
  const filteredItems: FlattenedSymbolItem[] = useMemo(() => {
    if (isWorkspaceMode) {
      return workspaceSymbols.map((s, idx) => ({
        id: `${s.name}-${s.location.uri}-${idx}`,
        name: s.name,
        kind: s.kind,
        containerName: s.containerName,
        uri: s.location.uri,
        line: s.location.range.startLine,
        column: s.location.range.startColumn,
      }));
    }

    if (!cleanFilter) return flatDocSymbols;

    return flatDocSymbols.filter(
      (s) =>
        s.name.toLowerCase().includes(cleanFilter) ||
        (s.containerName && s.containerName.toLowerCase().includes(cleanFilter)) ||
        (s.detail && s.detail.toLowerCase().includes(cleanFilter))
    );
  }, [isWorkspaceMode, workspaceSymbols, flatDocSymbols, cleanFilter]);

  // Reset selected index on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected into view
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  const handleSelect = (item: FlattenedSymbolItem) => {
    onClose();
    onNavigate(item.uri, item.line, item.column);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Go to Symbol"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '560px',
        maxHeight: '440px',
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-elevation-high)',
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Search Input Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        <Search size={16} color="var(--text-muted)" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            isWorkspaceMode
              ? 'Type symbol name to search workspace (#)...'
              : 'Type symbol name to search editor (@)...'
          }
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
          }}
        />
        {isLoading && <Loader2 size={16} className="animate-spin" color="var(--accent-primary)" />}
        <span
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-tertiary)',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
        >
          {isWorkspaceMode ? '# Workspace' : '@ Document'}
        </span>
      </div>

      {/* Symbol List */}
      <div
        ref={listRef}
        role="listbox"
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '340px',
        }}
      >
        {filteredItems.length > 0 ? (
          filteredItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={item.id}
                ref={isSelected ? selectedItemRef : null}
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                onClick={() => handleSelect(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 14px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  transition: 'background-color 0.1s ease',
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <SymbolIcon kind={item.kind} size={15} />
                  <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>{item.name}</span>
                  {item.detail && (
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{item.detail}</span>
                  )}
                  {item.containerName && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--bg-tertiary)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                      }}
                    >
                      {item.containerName}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-code, monospace)',
                    flexShrink: 0,
                    marginLeft: '12px',
                  }}
                >
                  {isWorkspaceMode ? (
                    <span>
                      {item.uri.split('/').pop()} :{item.line}
                    </span>
                  ) : (
                    <span>Line {item.line}</span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: '28px 16px' }}>
            <EmptyState
              title={isWorkspaceMode ? 'No matching workspace symbols' : 'No symbols found in document'}
              description={
                isWorkspaceMode
                  ? 'Try refining your query or switch to document mode with @'
                  : 'No functions, classes, or types detected in the active document.'
              }
            />
          </div>
        )}
      </div>

      {/* Modal Footer Keybind Hints */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          backgroundColor: 'var(--bg-header)',
        }}
      >
        <span>
          Tip: Prefix with <kbd style={{ padding: '1px 4px', background: 'var(--bg-secondary)', borderRadius: '3px' }}>@</kbd> for document, <kbd style={{ padding: '1px 4px', background: 'var(--bg-secondary)', borderRadius: '3px' }}>#</kbd> for workspace
        </span>
        <span>
          <kbd style={{ padding: '1px 4px', background: 'var(--bg-secondary)', borderRadius: '3px' }}>↑↓</kbd> to navigate, <kbd style={{ padding: '1px 4px', background: 'var(--bg-secondary)', borderRadius: '3px' }}>Enter</kbd> to jump
        </span>
      </div>
    </div>
  );
};
