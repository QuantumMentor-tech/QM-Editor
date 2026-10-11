/**
 * QM Editor Unified Settings Service
 * Phase 03, Step 21 — Unified Settings, Preferences & Configuration System
 */

import {
  SettingCategory,
  SettingChangeEvent,
  SettingChangeListener,
  SettingDefinition,
  SettingScope,
  SettingValidationResult,
  SettingsExportPayload,
} from './SettingTypes';
import { settingsRegistry } from './SettingsRegistry';
import { SettingsStorage } from './SettingsStorage';
import { PreferencesService } from '../../services/PreferencesService';
import { logger } from '../../utils/logger';

export class SettingsService {
  private static instance: SettingsService;
  private userSettings: Record<string, any> = {};
  private workspaceSettings: Record<string, any> = {};
  private currentWorkspaceId: string = 'default';
  private listeners: Set<{ pattern: string; callback: SettingChangeListener }> = new Set();

  private constructor() {
    this.userSettings = SettingsStorage.loadUserSettings();
    this.workspaceSettings = SettingsStorage.loadWorkspaceSettings(this.currentWorkspaceId);
  }

  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  public setWorkspaceId(workspaceId: string): void {
    if (this.currentWorkspaceId === workspaceId) return;
    this.currentWorkspaceId = workspaceId;
    this.workspaceSettings = SettingsStorage.loadWorkspaceSettings(workspaceId);
    logger.info('Switched workspace settings context', { workspaceId });
  }

  /**
   * Resolves effective setting value using scope precedence:
   * Workspace -> User -> Default
   */
  public get<T = any>(key: string): T {
    const def = settingsRegistry.get(key);
    if (!def) {
      logger.warn(`Unregistered setting key requested: "${key}".`);
      return undefined as unknown as T;
    }

    if (this.workspaceSettings[key] !== undefined) {
      return this.workspaceSettings[key] as T;
    }

    if (this.userSettings[key] !== undefined) {
      return this.userSettings[key] as T;
    }

    return def.defaultValue as T;
  }

  public getUserValue<T = any>(key: string): T | undefined {
    return this.userSettings[key];
  }

  public getWorkspaceValue<T = any>(key: string): T | undefined {
    return this.workspaceSettings[key];
  }

  public hasOverride(key: string, scope: SettingScope = 'user'): boolean {
    if (scope === 'workspace') {
      return this.workspaceSettings[key] !== undefined;
    }
    return this.userSettings[key] !== undefined;
  }

  /**
   * Sets a setting value with validation and persistence
   */
  public set(
    key: string,
    value: any,
    scope: SettingScope = 'user'
  ): { success: boolean; error?: string } {
    const def = settingsRegistry.get(key);
    if (!def) {
      return { success: false, error: `Setting "${key}" is not registered.` };
    }

    // 1. Validation
    const validation = this.validateValue(def, value);
    if (!validation.valid) {
      return { success: false, error: validation.error || 'Invalid setting value.' };
    }

    const previousValue = this.get(key);

    // 2. State update & persistence
    if (scope === 'workspace') {
      this.workspaceSettings[key] = value;
      SettingsStorage.saveWorkspaceSettings(this.currentWorkspaceId, this.workspaceSettings);
    } else {
      this.userSettings[key] = value;
      SettingsStorage.saveUserSettings(this.userSettings);
      // Synchronize with legacy PreferencesService for editor & appearance
      this.syncLegacyPreferences(key, value);
    }

    // 3. Emit change notification
    const event: SettingChangeEvent = {
      key,
      previousValue,
      currentValue: value,
      scope,
      timestamp: Date.now(),
    };
    this.notify(event);

    logger.debug('Setting changed', { key, value, scope });
    return { success: true };
  }

  public reset(key: string, scope: SettingScope = 'user'): void {
    const def = settingsRegistry.get(key);
    if (!def) return;

    const previousValue = this.get(key);

    if (scope === 'workspace') {
      delete this.workspaceSettings[key];
      SettingsStorage.saveWorkspaceSettings(this.currentWorkspaceId, this.workspaceSettings);
    } else {
      delete this.userSettings[key];
      SettingsStorage.saveUserSettings(this.userSettings);
      this.syncLegacyPreferences(key, def.defaultValue);
    }

    const currentValue = this.get(key);
    this.notify({
      key,
      previousValue,
      currentValue,
      scope,
      timestamp: Date.now(),
    });

    logger.info('Setting reset to default', { key, scope, currentValue });
  }

