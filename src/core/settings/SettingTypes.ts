/**
 * QM Editor Unified Settings & Configuration Types
 * Phase 03, Step 21 — Unified Settings, Preferences & Configuration System
 */

export type SettingScope = 'user' | 'workspace' | 'application';

export type SettingCategory =
  | 'General'
  | 'Appearance'
  | 'Editor'
  | 'Terminal'
  | 'Source Control'
  | 'Tasks'
  | 'Files'
  | 'Search'
  | 'Accessibility';

export type SettingType = 'boolean' | 'number' | 'string' | 'enum';

export interface SettingOption<T = string | number> {
  label: string;
  value: T;
  description?: string;
}

export interface SettingValidationResult {
  valid: boolean;
  error?: string;
}

export interface SettingDefinition<T = any> {
  key: string;
  title: string;
  description: string;
  category: SettingCategory;
  type: SettingType;
  defaultValue: T;
  scope: SettingScope;
  options?: SettingOption<T>[];
  min?: number;
  max?: number;
  step?: number;
  restartRequired?: boolean;
  sensitive?: boolean;
  validate?: (value: unknown) => SettingValidationResult;
}

export interface SettingChangeEvent<T = any> {
  key: string;
  previousValue: T;
  currentValue: T;
  scope: SettingScope;
  timestamp: number;
}

export type SettingChangeListener = (event: SettingChangeEvent) => void;

export interface SettingsExportPayload {
  version: string;
  exportedAt: number;
  userSettings: Record<string, any>;
  workspaceSettings?: Record<string, any>;
}
