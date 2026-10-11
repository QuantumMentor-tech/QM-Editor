/**
 * QM Editor Unified Settings React Context
 * Phase 03, Step 21 — Unified Settings, Preferences & Configuration System
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  SettingCategory,
  SettingDefinition,
  SettingScope,
  SettingsExportPayload,
} from '../core/settings/SettingTypes';
import { settingsService } from '../core/settings/SettingsService';
import { settingsRegistry } from '../core/settings/SettingsRegistry';

export interface SettingsContextType {
  activeScope: SettingScope;
  setActiveScope: (scope: SettingScope) => void;
  getSetting: <T = any>(key: string) => T;
  setSetting: (key: string, value: any, scope?: SettingScope) => { success: boolean; error?: string };
  resetSetting: (key: string, scope?: SettingScope) => void;
  resetCategory: (category: SettingCategory, scope?: SettingScope) => void;
  resetAllSettings: (scope?: SettingScope) => void;
  hasOverride: (key: string, scope?: SettingScope) => boolean;
  searchSettings: (query: string) => SettingDefinition[];
  exportSettingsJson: (includeWorkspace?: boolean) => string;
  importSettingsJson: (json: string) => { success: boolean; importedCount: number; errors: string[] };
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeScope, setActiveScope] = useState<SettingScope>('user');
  const [, setRevision] = useState(0);

  useEffect(() => {
    const unsub = settingsService.subscribe('*', () => {
      setRevision((r) => r + 1);
    });
    return unsub;
  }, []);

  const getSetting = useCallback(<T = any,>(key: string): T => {
    return settingsService.get<T>(key);
  }, []);

  const setSetting = useCallback(
    (key: string, value: any, scope?: SettingScope) => {
      const targetScope = scope || activeScope;
      return settingsService.set(key, value, targetScope);
    },
    [activeScope]
  );

  const resetSetting = useCallback(
    (key: string, scope?: SettingScope) => {
      const targetScope = scope || activeScope;
      settingsService.reset(key, targetScope);
    },
    [activeScope]
  );

  const resetCategory = useCallback(
    (category: SettingCategory, scope?: SettingScope) => {
      const targetScope = scope || activeScope;
      settingsService.resetCategory(category, targetScope);
    },
    [activeScope]
  );

  const resetAllSettings = useCallback(
    (scope?: SettingScope) => {
      const targetScope = scope || activeScope;
      settingsService.resetAll(targetScope);
    },
    [activeScope]
  );

  const hasOverride = useCallback(
    (key: string, scope?: SettingScope): boolean => {
      const targetScope = scope || activeScope;
      return settingsService.hasOverride(key, targetScope);
    },
    [activeScope]
  );

  const searchSettings = useCallback((query: string) => {
    return settingsRegistry.search(query);
  }, []);

  const exportSettingsJson = useCallback((includeWorkspace: boolean = false) => {
    const payload = settingsService.exportSettings(includeWorkspace);
    return JSON.stringify(payload, null, 2);
  }, []);

  const importSettingsJson = useCallback((json: string) => {
    try {
      const parsed: SettingsExportPayload = JSON.parse(json);
      return settingsService.importSettings(parsed);
    } catch {
      return { success: false, importedCount: 0, errors: ['Invalid JSON formatted string.'] };
    }
  }, []);

  const value: SettingsContextType = {
    activeScope,
    setActiveScope,
    getSetting,
    setSetting,
    resetSetting,
    resetCategory,
    resetAllSettings,
    hasOverride,
    searchSettings,
    exportSettingsJson,
    importSettingsJson,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
