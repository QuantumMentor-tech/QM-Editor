import { UserPreferences, ThemeMode, PanelView } from '../types';
import { logger } from '../utils/logger';

const PREFERENCES_KEY = 'qm_editor_user_preferences_v1';

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  sidebarOpen: true,
  sidebarWidth: 260,
  activePanelView: 'output',
};

const memoryStorage: Record<string, string> = {};

const getStorageItem = (key: string): string | null => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      return localStorage.getItem(key);
    }
  } catch {
    // Fallback to memoryStorage
  }
  return memoryStorage[key] || null;
};

const setStorageItem = (key: string, value: string): void => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.setItem) {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fallback to memoryStorage
  }
  memoryStorage[key] = value;
};

export class PreferencesService {
  public static loadPreferences(): UserPreferences {
    try {
      const stored = getStorageItem(PREFERENCES_KEY);
      if (!stored) return DEFAULT_PREFERENCES;

      const parsed = JSON.parse(stored);
      return this.validatePreferences(parsed);
    } catch (err) {
      logger.warn('Failed to load user preferences from storage; using defaults.', err);
      return DEFAULT_PREFERENCES;
    }
  }

  public static savePreferences(preferences: Partial<UserPreferences>): void {
    try {
      const current = this.loadPreferences();
      const updated = { ...current, ...preferences };
      setStorageItem(PREFERENCES_KEY, JSON.stringify(updated));
    } catch (err) {
      logger.warn('Failed to save user preferences to storage.', err);
    }
  }

  public static validatePreferences(data: unknown): UserPreferences {
    if (!data || typeof data !== 'object') {
      return DEFAULT_PREFERENCES;
    }

    const obj = data as Record<string, unknown>;

    const theme: ThemeMode =
      obj.theme === 'dark' || obj.theme === 'light' ? obj.theme : DEFAULT_PREFERENCES.theme;

    const sidebarOpen: boolean =
      typeof obj.sidebarOpen === 'boolean' ? obj.sidebarOpen : DEFAULT_PREFERENCES.sidebarOpen;

    const sidebarWidth: number =
      typeof obj.sidebarWidth === 'number' && obj.sidebarWidth >= 160 && obj.sidebarWidth <= 500
        ? obj.sidebarWidth
        : DEFAULT_PREFERENCES.sidebarWidth;

    const activePanelView: PanelView =
      obj.activePanelView === 'output' ||
      obj.activePanelView === 'problems' ||
      obj.activePanelView === 'terminal'
        ? obj.activePanelView
        : DEFAULT_PREFERENCES.activePanelView;

    return {
      theme,
      sidebarOpen,
      sidebarWidth,
      activePanelView,
    };
  }
}
