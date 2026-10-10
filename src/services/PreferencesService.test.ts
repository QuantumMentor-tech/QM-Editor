import { describe, it, expect } from 'vitest';
import { PreferencesService, DEFAULT_PREFERENCES, DEFAULT_EDITOR_SETTINGS } from './PreferencesService';

describe('PreferencesService', () => {
  it('returns default preferences when storage is empty', () => {
    const prefs = PreferencesService.loadPreferences();
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
    expect(prefs.editor).toEqual(DEFAULT_EDITOR_SETTINGS);
  });

  it('validates and loads saved preferences correctly', () => {
    PreferencesService.savePreferences({
      theme: 'light',
      sidebarOpen: false,
      sidebarWidth: 300,
      editor: { fontSize: 18, wordWrap: 'off', tabSize: 4 } as any,
    });
    const loaded = PreferencesService.loadPreferences();
    expect(loaded.theme).toBe('light');
    expect(loaded.sidebarOpen).toBe(false);
    expect(loaded.sidebarWidth).toBe(300);
    expect(loaded.editor.fontSize).toBe(18);
    expect(loaded.editor.wordWrap).toBe('off');
    expect(loaded.editor.tabSize).toBe(4);
  });

  it('falls back safely when corrupted or invalid data is validated', () => {
    const validated = PreferencesService.validatePreferences('invalid string');
    expect(validated).toEqual(DEFAULT_PREFERENCES);
  });

  it('corrects out-of-bounds sidebar widths and font sizes safely', () => {
    const validated = PreferencesService.validatePreferences({
      sidebarWidth: 9999,
      editor: { fontSize: 999, tabSize: -5 },
    });
    expect(validated.sidebarWidth).toBe(DEFAULT_PREFERENCES.sidebarWidth);
    expect(validated.editor.fontSize).toBe(DEFAULT_EDITOR_SETTINGS.fontSize);
    expect(validated.editor.tabSize).toBe(DEFAULT_EDITOR_SETTINGS.tabSize);
  });
});
