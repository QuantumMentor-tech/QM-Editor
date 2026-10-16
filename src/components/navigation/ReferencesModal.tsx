/**
 * QM Editor Code Navigation & References Modal
 * Phase 06, Step 60 — LSP Code Navigation, Definitions, Declarations, Type Definitions & References
 */

import React, { useState, useEffect, useRef } from 'react';
import { Location } from '../../core/navigation/LocationTypes';
import { ReferenceResult } from '../../core/lsp/navigation/LspNavigationTypes';
import { globalNavigationCoordinator } from '../../core/navigation/NavigationCoordinator';
import { FileCode, ChevronDown, ChevronRight, X, Compass } from 'lucide-react';
import { IconButton } from '../common/IconButton';

export interface ReferencesModalProps {
  title?: string;
  result?: ReferenceResult | null;
  locations?: Location[];
  onClose: () => void;
}

export const ReferencesModal: React.FC<ReferencesModalProps> = ({
  title = 'References',
  result,
  locations: directLocations,
  onClose,
}) => {
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive flat list of navigable locations
  const allLocations: Location[] = React.useMemo(() => {
    if (result && result.locations) {
      return result.locations as Location[];
    }
    return directLocations || [];
  }, [result, directLocations]);

  // Group locations by URI
  const groups = React.useMemo(() => {
    if (result && result.groups) {
      return result.groups;
    }
    const map = new Map<string, Location[]>();
    for (const loc of allLocations) {
      const arr = map.get(loc.uri) || [];
      arr.push(loc);
      map.set(loc.uri, arr);
    }
    return Array.from(map.entries()).map(([uri, locs]) => ({
      uri,
      displayPath: uri.split(/[\\/]/).pop() || uri,
      locations: locs,
    }));
  }, [result, allLocations]);

  const toggleGroup = (uri: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };

  const handleSelectLocation = async (loc: Location) => {
    await globalNavigationCoordinator.navigateToLocation(loc, {
      origin: 'lsp-navigation-results',
    });
    onClose();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(allLocations.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (allLocations[selectedIndex]) {
          handleSelectLocation(allLocations[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allLocations, selectedIndex]);

  return (
    <div
      role="dialog"
      aria-label={title}
      style={{
        position: 'fixed',
        top: '15%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '560px',
        maxHeight: '480px',
        backgroundColor: 'var(--bg-card, #1e1e2e)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md, 8px)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
      }}
      ref={containerRef}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface, #181825)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>
          <Compass size={16} />
          <span>{title}</span>
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-card)',
              padding: '2px 8px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
            }}
          >
            {allLocations.length}
          </span>
        </div>
        <IconButton onClick={onClose} icon={<X size={14} />} aria-label="Close" />
      </div>

      {/* Results List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {allLocations.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No navigation locations found.
          </div>
        ) : (
          groups.map((group) => {
            const isCollapsed = collapsedFiles.has(group.uri);
            return (
              <div key={group.uri} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* File Group Header */}
                <button
                  onClick={(e) => toggleGroup(group.uri, e)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 8px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    textAlign: 'left',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <FileCode size={14} style={{ color: 'var(--accent-primary, #89b4fa)' }} />
                  <span>{group.displayPath}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {group.locations.length}
                  </span>
                </button>

                {/* File Locations */}
                {!isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '22px', gap: '2px' }}>
                    {group.locations.map((loc) => {
                      const itemIndex = allLocations.indexOf(loc);
                      const isSelected = itemIndex === selectedIndex;
                      const line = loc.range?.startLine ?? 1;
                      const col = loc.range?.startColumn ?? 1;

                      return (
                        <div
                          key={`${group.uri}:${line}:${col}`}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelectLocation(loc)}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            cursor: 'pointer',
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: isSelected ? 'var(--bg-hover, rgba(255, 255, 255, 0.08))' : 'transparent',
                            color: isSelected ? 'var(--accent-primary, #89b4fa)' : 'var(--text-secondary)',
                            fontSize: '0.84rem',
                          }}
                        >
                          <span>Line {line}, Col {col}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {loc.uri.split(/[\\/]/).pop()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Instructions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          borderTop: '1px solid var(--border-color)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          backgroundColor: 'var(--bg-surface, #181825)',
        }}
      >
        <span>↑↓ to navigate</span>
        <span>Enter to jump</span>
        <span>Esc to close</span>
      </div>
    </div>
  );
};
