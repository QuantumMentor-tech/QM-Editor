import React, { createContext, useContext, useState, useEffect } from 'react';
import { ShellState, ThemeMode, ShellView, SidebarView, PanelView, EditorSettings } from '../types';
import { PreferencesService, DEFAULT_EDITOR_SETTINGS } from '../services/PreferencesService';

export interface ShellContextType {
  state: ShellState;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSidebarView: (view: SidebarView) => void;
  togglePanel: () => void;
  setActivePanelView: (view: PanelView) => void;
  setActiveView: (view: ShellView) => void;
  openDialog: (title: string, content: React.ReactNode) => void;
  closeDialog: () => void;
  updateEditorSettings: (settings: Partial<EditorSettings>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  toggleWordWrap: () => void;
  toggleLineNumbers: () => void;
  toggleWhitespace: () => void;
  toggleFolding: () => void;
}

const ShellContext = createContext<ShellContextType | undefined>(undefined);

export const ShellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialPrefs = PreferencesService.loadPreferences();

  const [state, setState] = useState<ShellState>({
    theme: initialPrefs.theme,
    sidebarOpen: initialPrefs.sidebarOpen,
    sidebarWidth: initialPrefs.sidebarWidth,
    sidebarView: 'explorer',
    panelOpen: false,
    activePanelView: initialPrefs.activePanelView,
    activeView: 'editor',
    dialogOpen: false,
    dialogTitle: '',
    dialogContent: null,
    editorSettings: initialPrefs.editor || DEFAULT_EDITOR_SETTINGS,
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

  const setSidebarView = (sidebarView: SidebarView) => {
    setState((prev) => ({ ...prev, sidebarView, sidebarOpen: true }));
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

  const updateEditorSettings = (partialSettings: Partial<EditorSettings>) => {
    setState((prev) => {
      const updatedEditor = PreferencesService.validateEditorSettings({
        ...prev.editorSettings,
        ...partialSettings,
      });
      PreferencesService.savePreferences({ editor: updatedEditor });
      return { ...prev, editorSettings: updatedEditor };
    });
  };

  const zoomIn = () => {
    updateEditorSettings({ fontSize: Math.min(32, state.editorSettings.fontSize + 1) });
  };

  const zoomOut = () => {
    updateEditorSettings({ fontSize: Math.max(8, state.editorSettings.fontSize - 1) });
  };

  const zoomReset = () => {
    updateEditorSettings({ fontSize: DEFAULT_EDITOR_SETTINGS.fontSize });
  };

  const toggleWordWrap = () => {
    updateEditorSettings({ wordWrap: state.editorSettings.wordWrap === 'on' ? 'off' : 'on' });
  };

  const toggleLineNumbers = () => {
    updateEditorSettings({ lineNumbers: !state.editorSettings.lineNumbers });
  };

  const toggleWhitespace = () => {
    const nextMode = state.editorSettings.whitespace === 'none' ? 'all' : 'none';
    updateEditorSettings({ whitespace: nextMode });
  };

  const toggleFolding = () => {
    updateEditorSettings({ folding: !state.editorSettings.folding });
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
        setSidebarView,
        togglePanel,
        setActivePanelView,
        setActiveView,
        openDialog,
        closeDialog,
        updateEditorSettings,
        zoomIn,
        zoomOut,
        zoomReset,
        toggleWordWrap,
        toggleLineNumbers,
        toggleWhitespace,
        toggleFolding,
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
