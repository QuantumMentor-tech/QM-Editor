/**
 * QM Editor Accessible Signature Help Widget
 * Phase 04, Step 43 — Hover Information, Signature Help & Contextual Language Intelligence
 */

import React, { useState } from 'react';
import {
  SignatureHelpResult,
  SignatureInformation,
  ParameterInformation,
  MarkupContent,
} from '../../core/language-intelligence/LanguageIntelligenceTypes';
import { renderMarkdownToSafeHtml } from '../../core/language-intelligence/ContentSanitizer';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

export interface SignatureHelpWidgetProps {
  result: SignatureHelpResult;
  position: { x: number; y: number };
  onClose: () => void;
}

function getDocumentationText(doc?: string | MarkupContent): string {
  if (!doc) return '';
  if (typeof doc === 'string') return doc;
  return doc.value || '';
}

export const SignatureHelpWidget: React.FC<SignatureHelpWidgetProps> = ({
  result,
  position,
  onClose,
}) => {
  const [selectedSigIndex, setSelectedSigIndex] = useState(result.activeSignature);

  const signatures = result.signatures;
  const currentSig: SignatureInformation | undefined = signatures[selectedSigIndex] || signatures[0];

  if (!currentSig) return null;

  const totalSigs = signatures.length;
  const activeParamIndex =
    selectedSigIndex === result.activeSignature
      ? result.activeParameter
      : currentSig.activeParameter ?? 0;

  const activeParam: ParameterInformation | undefined = currentSig.parameters?.[activeParamIndex];

  const handlePrevSig = () => {
    setSelectedSigIndex((prev) => (prev > 0 ? prev - 1 : totalSigs - 1));
  };

  const handleNextSig = () => {
    setSelectedSigIndex((prev) => (prev < totalSigs - 1 ? prev + 1 : 0));
  };

  // Render signature label with active parameter highlighted
  const renderSignatureLabel = () => {
    const label = currentSig.label;
    if (!activeParam || !currentSig.parameters || currentSig.parameters.length === 0) {
      return <span>{label}</span>;
    }

    if (Array.isArray(activeParam.label)) {
      const [from, to] = activeParam.label;
      const before = label.slice(0, from);
      const target = label.slice(from, to);
      const after = label.slice(to);
      return (
        <span>
          {before}
          <strong style={{ color: 'var(--qm-accent, #38bdf8)', textDecoration: 'underline' }}>
            {target}
          </strong>
          {after}
        </span>
      );
    }

    if (typeof activeParam.label === 'string') {
      const paramStr = activeParam.label;
      const idx = label.indexOf(paramStr);
      if (idx !== -1) {
        const before = label.slice(0, idx);
        const target = label.slice(idx, idx + paramStr.length);
        const after = label.slice(idx + paramStr.length);
        return (
          <span>
            {before}
            <strong style={{ color: 'var(--qm-accent, #38bdf8)', textDecoration: 'underline' }}>
              {target}
            </strong>
            {after}
          </span>
        );
      }
    }

    return <span>{label}</span>;
  };

  const paramDocHtml = activeParam
    ? renderMarkdownToSafeHtml(getDocumentationText(activeParam.documentation))
    : '';
  const sigDocHtml = renderMarkdownToSafeHtml(getDocumentationText(currentSig.documentation));

  // Position above cursor if space permits, otherwise below
  const widgetHeight = 140;
  const topPos = position.y - widgetHeight - 10 > 10 ? position.y - widgetHeight - 10 : position.y + 24;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: `${Math.max(10, Math.min(position.x, window.innerWidth - 450))}px`,
    top: `${Math.max(10, Math.min(topPos, window.innerHeight - 200))}px`,
    width: '440px',
    maxWidth: '90vw',
    backgroundColor: 'var(--qm-bg-secondary, #1e293b)',
    color: 'var(--qm-text-primary, #f8fafc)',
    border: '1px solid var(--qm-border, #334155)',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
    zIndex: 1000,
    fontSize: '12px',
    lineHeight: '1.4',
    fontFamily: 'var(--qm-font-family, monospace)',
    padding: '8px 12px',
  };

  return (
    <div
      role="region"
      aria-label="Signature Help"
      style={style}
      className="qm-signature-help-widget"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        } else if (e.key === 'ArrowUp') {
          e.stopPropagation();
          e.preventDefault();
          handlePrevSig();
        } else if (e.key === 'ArrowDown') {
          e.stopPropagation();
          e.preventDefault();
          handleNextSig();
        }
      }}
    >
      {/* Header with Overload Navigator & Close Button */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
          {totalSigs > 1 && (
            <span style={{ fontSize: '11px', color: 'var(--qm-text-secondary, #94a3b8)' }}>
              ({selectedSigIndex + 1} of {totalSigs})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {totalSigs > 1 && (
            <>
              <button
                onClick={handlePrevSig}
                aria-label="Previous overload"
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
                <ChevronUp size={14} />
              </button>
              <button
                onClick={handleNextSig}
                aria-label="Next overload"
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
                <ChevronDown size={14} />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            aria-label="Close signature help"
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
      </div>

      {/* Signature Label with active parameter highlighted */}
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: '13px',
          fontWeight: 500,
          marginBottom: '6px',
          wordBreak: 'break-word',
        }}
      >
        {renderSignatureLabel()}
      </div>

      {/* Active Parameter Documentation */}
      {paramDocHtml && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--qm-text-primary, #f8fafc)',
            marginBottom: '4px',
          }}
          dangerouslySetInnerHTML={{ __html: paramDocHtml }}
        />
      )}

      {/* Signature Documentation */}
      {sigDocHtml && !paramDocHtml && (
        <div
          style={{
            fontSize: '11px',
            color: 'var(--qm-text-secondary, #94a3b8)',
          }}
          dangerouslySetInnerHTML={{ __html: sigDocHtml }}
        />
      )}
    </div>
  );
};
