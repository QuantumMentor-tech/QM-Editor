import { UserPreferences, ThemeMode, PanelView, EditorSettings, WordWrapMode, WhitespaceMode } from '../types';
import { logger } from '../utils/logger';

const PREFERENCES_KEY = 'qm_editor_user_preferences_v1';

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
  lineNumbers: true,
  wordWrap: 'on',
  tabSize: 2,
  insertSpaces: true,
  bracketMatching: true,
  autoClosingBrackets: true,
  highlightActiveLine: true,
  whitespace: 'none',
  folding: true,
  minimap: false,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  sidebarOpen: true,
  sidebarWidth: 260,
  activePanelView: 'output',
  panelHeight: 240,
  uiDensity: 'comfortable',
  editor: DEFAULT_EDITOR_SETTINGS,
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
      const updatedEditor = preferences.editor
        ? { ...current.editor, ...preferences.editor }
        : current.editor;
      const updated: UserPreferences = {
        ...current,
        ...preferences,
        editor: updatedEditor,
      };
      setStorageItem(PREFERENCES_KEY, JSON.stringify(updated));
    } catch (err) {
      logger.warn('Failed to save user preferences to storage.', err);
    }
  }

  public static validateEditorSettings(data: unknown): EditorSettings {
    if (!data || typeof data !== 'object') {
      return DEFAULT_EDITOR_SETTINGS;
    }

    const obj = data as Record<string, unknown>;

    const fontSize =
      typeof obj.fontSize === 'number' && obj.fontSize >= 8 && obj.fontSize <= 32
        ? Math.round(obj.fontSize)
        : DEFAULT_EDITOR_SETTINGS.fontSize;

    const fontFamily =
      typeof obj.fontFamily === 'string' && obj.fontFamily.trim().length > 0
        ? obj.fontFamily.trim()
        : DEFAULT_EDITOR_SETTINGS.fontFamily;

    const lineNumbers =
      typeof obj.lineNumbers === 'boolean'
        ? obj.lineNumbers
        : DEFAULT_EDITOR_SETTINGS.lineNumbers;

    const wordWrap: WordWrapMode =
      obj.wordWrap === 'off' || obj.wordWrap === 'on'
        ? obj.wordWrap
        : DEFAULT_EDITOR_SETTINGS.wordWrap;

    const tabSize =
      typeof obj.tabSize === 'number' && obj.tabSize >= 1 && obj.tabSize <= 16
        ? Math.round(obj.tabSize)
        : DEFAULT_EDITOR_SETTINGS.tabSize;

    const insertSpaces =
      typeof obj.insertSpaces === 'boolean'
        ? obj.insertSpaces
        : DEFAULT_EDITOR_SETTINGS.insertSpaces;

    const bracketMatching =
      typeof obj.bracketMatching === 'boolean'
        ? obj.bracketMatching
        : DEFAULT_EDITOR_SETTINGS.bracketMatching;

    const autoClosingBrackets =
      typeof obj.autoClosingBrackets === 'boolean'
        ? obj.autoClosingBrackets
        : DEFAULT_EDITOR_SETTINGS.autoClosingBrackets;

    const highlightActiveLine =
      typeof obj.highlightActiveLine === 'boolean'
        ? obj.highlightActiveLine
        : DEFAULT_EDITOR_SETTINGS.highlightActiveLine;

    const whitespace: WhitespaceMode =
      obj.whitespace === 'none' || obj.whitespace === 'all' || obj.whitespace === 'trailing'
        ? obj.whitespace
        : DEFAULT_EDITOR_SETTINGS.whitespace;

    const folding =
      typeof obj.folding === 'boolean' ? obj.folding : DEFAULT_EDITOR_SETTINGS.folding;

    const minimap =
      typeof obj.minimap === 'boolean' ? obj.minimap : DEFAULT_EDITOR_SETTINGS.minimap;

    return {
      fontSize,
      fontFamily,
      lineNumbers,
      wordWrap,
      tabSize,
      insertSpaces,
      bracketMatching,
      autoClosingBrackets,
      highlightActiveLine,
      whitespace,
      folding,
      minimap,
    };
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
      obj.activePanelView === 'terminal' ||
      obj.activePanelView === 'tasks'
        ? obj.activePanelView
        : DEFAULT_PREFERENCES.activePanelView;

    const panelHeight: number =
      typeof obj.panelHeight === 'number' && obj.panelHeight >= 120 && obj.panelHeight <= 600
        ? Math.round(obj.panelHeight)
        : DEFAULT_PREFERENCES.panelHeight || 240;

    const uiDensity =
      obj.uiDensity === 'compact' || obj.uiDensity === 'comfortable'
        ? obj.uiDensity
        : DEFAULT_PREFERENCES.uiDensity || 'comfortable';

    const editor = this.validateEditorSettings(obj.editor);

    return {
      theme,
      sidebarOpen,
      sidebarWidth,
      activePanelView,
      panelHeight,
      uiDensity,
      editor,
    };
  }
}
