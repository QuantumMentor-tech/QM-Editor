/**
 * QM Editor Accessible Hover Widget
 * Phase 04, Step 43 — Hover Information, Signature Help & Contextual Language Intelligence
 */

import React, { useMemo } from 'react';
import { HoverResult } from '../../core/language-intelligence/LanguageIntelligenceTypes';
import { renderHoverContent } from '../../core/language-intelligence/ContentSanitizer';
import { globalNavigationCoordinator } from '../../core/navigation';
import { ExternalLink, X } from 'lucide-react';

export interface HoverWidgetProps {
  result: HoverResult;
  position: { x: number; y: number };
  onClose: () => void;
}

export const HoverWidget: React.FC<HoverWidgetProps> = ({
  result,
  position,
  onClose,
}) => {
  const sanitizedHtml = useMemo(() => {
    return renderHoverContent(result.contents);
  }, [result.contents]);

  const handleNavigate = async () => {
    if (result.location) {
      onClose();
      await globalNavigationCoordinator.navigateToLocation(result.location);
    }
  };

  // Clamp popup coordinates to stay in viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: `${Math.max(10, Math.min(position.x, window.innerWidth - 420))}px`,
    top: `${Math.max(10, Math.min(position.y, window.innerHeight - 300))}px`,
    width: '400px',
    maxWidth: '90vw',
    maxHeight: '320px',
    overflowY: 'auto',
    backgroundColor: 'var(--qm-bg-secondary, #1e293b)',
    color: 'var(--qm-text-primary, #f8fafc)',
    border: '1px solid var(--qm-border, #334155)',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
    zIndex: 1000,
    fontSize: '13px',
    lineHeight: '1.5',
    fontFamily: 'var(--qm-font-family, monospace)',
    padding: '8px 12px',
  };

  return (
    <div
      role="tooltip"
      aria-live="polite"
      style={style}
      className="qm-hover-widget"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
          borderBottom: '1px solid var(--qm-border, #334155)',
          paddingBottom: '4px',
        }}
      >
        <span
          style={{
            fontSize: '10px',
            textTransform: 'uppercase',
            color: 'var(--qm-text-secondary, #94a3b8)',
            letterSpacing: '0.05em',
          }}
        >
          {result.providerId}
        </span>
        <button
          onClick={onClose}
          aria-label="Close hover tooltip"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--qm-text-secondary, #94a3b8)',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Rendered & Sanitized HTML Content */}
      <div
        className="qm-hover-body"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />

      {/* Optional Navigation Target */}
      {result.location && (
        <div
          style={{
            marginTop: '8px',
            paddingTop: '6px',
            borderTop: '1px solid var(--qm-border, #334155)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          <button
            onClick={handleNavigate}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--qm-accent, #38bdf8)',
              fontSize: '11px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <ExternalLink size={12} />
            <span>Go to Definition ({result.location.uri.split('/').pop()}:{result.location.range?.startLine || 1})</span>
          </button>
        </div>
      )}
    </div>
  );
};
