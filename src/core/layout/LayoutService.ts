/**
 * QM Editor Centralized Layout Service
 * Phase 03, Step 25 — Responsive Workspace, Adaptive Layout, Panel Resizing & UI Density System
 */

import { LayoutState, UiDensity, PersistedLayoutState } from './LayoutTypes';
import {
  DEFAULT_LAYOUT_CONSTRAINTS,
  clampSidebarWidth,
  clampPanelHeight,
  validateLayoutState,
  LAYOUT_STATE_VERSION,
} from './LayoutConstraints';
import { PanelView } from '../../types';
import { logger } from '../../utils/logger';

const LAYOUT_STORAGE_KEY = 'qm_editor_layout_state_v1';

export class LayoutService {
  private static instance: LayoutService;
  private state: LayoutState;
  private subscribers: Set<() => void> = new Set();
  private resizeListenerAttached = false;

  private constructor() {
    const initialWindowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const initialWindowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

    const persisted = this.loadPersistedState();

    this.state = {
      sidebarOpen: persisted.sidebarOpen !== undefined ? persisted.sidebarOpen : true,
      sidebarWidth: clampSidebarWidth(persisted.sidebarWidth || DEFAULT_LAYOUT_CONSTRAINTS.defaultSidebarWidth, initialWindowWidth),
      panelOpen: persisted.panelOpen !== undefined ? persisted.panelOpen : false,
      panelHeight: clampPanelHeight(persisted.panelHeight || DEFAULT_LAYOUT_CONSTRAINTS.defaultPanelHeight, initialWindowHeight),
      activePanelView: persisted.activePanelView || 'output',
      uiDensity: persisted.uiDensity || 'comfortable',
      windowDimensions: { width: initialWindowWidth, height: initialWindowHeight },
      isNarrowWindow: initialWindowWidth < 800,
      isShortWindow: initialWindowHeight < 500,
    };

    this.applyUiDensityToDom(this.state.uiDensity);
    this.initWindowListener();
  }

  public static getInstance(): LayoutService {
    if (!LayoutService.instance) {
      LayoutService.instance = new LayoutService();
    }
    return LayoutService.instance;
  }

  public getState(): LayoutState {
    return { ...this.state };
  }

  public setSidebarWidth(width: number): void {
    const clamped = clampSidebarWidth(width, this.state.windowDimensions.width);
    if (clamped !== this.state.sidebarWidth) {
      this.state = { ...this.state, sidebarWidth: clamped };
      this.persistCurrentState();
      this.notify();
    }
  }

  public setSidebarOpen(open: boolean): void {
    if (open !== this.state.sidebarOpen) {
      this.state = { ...this.state, sidebarOpen: open };
      this.persistCurrentState();
      this.notify();
    }
  }

  public toggleSidebar(): void {
    this.setSidebarOpen(!this.state.sidebarOpen);
  }

  public setPanelHeight(height: number): void {
    const clamped = clampPanelHeight(height, this.state.windowDimensions.height);
    if (clamped !== this.state.panelHeight) {
      this.state = { ...this.state, panelHeight: clamped };
      this.persistCurrentState();
      this.notify();
    }
  }

  public setPanelOpen(open: boolean): void {
    if (open !== this.state.panelOpen) {
      this.state = { ...this.state, panelOpen: open };
      this.persistCurrentState();
      this.notify();
    }
  }

  public togglePanel(): void {
    this.setPanelOpen(!this.state.panelOpen);
  }

  public setActivePanelView(view: PanelView): void {
    this.state = { ...this.state, activePanelView: view, panelOpen: true };
    this.persistCurrentState();
    this.notify();
  }

  public setUiDensity(density: UiDensity): void {
    if (density !== this.state.uiDensity) {
      this.state = { ...this.state, uiDensity: density };
      this.applyUiDensityToDom(density);
      this.persistCurrentState();
      this.notify();
    }
  }

  public toggleUiDensity(): void {
    const nextDensity: UiDensity = this.state.uiDensity === 'comfortable' ? 'compact' : 'comfortable';
    this.setUiDensity(nextDensity);
  }

  public resetLayout(): void {
    logger.info('Resetting workspace layout to defaults');
    const width = clampSidebarWidth(DEFAULT_LAYOUT_CONSTRAINTS.defaultSidebarWidth, this.state.windowDimensions.width);
    const height = clampPanelHeight(DEFAULT_LAYOUT_CONSTRAINTS.defaultPanelHeight, this.state.windowDimensions.height);

    this.state = {
      ...this.state,
      sidebarOpen: true,
      sidebarWidth: width,
      panelOpen: false,
      panelHeight: height,
      activePanelView: 'output',
      uiDensity: 'comfortable',
    };

    this.applyUiDensityToDom('comfortable');
    this.persistCurrentState();
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(): void {
    this.subscribers.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        logger.error('LayoutService listener error', err);
      }
    });
  }

  private applyUiDensityToDom(density: UiDensity): void {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-density', density);
    }
  }

  private initWindowListener(): void {
    if (typeof window === 'undefined' || this.resizeListenerAttached) return;

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Adjust dimensions if window resize compressed available bounds
      const clampedSidebar = clampSidebarWidth(this.state.sidebarWidth, width);
      const clampedPanel = clampPanelHeight(this.state.panelHeight, height);

      this.state = {
        ...this.state,
        sidebarWidth: clampedSidebar,
        panelHeight: clampedPanel,
        windowDimensions: { width, height },
        isNarrowWindow: width < 800,
        isShortWindow: height < 500,
      };

      this.notify();
    };

    window.addEventListener('resize', handleResize);
    this.resizeListenerAttached = true;
  }

  private loadPersistedState(): PersistedLayoutState {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem) {
        const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return validateLayoutState(parsed);
        }
      }
    } catch (err) {
      logger.warn('Failed to load persisted layout state', err);
    }
    return {
      version: LAYOUT_STATE_VERSION,
      sidebarWidth: DEFAULT_LAYOUT_CONSTRAINTS.defaultSidebarWidth,
      panelHeight: DEFAULT_LAYOUT_CONSTRAINTS.defaultPanelHeight,
      uiDensity: 'comfortable',
    };
  }

  private persistCurrentState(): void {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.setItem) {
        const payload: PersistedLayoutState = {
          version: LAYOUT_STATE_VERSION,
          sidebarOpen: this.state.sidebarOpen,
          sidebarWidth: this.state.sidebarWidth,
          panelOpen: this.state.panelOpen,
          panelHeight: this.state.panelHeight,
          activePanelView: this.state.activePanelView,
          uiDensity: this.state.uiDensity,
        };
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(payload));
      }
    } catch (err) {
      logger.warn('Failed to persist layout state', err);
    }
  }
}

export const globalLayoutService = LayoutService.getInstance();
