import React from 'react';
import { ShellProvider } from './state/ShellContext';
import { WorkspaceProvider } from './state/WorkspaceContext';
import { CommandProvider } from './state/CommandContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MainWorkspace } from './components/layout/MainWorkspace';
import { SecondaryPanel } from './components/layout/SecondaryPanel';
import { StatusBar } from './components/layout/StatusBar';
import { OverlayLayer } from './components/layout/OverlayLayer';

import { ExplorerProvider } from './state/ExplorerContext';
import { SearchProvider } from './state/SearchContext';

const AppContent: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      {/* 1. Header Layout Shell */}
      <Header />

      {/* 2. Main Workspace Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar Explorer */}
        <Sidebar />

        {/* Central Workspace + Secondary Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <MainWorkspace />
          <SecondaryPanel />
        </div>
      </div>

      {/* 3. Status Bar Footer */}
      <StatusBar />

      {/* 4. Global Overlay Layer */}
      <OverlayLayer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ShellProvider>
      <WorkspaceProvider>
        <ExplorerProvider>
          <SearchProvider>
            <CommandProvider>
              <AppContent />
            </CommandProvider>
          </SearchProvider>
        </ExplorerProvider>
      </WorkspaceProvider>
    </ShellProvider>
  );
};
