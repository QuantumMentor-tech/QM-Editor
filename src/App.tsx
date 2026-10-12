import React from 'react';
import { RuntimeProvider } from './state/RuntimeContext';
import { ShellProvider } from './state/ShellContext';
import { WorkspaceProvider } from './state/WorkspaceContext';
import { CommandProvider } from './state/CommandContext';
import { FeedbackProvider } from './state/FeedbackContext';
import { AccessibilityProvider } from './state/AccessibilityContext';
import { LiveRegion } from './components/accessibility/LiveRegion';
import { BannerHost } from './components/feedback/BannerHost';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MainWorkspace } from './components/layout/MainWorkspace';
import { SecondaryPanel } from './components/layout/SecondaryPanel';
import { StatusBar } from './components/layout/StatusBar';
import { OverlayLayer } from './components/layout/OverlayLayer';

import { ExplorerProvider } from './state/ExplorerContext';
import { SearchProvider } from './state/SearchContext';
import { NavigationProvider } from './state/NavigationContext';
import { SourceControlProvider } from './state/SourceControlContext';
import { TerminalProvider } from './state/TerminalContext';
import { TaskProvider } from './state/TaskContext';
import { SettingsProvider } from './state/SettingsContext';

import { ContextMenuProvider } from './state/ContextMenuContext';
import { ContextMenu } from './components/commands/ContextMenu';

const AppContent: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      {/* Global Accessible Live Region for Screen Readers */}
      <LiveRegion />

      {/* 1. Header Layout Shell */}
      <Header />

      {/* Persistent System Banner Surface */}
      <BannerHost />

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

      {/* 5. Global Unified Context Menu */}
      <ContextMenu />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <RuntimeProvider>
      <AccessibilityProvider>
        <FeedbackProvider>
          <ShellProvider>
            <WorkspaceProvider>
              <ExplorerProvider>
                <SearchProvider>
                  <NavigationProvider>
                    <SourceControlProvider>
                      <TerminalProvider>
                        <TaskProvider>
                          <SettingsProvider>
                            <CommandProvider>
                              <ContextMenuProvider>
                                <AppContent />
                              </ContextMenuProvider>
                            </CommandProvider>
                          </SettingsProvider>
                        </TaskProvider>
                      </TerminalProvider>
                    </SourceControlProvider>
                  </NavigationProvider>
                </SearchProvider>
              </ExplorerProvider>
            </WorkspaceProvider>
          </ShellProvider>
        </FeedbackProvider>
      </AccessibilityProvider>
    </RuntimeProvider>
  );
};
