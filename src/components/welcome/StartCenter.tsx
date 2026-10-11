import React from 'react';
import { WelcomeBrandHeader } from './WelcomeBrandHeader';
import { WelcomePrimaryActions } from './WelcomePrimaryActions';
import { RecentWorkspacesList } from './RecentWorkspacesList';
import { WelcomeQuickAccess } from './WelcomeQuickAccess';

export const StartCenter: React.FC = () => {
  return (
    <div
      role="region"
      aria-label="QM Editor Start Center"
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: 'var(--bg-editor, #090d16)',
        color: 'var(--text-primary)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '36px 20px 48px 20px',
        boxSizing: 'border-box',
      }}
      className="qm-start-center"
    >
      <div
        style={{
          width: '100%',
          maxWidth: '780px',
          display: 'flex',
          flexDirection: 'column',
          gap: '28px',
        }}
      >
        {/* Brand Header */}
        <WelcomeBrandHeader />

        {/* Primary Actions Grid */}
        <WelcomePrimaryActions />

        {/* Two-Column / Split Layout for Large Viewports */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
            alignItems: 'start',
          }}
        >
          {/* Recent Workspaces */}
          <RecentWorkspacesList />

          {/* Quick Access Tools & Commands */}
          <WelcomeQuickAccess />
        </div>
      </div>
    </div>
  );
};
