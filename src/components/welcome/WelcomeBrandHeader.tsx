import React from 'react';
import { Badge } from '../common/Badge';

export const WelcomeBrandHeader: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '8px',
        paddingBottom: '24px',
        borderBottom: '1px solid var(--border-color)',
        width: '100%',
        boxSizing: 'border-box',
      }}
      className="qm-welcome-brand"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
        <img
          src="/QM Editor Logo.png"
          alt="QM Editor Logo"
          width={52}
          height={52}
          style={{ objectFit: 'contain' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '1.65rem',
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: 'var(--text-primary)',
            }}
          >
            QM Editor
          </h1>
          <Badge variant="accent" size="sm">
            v0.1.0
          </Badge>
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: '0.95rem',
          fontWeight: 500,
          color: 'var(--text-accent, #38bdf8)',
        }}
      >
        High-Performance Developer Code Editor
      </p>

      <p
        style={{
          margin: 0,
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          maxWidth: '560px',
          lineHeight: 1.45,
        }}
      >
        A modern, keyboard-first desktop development environment built with React, TypeScript,
        and CodeMirror 6.
      </p>
    </div>
  );
};
