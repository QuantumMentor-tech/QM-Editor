import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LayoutService, globalLayoutService } from './LayoutService';
import { DEFAULT_LAYOUT_CONSTRAINTS } from './LayoutConstraints';

describe('LayoutService Unit Tests', () => {
  let service: LayoutService;

  beforeEach(() => {
    service = globalLayoutService;
    service.resetLayout();
  });

  afterEach(() => {
    service.resetLayout();
  });

  describe('Initial State & Defaults', () => {
    it('initializes with default layout values', () => {
      const state = service.getState();
      expect(state.sidebarOpen).toBe(true);
      expect(state.sidebarWidth).toBe(DEFAULT_LAYOUT_CONSTRAINTS.defaultSidebarWidth);
      expect(state.panelOpen).toBe(false);
      expect(state.panelHeight).toBe(DEFAULT_LAYOUT_CONSTRAINTS.defaultPanelHeight);
      expect(state.activePanelView).toBe('output');
      expect(state.uiDensity).toBe('comfortable');
    });
  });

  describe('Sidebar Geometry & Toggling', () => {
    it('updates sidebar width and clamps to safe constraints', () => {
      service.setSidebarWidth(320);
      expect(service.getState().sidebarWidth).toBe(320);

      service.setSidebarWidth(50); // Under min
      expect(service.getState().sidebarWidth).toBe(DEFAULT_LAYOUT_CONSTRAINTS.minSidebarWidth);

      service.setSidebarWidth(900); // Over max
      expect(service.getState().sidebarWidth).toBe(DEFAULT_LAYOUT_CONSTRAINTS.maxSidebarWidth);
    });

    it('toggles sidebar visibility', () => {
      expect(service.getState().sidebarOpen).toBe(true);
      service.toggleSidebar();
      expect(service.getState().sidebarOpen).toBe(false);
      service.toggleSidebar();
      expect(service.getState().sidebarOpen).toBe(true);
    });
  });

  describe('Panel Geometry & Toggling', () => {
    it('updates panel height and clamps to safe constraints', () => {
      service.setPanelHeight(350);
      expect(service.getState().panelHeight).toBe(350);

      service.setPanelHeight(50); // Under min
      expect(service.getState().panelHeight).toBe(DEFAULT_LAYOUT_CONSTRAINTS.minPanelHeight);
    });

    it('toggles panel open state', () => {
      expect(service.getState().panelOpen).toBe(false);
      service.togglePanel();
      expect(service.getState().panelOpen).toBe(true);
    });

    it('opens panel automatically when switching active panel view', () => {
      service.setPanelOpen(false);
      service.setActivePanelView('terminal');
      expect(service.getState().panelOpen).toBe(true);
      expect(service.getState().activePanelView).toBe('terminal');
    });
  });

  describe('UI Density System', () => {
    it('sets and toggles UI density between comfortable and compact', () => {
      expect(service.getState().uiDensity).toBe('comfortable');

      service.toggleUiDensity();
      expect(service.getState().uiDensity).toBe('compact');

      service.toggleUiDensity();
      expect(service.getState().uiDensity).toBe('comfortable');

      service.setUiDensity('compact');
      expect(service.getState().uiDensity).toBe('compact');
    });
  });

  describe('Layout Reset', () => {
    it('restores all layout dimensions and density to defaults', () => {
      service.setSidebarWidth(450);
      service.setPanelHeight(500);
      service.setUiDensity('compact');
      service.setPanelOpen(true);

      service.resetLayout();

      const state = service.getState();
      expect(state.sidebarWidth).toBe(DEFAULT_LAYOUT_CONSTRAINTS.defaultSidebarWidth);
      expect(state.panelHeight).toBe(DEFAULT_LAYOUT_CONSTRAINTS.defaultPanelHeight);
      expect(state.uiDensity).toBe('comfortable');
      expect(state.panelOpen).toBe(false);
    });
  });

  describe('Subscribers & Notifications', () => {
    it('notifies subscribers upon layout change', () => {
      const listener = vi.fn();
      const unsubscribe = service.subscribe(listener);

      service.setSidebarWidth(300);
      expect(listener).toHaveBeenCalled();

      unsubscribe();
      listener.mockClear();

      service.setSidebarWidth(320);
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
