/**
 * QM Editor Settings Storage & Migration Engine
 * Phase 03, Step 21 — Unified Settings, Preferences & Configuration System
 */

import { logger } from '../../utils/logger';

const UNIFIED_USER_SETTINGS_KEY = 'qm_editor_unified_settings_v1';
const WORKSPACE_SETTINGS_PREFIX = 'qm_editor_workspace_settings_';
const LEGACY_PREFERENCES_KEY = 'qm_editor_user_preferences_v1';

export class SettingsStorage {
  private static memoryStore: Record<string, string> = {};

  public static getRawItem(key: string): string | null {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem) {
        return localStorage.getItem(key);
      }
    } catch {
      // In-memory fallback
    }
    return this.memoryStore[key] || null;
  }

  public static setRawItem(key: string, value: string): void {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.setItem) {
        localStorage.setItem(key, value);
        return;
      }
    } catch {
      // In-memory fallback
    }
    this.memoryStore[key] = value;
  }

  public static removeRawItem(key: string): void {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.removeItem) {
        localStorage.removeItem(key);
        return;
      }
    } catch {
      // In-memory fallback
    }
    delete this.memoryStore[key];
  }

  /**
   * Loads user-scoped settings with backward-compatible migration from legacy preferences
   */
  public static loadUserSettings(): Record<string, any> {
    try {
      const stored = this.getRawItem(UNIFIED_USER_SETTINGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }

      // Check legacy preferences migration
      const legacy = this.getRawItem(LEGACY_PREFERENCES_KEY);
      if (legacy) {
        logger.info('Migrating legacy user preferences to unified settings format');
        const parsedLegacy = JSON.parse(legacy);
        const migrated = this.migrateLegacyPreferences(parsedLegacy);
        this.saveUserSettings(migrated);
        return migrated;
      }

      return {};
    } catch (err) {
      logger.error('Failed to parse stored user settings; attempting corruption recovery.', err);
      // Backup corrupted string safely
      const corrupted = this.getRawItem(UNIFIED_USER_SETTINGS_KEY);
      if (corrupted) {
        this.setRawItem(`${UNIFIED_USER_SETTINGS_KEY}.corrupted.${Date.now()}`, corrupted);
      }
      return {};
    }
  }

  public static saveUserSettings(settings: Record<string, any>): void {
    try {
      this.setRawItem(UNIFIED_USER_SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
      logger.error('Failed to save user settings to storage.', err);
    }
  }

  public static loadWorkspaceSettings(workspaceId: string): Record<string, any> {
    try {
      const key = `${WORKSPACE_SETTINGS_PREFIX}${workspaceId}`;
      const stored = this.getRawItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
      return {};
    } catch (err) {
      logger.error(`Failed to load workspace settings for "${workspaceId}".`, err);
      return {};
    }
  }

  public static saveWorkspaceSettings(workspaceId: string, settings: Record<string, any>): void {
    try {
      const key = `${WORKSPACE_SETTINGS_PREFIX}${workspaceId}`;
      this.setRawItem(key, JSON.stringify(settings));
    } catch (err) {
      logger.error(`Failed to save workspace settings for "${workspaceId}".`, err);
    }
  }

  private static migrateLegacyPreferences(legacy: any): Record<string, any> {
    const migrated: Record<string, any> = {};

    if (legacy.theme) migrated['appearance.theme'] = legacy.theme;
    if (legacy.sidebarWidth) migrated['appearance.sidebarWidth'] = legacy.sidebarWidth;
    if (legacy.activePanelView) migrated['appearance.activePanelView'] = legacy.activePanelView;

    if (legacy.editor && typeof legacy.editor === 'object') {
      const ed = legacy.editor;
      if (ed.fontSize) migrated['editor.fontSize'] = ed.fontSize;
      if (ed.fontFamily) migrated['editor.fontFamily'] = ed.fontFamily;
      if (ed.tabSize) migrated['editor.tabSize'] = ed.tabSize;
      if (typeof ed.insertSpaces === 'boolean') migrated['editor.insertSpaces'] = ed.insertSpaces;
      if (ed.wordWrap) migrated['editor.wordWrap'] = ed.wordWrap;
      if (typeof ed.lineNumbers === 'boolean') migrated['editor.lineNumbers'] = ed.lineNumbers;
      if (typeof ed.bracketMatching === 'boolean') migrated['editor.bracketMatching'] = ed.bracketMatching;
      if (typeof ed.autoClosingBrackets === 'boolean') migrated['editor.autoClosingBrackets'] = ed.autoClosingBrackets;
      if (typeof ed.highlightActiveLine === 'boolean') migrated['editor.highlightActiveLine'] = ed.highlightActiveLine;
      if (ed.whitespace) migrated['editor.whitespace'] = ed.whitespace;
      if (typeof ed.folding === 'boolean') migrated['editor.folding'] = ed.folding;
      if (typeof ed.minimap === 'boolean') migrated['editor.minimap'] = ed.minimap;
    }

    return migrated;
  }
}
