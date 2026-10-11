/**
 * QM Editor Layout Constraints & Clamping Logic
 * Phase 03, Step 25 — Responsive Workspace, Adaptive Layout, Panel Resizing & UI Density System
 */

import { LayoutConstraints, PersistedLayoutState, UiDensity } from './LayoutTypes';
import { PanelView } from '../../types';

export const DEFAULT_LAYOUT_CONSTRAINTS: LayoutConstraints = {
  minWindowWidth: 600,
  minWindowHeight: 400,
  minSidebarWidth: 160,
  maxSidebarWidth: 500,
  defaultSidebarWidth: 260,
  minPanelHeight: 120,
  maxPanelHeight: 600,
  defaultPanelHeight: 240,
  minEditorWidth: 300,
  minEditorHeight: 150,
};

export const LAYOUT_STATE_VERSION = 1;

/**
 * Validates a numeric dimension against min/max bounds and finite number checks
 */
export function validateLayoutDimension(
  value: unknown,
  min: number,
  max: number,
  defaultValue: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || isNaN(value)) {
    return defaultValue;
  }
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Clamps sidebar width to preserve minimum editor width in the viewport (Rule 23, Rule 6)
 */
export function clampSidebarWidth(
  requestedWidth: number,
  windowWidth: number = typeof window !== 'undefined' ? window.innerWidth : 1200,
  constraints: LayoutConstraints = DEFAULT_LAYOUT_CONSTRAINTS
): number {
  // Ensure editor retains at least minEditorWidth
  const availableMax = Math.max(constraints.minSidebarWidth, windowWidth - constraints.minEditorWidth);
  const effectiveMax = Math.min(constraints.maxSidebarWidth, availableMax);

  return validateLayoutDimension(
    requestedWidth,
    constraints.minSidebarWidth,
    effectiveMax,
    constraints.defaultSidebarWidth
  );
}

/**
 * Clamps bottom panel height to preserve minimum editor height in the viewport (Rule 23, Rule 6)
 */
export function clampPanelHeight(
  requestedHeight: number,
  windowHeight: number = typeof window !== 'undefined' ? window.innerHeight : 800,
  constraints: LayoutConstraints = DEFAULT_LAYOUT_CONSTRAINTS
): number {
  const chromeHeight = 48 + 28; // Header (~48px) + StatusBar (~28px)
  const availableMax = Math.max(constraints.minPanelHeight, windowHeight - chromeHeight - constraints.minEditorHeight);
  const effectiveMax = Math.min(constraints.maxPanelHeight, availableMax);

  return validateLayoutDimension(
    requestedHeight,
    constraints.minPanelHeight,
    effectiveMax,
    constraints.defaultPanelHeight
  );
}

/**
 * Validates a persisted layout state snapshot, discarding invalid types or out-of-version schemas
 */
export function validateLayoutState(data: unknown): PersistedLayoutState {
  if (!data || typeof data !== 'object') {
    return {
      version: LAYOUT_STATE_VERSION,
      sidebarWidth: DEFAULT_LAYOUT_CONSTRAINTS.defaultSidebarWidth,
      panelHeight: DEFAULT_LAYOUT_CONSTRAINTS.defaultPanelHeight,
      uiDensity: 'comfortable',
    };
  }

  const obj = data as Record<string, unknown>;

  // Check version
  const version = typeof obj.version === 'number' ? obj.version : LAYOUT_STATE_VERSION;

  const sidebarOpen = typeof obj.sidebarOpen === 'boolean' ? obj.sidebarOpen : true;

  const sidebarWidth = validateLayoutDimension(
    obj.sidebarWidth,
    DEFAULT_LAYOUT_CONSTRAINTS.minSidebarWidth,
    DEFAULT_LAYOUT_CONSTRAINTS.maxSidebarWidth,
    DEFAULT_LAYOUT_CONSTRAINTS.defaultSidebarWidth
  );

  const panelOpen = typeof obj.panelOpen === 'boolean' ? obj.panelOpen : false;

  const panelHeight = validateLayoutDimension(
    obj.panelHeight,
    DEFAULT_LAYOUT_CONSTRAINTS.minPanelHeight,
    DEFAULT_LAYOUT_CONSTRAINTS.maxPanelHeight,
    DEFAULT_LAYOUT_CONSTRAINTS.defaultPanelHeight
  );

  const validPanelViews: PanelView[] = ['output', 'problems', 'terminal', 'tasks'];
  const activePanelView = validPanelViews.includes(obj.activePanelView as PanelView)
    ? (obj.activePanelView as PanelView)
    : 'output';

  const uiDensity: UiDensity =
    obj.uiDensity === 'compact' || obj.uiDensity === 'comfortable'
      ? obj.uiDensity
      : 'comfortable';

  return {
    version,
    sidebarOpen,
    sidebarWidth,
    panelOpen,
    panelHeight,
    activePanelView,
    uiDensity,
  };
}
