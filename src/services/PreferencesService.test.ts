import { describe, it, expect } from 'vitest';
import { PreferencesService, DEFAULT_PREFERENCES } from './PreferencesService';

describe('PreferencesService', () => {
  it('returns default preferences when storage is empty', () => {
    const prefs = PreferencesService.loadPreferences();
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
  });

  it('validates and loads saved preferences correctly', () => {
    PreferencesService.savePreferences({ theme: 'light', sidebarOpen: false, sidebarWidth: 300 });
    const loaded = PreferencesService.loadPreferences();
    expect(loaded.theme).toBe('light');
    expect(loaded.sidebarOpen).toBe(false);
    expect(loaded.sidebarWidth).toBe(300);
  });

  it('falls back safely when corrupted or invalid data is validated', () => {
    const validated = PreferencesService.validatePreferences('invalid string');
    expect(validated).toEqual(DEFAULT_PREFERENCES);
  });

  it('corrects out-of-bounds sidebar widths safely', () => {
    const validated = PreferencesService.validatePreferences({ sidebarWidth: 9999 });
    expect(validated.sidebarWidth).toBe(DEFAULT_PREFERENCES.sidebarWidth);
  });
});
