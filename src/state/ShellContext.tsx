import React, { createContext, useContext, useState, useEffect } from 'react';
import { ShellState, ThemeMode, ShellView, PanelView } from '../types';
import { PreferencesService } from '../services/PreferencesService';

export interface ShellContextType {
  state: ShellState;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  togglePanel: () => void;
  setActivePanelView: (view: PanelView) => void;
  setActiveView: (view: ShellView) => void;
  openDialog: (title: string, content: React.ReactNode) => void;
  closeDialog: () => void;
}

const ShellContext = createContext<ShellContextType | undefined>(undefined);

export const ShellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialPrefs = PreferencesService.loadPreferences();

  const [state, setState] = useState<ShellState>({
    theme: initialPrefs.theme,
    sidebarOpen: initialPrefs.sidebarOpen,
    sidebarWidth: initialPrefs.sidebarWidth,
    panelOpen: false,
    activePanelView: initialPrefs.activePanelView,
    activeView: 'editor',
    dialogOpen: false,
    dialogTitle: '',
    dialogContent: null,
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  const setTheme = (theme: ThemeMode) => {
    setState((prev) => ({ ...prev, theme }));
    PreferencesService.savePreferences({ theme });
  };

  const toggleTheme = () => {
    const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const toggleSidebar = () => {
    setState((prev) => {
      const nextOpen = !prev.sidebarOpen;
      PreferencesService.savePreferences({ sidebarOpen: nextOpen });
      return { ...prev, sidebarOpen: nextOpen };
    });
  };

  const setSidebarOpen = (sidebarOpen: boolean) => {
    setState((prev) => ({ ...prev, sidebarOpen }));
    PreferencesService.savePreferences({ sidebarOpen });
  };

  const setSidebarWidth = (sidebarWidth: number) => {
    const clamped = Math.max(160, Math.min(500, sidebarWidth));
    setState((prev) => ({ ...prev, sidebarWidth: clamped }));
    PreferencesService.savePreferences({ sidebarWidth: clamped });
  };

  const togglePanel = () => {
    setState((prev) => ({ ...prev, panelOpen: !prev.panelOpen }));
  };

  const setActivePanelView = (activePanelView: PanelView) => {
    setState((prev) => ({ ...prev, activePanelView, panelOpen: true }));
    PreferencesService.savePreferences({ activePanelView });
  };

  const setActiveView = (activeView: ShellView) => {
    setState((prev) => ({ ...prev, activeView }));
  };

  const openDialog = (dialogTitle: string, dialogContent: React.ReactNode) => {
    setState((prev) => ({
      ...prev,
      dialogOpen: true,
      dialogTitle,
      dialogContent,
    }));
  };

  const closeDialog = () => {
    setState((prev) => ({
      ...prev,
      dialogOpen: false,
      dialogTitle: '',
      dialogContent: null,
    }));
  };

  return (
    <ShellContext.Provider
      value={{
        state,
        setTheme,
        toggleTheme,
        toggleSidebar,
        setSidebarOpen,
        setSidebarWidth,
        togglePanel,
        setActivePanelView,
        setActiveView,
        openDialog,
        closeDialog,
      }}
    >
      {children}
    </ShellContext.Provider>
  );
};

export const useShellState = (): ShellContextType => {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShellState must be used within a ShellProvider');
  }
  return context;
};