  public resetCategory(category: SettingCategory, scope: SettingScope = 'user'): void {
    const categorySettings = settingsRegistry.getByCategory(category);
    for (const setting of categorySettings) {
      if (this.hasOverride(setting.key, scope)) {
        this.reset(setting.key, scope);
      }
    }
  }

  public resetAll(scope: SettingScope = 'user'): void {
    const all = settingsRegistry.getAll();
    for (const setting of all) {
      if (this.hasOverride(setting.key, scope)) {
        this.reset(setting.key, scope);
      }
    }
  }

  public subscribe(pattern: string, callback: SettingChangeListener): () => void {
    const listener = { pattern, callback };
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public exportSettings(includeWorkspace: boolean = false): SettingsExportPayload {
    // Redact secret-like keys if any
    const sanitize = (obj: Record<string, any>) => {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        const lower = k.toLowerCase();
        if (
          !lower.includes('secret') &&
          !lower.includes('token') &&
          !lower.includes('password') &&
          !lower.includes('apikey')
        ) {
          clean[k] = v;
        }
      }
      return clean;
    };

    return {
      version: '1.0.0',
      exportedAt: Date.now(),
      userSettings: sanitize(this.userSettings),
      workspaceSettings: includeWorkspace ? sanitize(this.workspaceSettings) : undefined,
    };
  }

  public importSettings(payload: SettingsExportPayload): {
    success: boolean;
    importedCount: number;
    errors: string[];
  } {
    if (!payload || typeof payload !== 'object' || !payload.userSettings) {
      return { success: false, importedCount: 0, errors: ['Malformed settings import payload.'] };
    }

    let importedCount = 0;
    const errors: string[] = [];

    for (const [key, value] of Object.entries(payload.userSettings)) {
      const res = this.set(key, value, 'user');
      if (res.success) {
        importedCount++;
      } else {
        errors.push(`${key}: ${res.error}`);
      }
    }

    if (payload.workspaceSettings && typeof payload.workspaceSettings === 'object') {
      for (const [key, value] of Object.entries(payload.workspaceSettings)) {
        const res = this.set(key, value, 'workspace');
        if (res.success) {
          importedCount++;
        } else {
          errors.push(`workspace.${key}: ${res.error}`);
        }
      }
    }

    logger.info('Settings import completed', { importedCount, errorsCount: errors.length });
    return {
      success: errors.length === 0,
      importedCount,
      errors,
    };
  }

  private validateValue(def: SettingDefinition, value: unknown): SettingValidationResult {
    // Custom validation if defined
    if (def.validate) {
      const res = def.validate(value);
      if (!res.valid) return res;
    }

    switch (def.type) {
      case 'boolean':
        if (typeof value !== 'boolean') {
          return { valid: false, error: 'Value must be a boolean.' };
        }
        return { valid: true };

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return { valid: false, error: 'Value must be a valid number.' };
        }
        if (def.min !== undefined && value < def.min) {
          return { valid: false, error: `Value must be at least ${def.min}.` };
        }
        if (def.max !== undefined && value > def.max) {
          return { valid: false, error: `Value must be at most ${def.max}.` };
        }
        return { valid: true };

      case 'string':
        if (typeof value !== 'string') {
          return { valid: false, error: 'Value must be a string.' };
        }
        return { valid: true };

      case 'enum':
        if (def.options && !def.options.some((opt) => opt.value === value)) {
          return {
            valid: false,
            error: `Value must be one of: ${def.options.map((o) => o.value).join(', ')}.`,
          };
        }
        return { valid: true };

      default:
        return { valid: true };
    }
  }

  private notify(event: SettingChangeEvent): void {
    this.listeners.forEach(({ pattern, callback }) => {
      try {
        if (pattern === '*' || pattern === event.key || event.key.startsWith(pattern)) {
          callback(event);
        }
      } catch (err) {
        logger.error('Error in settings change listener', { error: (err as Error).message });
      }
    });
  }

  private syncLegacyPreferences(key: string, value: any): void {
    try {
      if (key === 'appearance.theme') {
        PreferencesService.savePreferences({ theme: value });
      } else if (key === 'appearance.sidebarWidth') {
        PreferencesService.savePreferences({ sidebarWidth: value });
      } else if (key === 'appearance.activePanelView') {
        PreferencesService.savePreferences({ activePanelView: value });
      } else if (key.startsWith('editor.')) {
        const prop = key.substring('editor.'.length);
        PreferencesService.savePreferences({ editor: { [prop]: value } as any });
      }
    } catch {
      // Non-fatal synchronization
    }
  }
}

export const settingsService = SettingsService.getInstance();
