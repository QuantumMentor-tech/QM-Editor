/**
 * QM Editor Layout & Density System Types
 * Phase 03, Step 25 — Responsive Workspace, Adaptive Layout, Panel Resizing & UI Density System
 */

import { PanelView } from '../../types';

export type UiDensity = 'comfortable' | 'compact';

export interface LayoutConstraints {
  minWindowWidth: number;
  minWindowHeight: number;
  minSidebarWidth: number;
  maxSidebarWidth: number;
  defaultSidebarWidth: number;
  minPanelHeight: number;
  maxPanelHeight: number;
  defaultPanelHeight: number;
  minEditorWidth: number;
  minEditorHeight: number;
}

export interface WindowDimensions {
  width: number;
  height: number;
}

export interface LayoutState {
  sidebarOpen: boolean;
  sidebarWidth: number;
  panelOpen: boolean;
  panelHeight: number;
  activePanelView: PanelView;
  uiDensity: UiDensity;
  windowDimensions: WindowDimensions;
  isNarrowWindow: boolean;
  isShortWindow: boolean;
}

export interface PersistedLayoutState {
  version: number;
  sidebarOpen?: boolean;
  sidebarWidth?: number;
  panelOpen?: boolean;
  panelHeight?: number;
  activePanelView?: PanelView;
  uiDensity?: UiDensity;
}
