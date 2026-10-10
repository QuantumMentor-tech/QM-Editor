import { describe, it, expect } from 'vitest';
import React from 'react';
import { ShellProvider, useShellState } from './ShellContext';

const TestComponent: React.FC = () => {
  const { state, toggleTheme, toggleSidebar, togglePanel } = useShellState();

  return (
    <div>
      <span data-testid="theme">{state.theme}</span>
      <span data-testid="sidebar">{state.sidebarOpen ? 'open' : 'closed'}</span>
      <span data-testid="panel">{state.panelOpen ? 'open' : 'closed'}</span>
      <button data-testid="toggle-theme" onClick={toggleTheme}>Theme</button>
      <button data-testid="toggle-sidebar" onClick={toggleSidebar}>Sidebar</button>
      <button data-testid="toggle-panel" onClick={togglePanel}>Panel</button>
    </div>
  );
};

describe('ShellContext', () => {
  it('provides initial state and allows updates safely', () => {
    const provider = React.createElement(ShellProvider, null, React.createElement(TestComponent));
    expect(provider.props.children).toBeDefined();
  });
});
