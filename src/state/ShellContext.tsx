import React, { createContext, useContext, useState, useEffect } from 'react';
import { ShellState, ThemeMode, ShellView, SidebarView, PanelView, EditorSettings, UiDensity } from '../types';
import { PreferencesService, DEFAULT_EDITOR_SETTINGS } from '../services/PreferencesService';
import { clampSidebarWidth, clampPanelHeight, DEFAULT_LAYOUT_CONSTRAINTS } from '../core/layout/LayoutConstraints';
import { globalLayoutService } from '../core/layout/LayoutService';

export interface ShellContextType {
  state: ShellState;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setSidebarView: (view: SidebarView) => void;
  togglePanel: () => void;
  setPanelHeight: (height: number) => void;
  setActivePanelView: (view: PanelView) => void;
  setActiveView: (view: ShellView) => void;
  openWelcome: () => void;
  closeWelcome: () => void;
  setUiDensity: (density: UiDensity) => void;
  toggleUiDensity: () => void;
  resetLayout: () => void;
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
    panelHeight: initialPrefs.panelHeight || DEFAULT_LAYOUT_CONSTRAINTS.defaultPanelHeight,
    uiDensity: initialPrefs.uiDensity || 'comfortable',
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

  useEffect(() => {
    document.documentElement.setAttribute('data-density', state.uiDensity || 'comfortable');
  }, [state.uiDensity]);

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
      globalLayoutService.setSidebarOpen(nextOpen);
      return { ...prev, sidebarOpen: nextOpen };
    });
  };

  const setSidebarOpen = (sidebarOpen: boolean) => {
    setState((prev) => ({ ...prev, sidebarOpen }));
    PreferencesService.savePreferences({ sidebarOpen });
    globalLayoutService.setSidebarOpen(sidebarOpen);
  };

  const setSidebarWidth = (sidebarWidth: number) => {
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const clamped = clampSidebarWidth(sidebarWidth, windowWidth);
    setState((prev) => ({ ...prev, sidebarWidth: clamped }));
    PreferencesService.savePreferences({ sidebarWidth: clamped });
    globalLayoutService.setSidebarWidth(clamped);
  };

  const setSidebarView = (sidebarView: SidebarView) => {
    setState((prev) => ({ ...prev, sidebarView, sidebarOpen: true }));
    globalLayoutService.setSidebarOpen(true);
  };

  const togglePanel = () => {
    setState((prev) => {
      const nextOpen = !prev.panelOpen;
      globalLayoutService.setPanelOpen(nextOpen);
      return { ...prev, panelOpen: nextOpen };
    });
  };

  const setPanelHeight = (panelHeight: number) => {
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const clamped = clampPanelHeight(panelHeight, windowHeight);
    setState((prev) => ({ ...prev, panelHeight: clamped }));
    PreferencesService.savePreferences({ panelHeight: clamped });
    globalLayoutService.setPanelHeight(clamped);
  };

  const setActivePanelView = (activePanelView: PanelView) => {
    setState((prev) => ({ ...prev, activePanelView, panelOpen: true }));
    PreferencesService.savePreferences({ activePanelView });
    globalLayoutService.setActivePanelView(activePanelView);
  };

  const setActiveView = (activeView: ShellView) => {
    setState((prev) => ({ ...prev, activeView }));
  };

  const openWelcome = () => {
    setState((prev) => ({ ...prev, activeView: 'welcome' }));
  };

  const closeWelcome = () => {
    setState((prev) => ({ ...prev, activeView: 'editor' }));
  };

  const setUiDensity = (uiDensity: UiDensity) => {
    setState((prev) => ({ ...prev, uiDensity }));
    PreferencesService.savePreferences({ uiDensity });
    globalLayoutService.setUiDensity(uiDensity);
  };

  const toggleUiDensity = () => {
    const nextDensity: UiDensity = state.uiDensity === 'comfortable' ? 'compact' : 'comfortable';
    setUiDensity(nextDensity);
  };

  const resetLayout = () => {
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const defaultWidth = clampSidebarWidth(DEFAULT_LAYOUT_CONSTRAINTS.defaultSidebarWidth, windowWidth);
    const defaultHeight = clampPanelHeight(DEFAULT_LAYOUT_CONSTRAINTS.defaultPanelHeight, windowHeight);

    globalLayoutService.resetLayout();
    setState((prev) => ({
      ...prev,
      sidebarOpen: true,
      sidebarWidth: defaultWidth,
      panelOpen: false,
      panelHeight: defaultHeight,
      uiDensity: 'comfortable',
    }));
    PreferencesService.savePreferences({
      sidebarOpen: true,
      sidebarWidth: defaultWidth,
      panelHeight: defaultHeight,
      uiDensity: 'comfortable',
    });
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
        setPanelHeight,
        setActivePanelView,
        setActiveView,
        openWelcome,
        closeWelcome,
        setUiDensity,
        toggleUiDensity,
        resetLayout,
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
