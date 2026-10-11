import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LAYOUT_CONSTRAINTS,
  validateLayoutDimension,
  clampSidebarWidth,
  clampPanelHeight,
  validateLayoutState,
  LAYOUT_STATE_VERSION,
} from './LayoutConstraints';

describe('LayoutConstraints Unit Tests', () => {
  describe('Dimension Validation', () => {
    it('returns valid number within bounds', () => {
      expect(validateLayoutDimension(250, 160, 500, 260)).toBe(250);
    });

    it('clamps numbers exceeding bounds', () => {
      expect(validateLayoutDimension(100, 160, 500, 260)).toBe(160);
      expect(validateLayoutDimension(700, 160, 500, 260)).toBe(500);
    });

    it('falls back to default on NaN, Infinity, negative, or invalid types', () => {
      expect(validateLayoutDimension(NaN, 160, 500, 260)).toBe(260);
      expect(validateLayoutDimension(Infinity, 160, 500, 260)).toBe(260);
      expect(validateLayoutDimension('250', 160, 500, 260)).toBe(260);
      expect(validateLayoutDimension(null, 160, 500, 260)).toBe(260);
    });
  });

  describe('Sidebar Width Clamping & Editor Prioritization (Rule 23)', () => {
    it('clamps to max constraint when window is wide', () => {
      const width = clampSidebarWidth(350, 1400);
      expect(width).toBe(350);
    });

    it('limits sidebar width to preserve at least 300px for editor in narrow windows', () => {
      // If window is 400px wide, max sidebar = 400 - 300 = 100, but minSidebar is 160
      const width = clampSidebarWidth(260, 420);
      expect(width).toBe(DEFAULT_LAYOUT_CONSTRAINTS.minSidebarWidth);
    });

    it('enforces minSidebarWidth (160px)', () => {
      expect(clampSidebarWidth(50, 1200)).toBe(160);
    });
  });

  describe('Panel Height Clamping & Editor Prioritization (Rule 23)', () => {
    it('clamps to max constraint when window height is sufficient', () => {
      const height = clampPanelHeight(300, 900);
      expect(height).toBe(300);
    });

    it('limits panel height to preserve at least 150px for editor in short windows', () => {
      // Window height = 400px, chrome = 76px, editor = 150px => remaining max ~ 174px
      const height = clampPanelHeight(350, 400);
      expect(height).toBeLessThanOrEqual(174);
      expect(height).toBeGreaterThanOrEqual(DEFAULT_LAYOUT_CONSTRAINTS.minPanelHeight);
    });

    it('enforces minPanelHeight (120px)', () => {
      expect(clampPanelHeight(50, 800)).toBe(120);
    });
  });

  describe('Persisted Layout State Validation', () => {
    it('validates a complete persisted layout object cleanly', () => {
      const input = {
        version: 1,
        sidebarOpen: true,
        sidebarWidth: 280,
        panelOpen: true,
        panelHeight: 320,
        activePanelView: 'terminal',
        uiDensity: 'compact',
      };

      const result = validateLayoutState(input);
      expect(result.version).toBe(LAYOUT_STATE_VERSION);
      expect(result.sidebarWidth).toBe(280);
      expect(result.panelHeight).toBe(320);
      expect(result.activePanelView).toBe('terminal');
      expect(result.uiDensity).toBe('compact');
    });

    it('clamps corrupted dimensions and falls back to safe defaults', () => {
      const corrupted = {
        version: 1,
        sidebarWidth: -999,
        panelHeight: 99999,
        activePanelView: 'invalid-panel',
        uiDensity: 'extra-huge',
      };

      const result = validateLayoutState(corrupted);
      expect(result.sidebarWidth).toBe(DEFAULT_LAYOUT_CONSTRAINTS.minSidebarWidth);
      expect(result.panelHeight).toBe(DEFAULT_LAYOUT_CONSTRAINTS.maxPanelHeight);
      expect(result.activePanelView).toBe('output');
      expect(result.uiDensity).toBe('comfortable');
    });

    it('handles null or non-object input gracefully', () => {
      const result = validateLayoutState(null);
      expect(result.version).toBe(LAYOUT_STATE_VERSION);
      expect(result.sidebarWidth).toBe(DEFAULT_LAYOUT_CONSTRAINTS.defaultSidebarWidth);
      expect(result.panelHeight).toBe(DEFAULT_LAYOUT_CONSTRAINTS.defaultPanelHeight);
      expect(result.uiDensity).toBe('comfortable');
    });
  });
});
