/**
 * QM Editor Code Action & Quick Fix Floating Widget
 * Phase 04, Step 44 — Code Actions, Quick Fixes & Safe Code Transformation Foundation
 */

import React, { useEffect, useRef } from 'react';
import { CodeAction } from '../../core/language-intelligence/CodeActionTypes';
import { Sparkles, Wrench, Package, Eye, Lightbulb } from 'lucide-react';

export interface CodeActionWidgetProps {
  actions: CodeAction[];
  selectedIndex: number;
  position: { x: number; y: number };
  onSelectIndex: (index: number) => void;
  onApply: (action: CodeAction) => void;
  onPreview: (action: CodeAction) => void;
  onClose: () => void;
}

export const CodeActionWidget: React.FC<CodeActionWidgetProps> = ({
  actions,
  selectedIndex,
  position,
  onSelectIndex,
  onApply,
  onPreview,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        onSelectIndex((selectedIndex + 1) % actions.length);
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        onSelectIndex((selectedIndex - 1 + actions.length) % actions.length);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (actions[selectedIndex]) {
          onApply(actions[selectedIndex]);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [actions, selectedIndex, onSelectIndex, onApply, onClose]);

  // Click outside to dismiss
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (actions.length === 0) return null;

  return (
    <div
      ref={containerRef}
      role="menu"
      aria-label="Code Actions and Quick Fixes"
      style={{
        position: 'fixed',
        left: `${Math.max(16, position.x)}px`,
        top: `${Math.max(16, position.y)}px`,
        zIndex: 9000,
        width: '360px',
        maxWidth: '90vw',
        maxHeight: '380px',
        backgroundColor: 'var(--bg-secondary, #1e1e2e)',
        border: '1px solid var(--border-color, #313244)',
        borderRadius: '6px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontSize: '0.82rem',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          borderBottom: '1px solid var(--border-color, #313244)',
          backgroundColor: 'var(--bg-primary, #181825)',
          color: 'var(--text-muted, #a6adc8)',
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          fontWeight: 600,
          letterSpacing: '0.5px',
        }}
      >
        <Lightbulb size={13} style={{ color: '#f9e2af' }} />
        <span>Code Actions ({actions.length})</span>
      </div>

      {/* Action items list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {actions.map((action, idx) => {
          const isSelected = idx === selectedIndex;
          const isDisabled = Boolean(action.disabledReason);

          return (
            <div
              key={action.id}
              role="menuitem"
              tabIndex={0}
              aria-disabled={isDisabled}
              onClick={() => {
                if (!isDisabled) onApply(action);
              }}
              onMouseEnter={() => onSelectIndex(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                backgroundColor: isSelected
                  ? 'var(--bg-hover, rgba(137, 180, 250, 0.15))'
                  : 'transparent',
                color: isDisabled
                  ? 'var(--text-muted, #6c7086)'
                  : isSelected
                  ? 'var(--text-accent, #89b4fa)'
                  : 'var(--text-primary, #cdd6f4)',
                opacity: isDisabled ? 0.6 : 1,
                borderLeft: isSelected
                  ? '3px solid var(--text-accent, #89b4fa)'
                  : '3px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                {getActionIcon(action.kind, action.isPreferred)}
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      fontWeight: action.isPreferred ? 600 : 400,
                    }}
                  >
                    {action.title}
                  </span>
                  {action.disabledReason && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6c7086)' }}>
                      {action.disabledReason}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {/* Preview Button */}
                {!isDisabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview(action);
                    }}
                    title="Preview Transformation"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted, #a6adc8)',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Eye size={13} />
                  </button>
                )}

                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--text-muted, #a6adc8)',
                  }}
                >
                  {action.providerId}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer shortcut hints */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          borderTop: '1px solid var(--border-color, #313244)',
          backgroundColor: 'var(--bg-primary, #181825)',
          fontSize: '0.68rem',
          color: 'var(--text-muted, #6c7086)',
        }}
      >
        <span>
          <kbd style={kbdStyle}>Enter</kbd> Apply &nbsp;
          <kbd style={kbdStyle}>Esc</kbd> Close
        </span>
        <span>{actions[selectedIndex]?.kind || 'quickfix'}</span>
      </div>
    </div>
  );
};

function getActionIcon(kind: string, isPreferred?: boolean) {
  if (isPreferred) {
    return <Sparkles size={14} style={{ color: '#f9e2af', flexShrink: 0 }} />;
  }
  if (kind.startsWith('refactor')) {
    return <Wrench size={14} style={{ color: '#89b4fa', flexShrink: 0 }} />;
  }
  if (kind.startsWith('source')) {
    return <Package size={14} style={{ color: '#a6e3a1', flexShrink: 0 }} />;
  }
  return <Lightbulb size={14} style={{ color: '#f9e2af', flexShrink: 0 }} />;
}

const kbdStyle: React.CSSProperties = {
  padding: '1px 4px',
  borderRadius: '3px',
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  fontFamily: 'monospace',
  fontSize: '0.65rem',
  color: 'var(--text-primary, #cdd6f4)',
};
