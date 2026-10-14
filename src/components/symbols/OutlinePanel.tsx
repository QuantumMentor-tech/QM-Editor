/**
 * QM Editor Outline Panel (Active Document Symbol Tree)
 * Phase 04, Step 35 & Step 41 — Symbol Infrastructure, Outline & Symbol Navigation
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useWorkspace } from '../../state/WorkspaceContext';
import { useNavigation } from '../../state/NavigationContext';
import { DocumentSymbol } from '../../core/symbols/SymbolTypes';
import { globalSymbolService } from '../../core/symbols/SymbolService';
import { globalNavigationCoordinator } from '../../core/navigation/NavigationCoordinator';
import { SymbolIcon } from './SymbolIcon';
import { ChevronRight, ChevronDown, Filter, Loader2 } from 'lucide-react';
import { EmptyState } from '../common/EmptyState';

export const OutlinePanel: React.FC = () => {
  const { activeDoc } = useWorkspace();
  const { currentPos } = useNavigation();
  const [symbols, setSymbols] = useState<DocumentSymbol[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Load symbols for active document
  useEffect(() => {
    if (!activeDoc) {
      setSymbols([]);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    let isSubscribed = true;
    setIsLoading(true);
    setHasError(false);

    globalSymbolService
      .getDocumentSymbols(activeDoc)
      .then((res) => {
        if (isSubscribed) {
          setSymbols(res);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isSubscribed) {
          setSymbols([]);
          setIsLoading(false);
          setHasError(true);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [activeDoc?.id, activeDoc?.contentRevision, activeDoc?.content]);

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSymbolClick = (sym: DocumentSymbol) => {
    if (!activeDoc) return;
    const uri = activeDoc.fileResource?.uri || activeDoc.filePath || activeDoc.title;
    globalNavigationCoordinator.navigateToLocation(
      {
        uri,
        range: sym.range,
        selectionRange: sym.selectionRange,
      },
      { origin: 'outline' }
    );
  };

  // Check if cursor is currently within symbol range
  const isSymbolActive = (sym: DocumentSymbol): boolean => {
    if (!currentPos) return false;
    const curLine = currentPos.line;
    return curLine >= sym.range.startLine && curLine <= sym.range.endLine;
  };

  // Filter symbols recursively
  const filteredSymbols = useMemo(() => {
    if (!filterQuery.trim()) return symbols;
    const q = filterQuery.toLowerCase();

    const filterList = (list: DocumentSymbol[]): DocumentSymbol[] => {
      const out: DocumentSymbol[] = [];
      for (const item of list) {
        const matches = item.name.toLowerCase().includes(q);
        const filteredChildren = item.children ? filterList(item.children) : [];
        if (matches || filteredChildren.length > 0) {
          out.push({
            ...item,
            children: filteredChildren,
          });
        }
      }
      return out;
    };

    return filterList(symbols);
  }, [symbols, filterQuery]);

  const renderSymbolTree = (list: DocumentSymbol[], depth = 0) => {
    return list.map((sym, idx) => {
      const id = `${sym.name}-${sym.range.startLine}-${depth}-${idx}`;
      const hasChildren = Boolean(sym.children && sym.children.length > 0);
      const isCollapsed = collapsedNodes.has(id);
      const isActive = isSymbolActive(sym);

      return (
        <React.Fragment key={id}>
          <div
            role="treeitem"
            tabIndex={0}
            aria-selected={isActive}
            aria-label={`${sym.kind}: ${sym.name}, line ${sym.range.startLine}`}
            onClick={() => handleSymbolClick(sym)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleSymbolClick(sym);
              } else if (e.key === 'ArrowRight' && hasChildren && isCollapsed) {
                e.preventDefault();
                setCollapsedNodes((prev) => {
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                });
              } else if (e.key === 'ArrowLeft' && hasChildren && !isCollapsed) {
                e.preventDefault();
                setCollapsedNodes((prev) => {
                  const next = new Set(prev);
                  next.add(id);
                  return next;
                });
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              paddingLeft: `${12 + depth * 14}px`,
              fontSize: '0.8rem',
              cursor: 'pointer',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
              backgroundColor: isActive ? 'var(--bg-hover)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
              transition: 'background-color 0.1s ease',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {hasChildren ? (
              <span
                onClick={(e) => toggleCollapse(id, e)}
                style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
              >
                {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              </span>
            ) : (
              <span style={{ width: '13px' }} />
            )}

            <SymbolIcon kind={sym.kind} size={14} />

            <span style={{ fontWeight: isActive ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sym.name}
            </span>

            {sym.detail && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                {sym.detail}
              </span>
            )}
          </div>

          {hasChildren && !isCollapsed && renderSymbolTree(sym.children!, depth + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <div
      role="region"
      aria-label="Symbol Outline Panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--bg-sidebar)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Outline Toolbar & Filter */}
      <div
        style={{
          padding: '6px 8px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'var(--bg-header)',
        }}
      >
        <Filter size={12} color="var(--text-muted)" />
        <input
          type="text"
          placeholder="Filter outline symbols..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          style={{
            flex: 1,
            fontSize: '0.74rem',
            padding: '3px 6px',
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            outline: 'none',
          }}
        />
      </div>

      {/* Symbol Tree Container */}
      <div
        role="tree"
        aria-label="Outline Tree"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
        }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <Loader2 size={16} className="animate-spin" />
            <span>Analyzing document symbols...</span>
          </div>
        ) : hasError ? (
          <div style={{ padding: '24px 16px' }}>
            <EmptyState
              title="Symbol Analysis Failed"
              description="Could not extract symbols for the current document."
            />
          </div>
        ) : !activeDoc ? (
          <div style={{ padding: '24px 16px' }}>
            <EmptyState
              title="No Document Active"
              description="Open a file to view its outline structure."
            />
          </div>
        ) : filteredSymbols.length > 0 ? (
          renderSymbolTree(filteredSymbols)
        ) : (
          <div style={{ padding: '24px 16px' }}>
            <EmptyState
              title="No Symbols Found"
              description={
                filterQuery
                  ? 'No symbols match the current filter.'
                  : 'No functions, classes, or outline elements detected in this document.'
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};
