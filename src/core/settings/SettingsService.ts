/**
 * QM Editor Unified Settings Service
 * Phase 03, Step 21 — Unified Settings, Preferences & Configuration System
 * Phase 05, Step 49 — Persistent Settings, Preferences & Configuration Storage
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
import {
  ISettingsRepository,
  globalSettingsRepository,
} from '../storage/repositories/SettingsRepository';
import { PreferencesService } from '../../services/PreferencesService';
import { logger } from '../../utils/logger';

export class SettingsService {
  private static instance: SettingsService;
  private userSettings: Record<string, any> = {};
  private workspaceSettings: Record<string, any> = {};
  private currentWorkspaceId: string = 'default';
  private currentWorkspaceGeneration: number = 0;
  private listeners: Set<{ pattern: string; callback: SettingChangeListener }> = new Set();

  private repository: ISettingsRepository = globalSettingsRepository;
  private isInitialized: boolean = false;
  private userRecordVersion: number | undefined = undefined;
  private workspaceRecordVersions: Map<string, number> = new Map();

  // Async persistence queues & debouncing
  private pendingUserWriteTimer: any = null;
  private pendingWorkspaceWriteTimers: Map<string, any> = new Map();
  private pendingOperations: Set<Promise<any>> = new Set();

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

  /**
   * Initializes SettingsService with the durable storage repository.
   * Loads persisted user and workspace settings, runs validation-on-load,
   * performs automatic migration from legacy localStorage if repository is empty,
   * and establishes the durable persistence boundary.
   */
  public async initialize(repository: ISettingsRepository = globalSettingsRepository): Promise<void> {
    this.repository = repository;

    try {
      // 1. Load User Settings from Repository
      const userRecord = await this.repository.getUserSettingsRecord();
      if (userRecord && userRecord.settings) {
        this.userRecordVersion = userRecord.recordVersion;
        this.userSettings = this.validateAndSanitize(userRecord.settings as Record<string, any>, 'user');
      } else {
        // Fallback / Migration from legacy SettingsStorage
        const legacyUser = SettingsStorage.loadUserSettings();
        if (legacyUser && Object.keys(legacyUser).length > 0) {
          logger.info('Migrating legacy localStorage settings into durable storage repository');
          this.userSettings = this.validateAndSanitize(legacyUser, 'user');
          try {
            await this.repository.saveUserSettings(this.userSettings);
            const savedRecord = await this.repository.getUserSettingsRecord();
            if (savedRecord) this.userRecordVersion = savedRecord.recordVersion;
          } catch (err) {
            logger.warn('Failed to persist initial migrated settings to repository', err);
          }
        } else {
          this.userSettings = {};
        }
      }

      // 2. Load Workspace Settings from Repository for current workspace
      const wsRecord = await this.repository.getWorkspaceSettingsRecord(this.currentWorkspaceId);
      if (wsRecord && wsRecord.settings) {
        this.workspaceRecordVersions.set(this.currentWorkspaceId, wsRecord.recordVersion);
        this.workspaceSettings = this.validateAndSanitize(
          wsRecord.settings as Record<string, any>,
          'workspace'
        );
      } else {
        const legacyWs = SettingsStorage.loadWorkspaceSettings(this.currentWorkspaceId);
        if (legacyWs && Object.keys(legacyWs).length > 0) {
          this.workspaceSettings = this.validateAndSanitize(legacyWs, 'workspace');
          try {
            await this.repository.saveWorkspaceSettings(this.currentWorkspaceId, this.workspaceSettings);
            const savedWsRecord = await this.repository.getWorkspaceSettingsRecord(this.currentWorkspaceId);
            if (savedWsRecord) {
              this.workspaceRecordVersions.set(this.currentWorkspaceId, savedWsRecord.recordVersion);
            }
          } catch (err) {
            logger.warn('Failed to persist initial workspace settings to repository', err);
          }
        } else {
          this.workspaceSettings = {};
        }
      }

      this.isInitialized = true;
      logger.info('SettingsService successfully initialized with durable storage', {
        userSettingCount: Object.keys(this.userSettings).length,
        workspaceSettingCount: Object.keys(this.workspaceSettings).length,
        workspaceId: this.currentWorkspaceId,
      });
    } catch (err) {
      logger.error('Failed to initialize settings from durable storage; continuing with in-memory state', err);
    }
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  public getRepository(): ISettingsRepository {
    return this.repository;
  }

  public getUserRecordVersion(): number | undefined {
    return this.userRecordVersion;
  }

  public getWorkspaceRecordVersion(workspaceId: string = this.currentWorkspaceId): number | undefined {
    return this.workspaceRecordVersions.get(workspaceId);
  }

  /**
   * Switches active workspace context with generation protection.
   * Flushes outgoing workspace changes, loads incoming workspace settings asynchronously,
   * drops stale loads if another switch occurred, and emits settingChanged events for differences.
   */
  public async setWorkspaceId(workspaceId: string): Promise<void> {
    if (this.currentWorkspaceId === workspaceId) return;

    const oldWorkspaceId = this.currentWorkspaceId;
    const oldEffective = this.captureEffectiveValues();

    // Flush any pending write for outgoing workspace
    await this.flushWorkspace(oldWorkspaceId);

    const generation = ++this.currentWorkspaceGeneration;
    this.currentWorkspaceId = workspaceId;

    try {
      let loadedSettings: Record<string, any> = {};
      if (this.isInitialized) {
        const record = await this.repository.getWorkspaceSettingsRecord(workspaceId);
        if (record && record.settings) {
          this.workspaceRecordVersions.set(workspaceId, record.recordVersion);
          loadedSettings = this.validateAndSanitize(record.settings as Record<string, any>, 'workspace');
        }
      } else {
        loadedSettings = SettingsStorage.loadWorkspaceSettings(workspaceId);
      }

      // Generation protection: discard late load if active workspace changed during async fetch
      if (generation !== this.currentWorkspaceGeneration) {
        logger.warn('Discarded stale workspace settings load due to concurrent switch', {
          loadedFor: workspaceId,
          activeWorkspace: this.currentWorkspaceId,
        });
        return;
      }

      this.workspaceSettings = loadedSettings;
    } catch (err) {
      if (generation !== this.currentWorkspaceGeneration) return;
      logger.error(`Failed to load workspace settings for "${workspaceId}"; using empty overrides`, err);
      this.workspaceSettings = {};
    }

    // Emit change events for any keys where the effective value changed
    this.emitEffectiveChanges(oldEffective);
    logger.info('Switched workspace settings context', { workspaceId, generation });
  }

  /**
   * Synchronous workspace switch for backward compatibility (e.g. sync callers)
   */
  public setWorkspaceIdSync(workspaceId: string): void {
    if (this.currentWorkspaceId === workspaceId) return;
    const oldEffective = this.captureEffectiveValues();
    this.currentWorkspaceGeneration++;
    this.currentWorkspaceId = workspaceId;
    this.workspaceSettings = SettingsStorage.loadWorkspaceSettings(workspaceId);
    this.emitEffectiveChanges(oldEffective);
    logger.info('Switched workspace settings context (sync)', { workspaceId });
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
   * Sets a setting value with validation and debounced persistence
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

    // Secret settings boundary check
    if (settingsRegistry.isSensitive(key) || def.sensitive) {
      return {
        success: false,
        error: `Setting "${key}" is classified as sensitive and cannot be persisted in ordinary configuration storage.`,
      };
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
      this.queueWorkspaceWrite(this.currentWorkspaceId);
    } else {
      this.userSettings[key] = value;
      SettingsStorage.saveUserSettings(this.userSettings);
      this.syncLegacyPreferences(key, value);
      this.queueUserWrite();
    }

    // 3. Emit change notification
    const event: SettingChangeEvent = {
      key,
      previousValue,
      currentValue: this.get(key),
      scope,
      timestamp: Date.now(),
    };
    this.notify(event);

    logger.debug('Setting changed', {
      key,
      value: def.sensitive ? '***REDACTED***' : value,
      scope,
    });
    return { success: true };
  }

  /**
   * Sets a setting value asynchronously, awaiting durable persistence to repository.
   * On persistence failure, rolls back the in-memory update and returns an error.
   */
  public async setAsync(
    key: string,
    value: any,
    scope: SettingScope = 'user'
  ): Promise<{ success: boolean; error?: string }> {
    const def = settingsRegistry.get(key);
    if (!def) {
      return { success: false, error: `Setting "${key}" is not registered.` };
    }

    if (settingsRegistry.isSensitive(key) || def.sensitive) {
      return {
        success: false,
        error: `Setting "${key}" is classified as sensitive and cannot be persisted in ordinary configuration storage.`,
      };
    }

    const validation = this.validateValue(def, value);
    if (!validation.valid) {
      return { success: false, error: validation.error || 'Invalid setting value.' };
    }

    const previousValue = this.get(key);
    const previousRaw = scope === 'workspace' ? this.workspaceSettings[key] : this.userSettings[key];

    // Optimistically update in-memory
    if (scope === 'workspace') {
      this.workspaceSettings[key] = value;
      SettingsStorage.saveWorkspaceSettings(this.currentWorkspaceId, this.workspaceSettings);
    } else {
      this.userSettings[key] = value;
      SettingsStorage.saveUserSettings(this.userSettings);
      this.syncLegacyPreferences(key, value);
    }

    // Persist immediately to repository if initialized
    if (this.isInitialized) {
      try {
        if (scope === 'workspace') {
          const wsId = this.currentWorkspaceId;
          await this.repository.saveWorkspaceSettings(
            wsId,
            this.workspaceSettings,
            this.workspaceRecordVersions.get(wsId)
          );
          const record = await this.repository.getWorkspaceSettingsRecord(wsId);
          if (record) this.workspaceRecordVersions.set(wsId, record.recordVersion);
        } else {
          await this.repository.saveUserSettings(this.userSettings, this.userRecordVersion);
          const record = await this.repository.getUserSettingsRecord();
          if (record) this.userRecordVersion = record.recordVersion;
        }
      } catch (err: any) {
        // Rollback on persistence failure
        if (scope === 'workspace') {
          if (previousRaw === undefined) {
            delete this.workspaceSettings[key];
          } else {
            this.workspaceSettings[key] = previousRaw;
          }
          SettingsStorage.saveWorkspaceSettings(this.currentWorkspaceId, this.workspaceSettings);
        } else {
          if (previousRaw === undefined) {
            delete this.userSettings[key];
          } else {
            this.userSettings[key] = previousRaw;
          }
          SettingsStorage.saveUserSettings(this.userSettings);
          this.syncLegacyPreferences(key, this.get(key));
        }

        logger.error(`Failed to persist setting "${key}"; rolled back in-memory state`, err);
        return { success: false, error: err?.message || 'Failed to persist setting to storage.' };
      }
    }

    // Emit change notification on confirmed success
    this.notify({
      key,
      previousValue,
      currentValue: this.get(key),
      scope,
      timestamp: Date.now(),
    });

    return { success: true };
  }

  public reset(key: string, scope: SettingScope = 'user'): void {
    const def = settingsRegistry.get(key);
    if (!def) return;

    const previousValue = this.get(key);

    if (scope === 'workspace') {
      delete this.workspaceSettings[key];
      SettingsStorage.saveWorkspaceSettings(this.currentWorkspaceId, this.workspaceSettings);
      this.queueWorkspaceWrite(this.currentWorkspaceId);
    } else {
      delete this.userSettings[key];
      SettingsStorage.saveUserSettings(this.userSettings);
      this.syncLegacyPreferences(key, def.defaultValue);
      this.queueUserWrite();
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

  public async resetAsync(key: string, scope: SettingScope = 'user'): Promise<void> {
    const def = settingsRegistry.get(key);
    if (!def) return;

    const previousValue = this.get(key);
    const previousRaw = scope === 'workspace' ? this.workspaceSettings[key] : this.userSettings[key];

    if (scope === 'workspace') {
      delete this.workspaceSettings[key];
      SettingsStorage.saveWorkspaceSettings(this.currentWorkspaceId, this.workspaceSettings);
    } else {
      delete this.userSettings[key];
      SettingsStorage.saveUserSettings(this.userSettings);
      this.syncLegacyPreferences(key, def.defaultValue);
    }

    if (this.isInitialized) {
      try {
        if (scope === 'workspace') {
          const wsId = this.currentWorkspaceId;
          await this.repository.saveWorkspaceSettings(
            wsId,
            this.workspaceSettings,
            this.workspaceRecordVersions.get(wsId)
          );
          const record = await this.repository.getWorkspaceSettingsRecord(wsId);
          if (record) this.workspaceRecordVersions.set(wsId, record.recordVersion);
        } else {
          await this.repository.saveUserSettings(this.userSettings, this.userRecordVersion);
          const record = await this.repository.getUserSettingsRecord();
          if (record) this.userRecordVersion = record.recordVersion;
        }
      } catch (err) {
        // Rollback
        if (scope === 'workspace') {
          if (previousRaw !== undefined) this.workspaceSettings[key] = previousRaw;
        } else {
          if (previousRaw !== undefined) this.userSettings[key] = previousRaw;
        }
        throw err;
      }
    }

    const currentValue = this.get(key);
    this.notify({
      key,
      previousValue,
      currentValue,
      scope,
      timestamp: Date.now(),
    });
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

  public async resetAllAsync(scope: SettingScope = 'user'): Promise<void> {
    if (scope === 'workspace') {
      const wsId = this.currentWorkspaceId;
      const oldKeys = Object.keys(this.workspaceSettings);
      this.workspaceSettings = {};
      SettingsStorage.saveWorkspaceSettings(wsId, {});
      await this.repository.saveWorkspaceSettings(wsId, {});
      const record = await this.repository.getWorkspaceSettingsRecord(wsId);
      if (record) this.workspaceRecordVersions.set(wsId, record.recordVersion);

      for (const k of oldKeys) {
        this.notify({
          key: k,
          previousValue: undefined,
          currentValue: this.get(k),
          scope: 'workspace',
          timestamp: Date.now(),
        });
      }
    } else {
      const oldKeys = Object.keys(this.userSettings);
      this.userSettings = {};
      SettingsStorage.saveUserSettings({});
      await this.repository.saveUserSettings({});
      const record = await this.repository.getUserSettingsRecord();
      if (record) this.userRecordVersion = record.recordVersion;

      for (const k of oldKeys) {
        this.notify({
          key: k,
          previousValue: undefined,
          currentValue: this.get(k),
          scope: 'user',
          timestamp: Date.now(),
        });
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
    // Redact sensitive keys
    const sanitize = (obj: Record<string, any>) => {
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (!settingsRegistry.isSensitive(k)) {
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

  // ---------------------------------------------------------------------------
  // Validation, Sanitization & Internal Helpers
  // ---------------------------------------------------------------------------

  private validateAndSanitize(
    raw: Record<string, any>,
    _scope: SettingScope
  ): Record<string, any> {
    const clean: Record<string, any> = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return clean;
    }

    for (const [key, value] of Object.entries(raw)) {
      // 1. Sensitive setting check: never allow sensitive settings in ordinary persistence
      if (settingsRegistry.isSensitive(key)) {
        logger.warn(`Discarding sensitive setting "${key}" found in ordinary storage.`);
        continue;
      }

      const def = settingsRegistry.get(key);
      if (!def) {
        // Unknown setting: preserve data safely so future registrations or migrations are not lost
        clean[key] = value;
        continue;
      }

      // Check validation
      const validation = this.validateValue(def, value);
      if (validation.valid) {
        clean[key] = value;
      } else {
        logger.warn(
          `Stored setting "${key}" had invalid value (${validation.error}); discarding override to use default.`
        );
      }
    }

    return clean;
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

  private queueUserWrite(): void {
    if (!this.isInitialized) return;
    if (this.pendingUserWriteTimer) {
      clearTimeout(this.pendingUserWriteTimer);
    }
    this.pendingUserWriteTimer = setTimeout(() => {
      this.pendingUserWriteTimer = null;
      const op = this.flushUser().catch((err) => {
        logger.error('Background user settings persistence failed', err);
      });
      this.trackOperation(op);
    }, 50);
  }

  private queueWorkspaceWrite(workspaceId: string): void {
    if (!this.isInitialized) return;
    const existing = this.pendingWorkspaceWriteTimers.get(workspaceId);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this.pendingWorkspaceWriteTimers.delete(workspaceId);
      const op = this.flushWorkspace(workspaceId).catch((err) => {
        logger.error(`Background workspace settings persistence failed for "${workspaceId}"`, err);
      });
      this.trackOperation(op);
    }, 50);
    this.pendingWorkspaceWriteTimers.set(workspaceId, timer);
  }

  private async flushUser(): Promise<void> {
    if (!this.isInitialized) return;
    if (this.pendingUserWriteTimer) {
      clearTimeout(this.pendingUserWriteTimer);
      this.pendingUserWriteTimer = null;
    }
    try {
      await this.repository.saveUserSettings(this.userSettings, this.userRecordVersion);
      const record = await this.repository.getUserSettingsRecord();
      if (record) this.userRecordVersion = record.recordVersion;
    } catch (err) {
      logger.error('Failed to flush user settings', err);
      throw err;
    }
  }

  private async flushWorkspace(workspaceId: string): Promise<void> {
    if (!this.isInitialized) return;
    const timer = this.pendingWorkspaceWriteTimers.get(workspaceId);
    if (timer) {
      clearTimeout(timer);
      this.pendingWorkspaceWriteTimers.delete(workspaceId);
    }
    try {
      const payload =
        workspaceId === this.currentWorkspaceId
          ? this.workspaceSettings
          : SettingsStorage.loadWorkspaceSettings(workspaceId);

      await this.repository.saveWorkspaceSettings(
        workspaceId,
        payload,
        this.workspaceRecordVersions.get(workspaceId)
      );
      const record = await this.repository.getWorkspaceSettingsRecord(workspaceId);
      if (record) this.workspaceRecordVersions.set(workspaceId, record.recordVersion);
    } catch (err) {
      logger.error(`Failed to flush workspace settings for "${workspaceId}"`, err);
      throw err;
    }
  }

  public resetForTesting(): void {
    if (this.pendingUserWriteTimer) {
      clearTimeout(this.pendingUserWriteTimer);
      this.pendingUserWriteTimer = null;
    }
    for (const t of this.pendingWorkspaceWriteTimers.values()) {
      clearTimeout(t);
    }
    this.pendingWorkspaceWriteTimers.clear();
    this.userSettings = {};
    this.workspaceSettings = {};
    this.currentWorkspaceId = 'default';
    this.currentWorkspaceGeneration = 0;
    this.userRecordVersion = undefined;
    this.workspaceRecordVersions.clear();
    this.isInitialized = false;
    this.listeners.clear();
    this.repository = globalSettingsRepository;
    SettingsStorage.saveUserSettings({});
    SettingsStorage.saveWorkspaceSettings('default', {});
  }

  public async flush(): Promise<void> {
    const promises: Promise<any>[] = [];
    if (this.pendingUserWriteTimer) {
      promises.push(this.flushUser());
    }
    for (const wsId of Array.from(this.pendingWorkspaceWriteTimers.keys())) {
      promises.push(this.flushWorkspace(wsId));
    }
    promises.push(...Array.from(this.pendingOperations));

    await Promise.allSettled(promises);
  }

  private trackOperation(op: Promise<any>): void {
    this.pendingOperations.add(op);
    op.finally(() => {
      this.pendingOperations.delete(op);
    });
  }

  private captureEffectiveValues(): Map<string, any> {
    const map = new Map<string, any>();
    for (const def of settingsRegistry.getAll()) {
      map.set(def.key, this.get(def.key));
    }
    return map;
  }

  private emitEffectiveChanges(oldEffective: Map<string, any>): void {
    for (const [key, prevVal] of oldEffective.entries()) {
      const newVal = this.get(key);
      if (prevVal !== newVal) {
        this.notify({
          key,
          previousValue: prevVal,
          currentValue: newVal,
          scope: 'workspace',
          timestamp: Date.now(),
        });
      }
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
