/**
 * QM Editor Code Completion Suggestion Widget
 * Phase 04, Step 42 — Language Intelligence Provider Architecture & Completion Framework
 */

import React, { useEffect, useRef } from 'react';
import { CompletionItem } from '../../core/language-intelligence/LanguageIntelligenceTypes';
import { SymbolIcon } from '../symbols/SymbolIcon';

export interface SuggestWidgetProps {
  items: CompletionItem[];
  selectedIndex: number;
  position: { x: number; y: number };
  onSelect: (item: CompletionItem) => void;
  onClose: () => void;
  onNavigate?: (index: number) => void;
  showDetails?: boolean;
}

export const SuggestWidget: React.FC<SuggestWidgetProps> = ({
  items,
  selectedIndex,
  position,
  onSelect,
  onClose,
  showDetails = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  // Auto-scroll selected item into view
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    });
  }, [selectedIndex]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [onClose]);

  if (items.length === 0) return null;

  const currentItem = items[selectedIndex] || items[0];

  // Clamp position within viewport
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

  const left = Math.min(position.x, viewportWidth - 360);
  const top = position.y + 240 > viewportHeight ? Math.max(10, position.y - 250) : position.y;

  return (
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Code Suggestions"
      style={{
        position: 'fixed',
        left: `${Math.max(10, left)}px`,
        top: `${Math.max(10, top)}px`,
        zIndex: 1000,
        width: '340px',
        maxHeight: '260px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-elevated, #1e1e2e)',
        border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
        borderRadius: 'var(--radius-md, 6px)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Suggestions List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
          maxHeight: currentItem?.documentation && showDetails ? '160px' : '250px',
        }}
      >
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={item.id}
              ref={isSelected ? selectedItemRef : undefined}
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(item)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                backgroundColor: isSelected ? 'var(--bg-hover, rgba(255, 255, 255, 0.1))' : 'transparent',
                color: isSelected ? 'var(--accent-primary, #60a5fa)' : 'var(--text-primary, #e2e8f0)',
                borderLeft: isSelected ? '2px solid var(--accent-primary, #60a5fa)' : '2px solid transparent',
              }}
            >
              <SymbolIcon kind={item.kind as any} size={14} />
              <span style={{ fontWeight: isSelected ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
              {item.detail && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--text-muted, #94a3b8)',
                    marginLeft: 'auto',
                    maxWidth: '120px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.detail}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Documentation / Details Footer Pane */}
      {showDetails && (currentItem?.documentation || currentItem?.detail) && (
        <div
          style={{
            padding: '6px 10px',
            borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            backgroundColor: 'var(--bg-secondary, rgba(0, 0, 0, 0.2))',
            fontSize: '0.74rem',
            color: 'var(--text-secondary, #cbd5e1)',
            maxHeight: '80px',
            overflowY: 'auto',
            lineHeight: 1.4,
          }}
        >
          {currentItem.detail && (
            <div style={{ fontWeight: 600, color: 'var(--text-primary, #f1f5f9)', marginBottom: '2px' }}>
              {currentItem.detail}
            </div>
          )}
          {currentItem.documentation && <div>{currentItem.documentation}</div>}
        </div>
      )}
    </div>
  );
};
