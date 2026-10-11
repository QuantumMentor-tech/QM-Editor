import { describe, it, expect, beforeEach } from 'vitest';
import { SettingsService } from './SettingsService';
import { SettingsStorage } from './SettingsStorage';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    service = SettingsService.getInstance();
    service.resetAll('user');
    service.resetAll('workspace');
  });

  it('resolves deterministic default values when unconfigured', () => {
    expect(service.get('editor.fontSize')).toBe(14);
    expect(service.get('appearance.theme')).toBe('dark');
    expect(service.get('editor.tabSize')).toBe(2);
  });

  it('validates and applies user-scoped setting updates', () => {
    // Valid update
    const res1 = service.set('editor.fontSize', 18, 'user');
    expect(res1.success).toBe(true);
    expect(service.get('editor.fontSize')).toBe(18);

    // Invalid update (exceeds max 32)
    const res2 = service.set('editor.fontSize', 99, 'user');
    expect(res2.success).toBe(false);
    expect(res2.error).toContain('between 8 and 32');
    // Retains previous valid value
    expect(service.get('editor.fontSize')).toBe(18);
  });

  it('enforces scope precedence where workspace overrides user setting', () => {
    service.set('editor.tabSize', 4, 'user');
    expect(service.get('editor.tabSize')).toBe(4);

    // Workspace override
    service.set('editor.tabSize', 8, 'workspace');
    expect(service.get('editor.tabSize')).toBe(8);

    // Resetting workspace scope falls back to user setting
    service.reset('editor.tabSize', 'workspace');
    expect(service.get('editor.tabSize')).toBe(4);
  });

  it('notifies subscribers upon setting change', () => {
    let receivedKey = '';
    let receivedVal = 0;

    const unsub = service.subscribe('editor.fontSize', (e) => {
      receivedKey = e.key;
      receivedVal = e.currentValue;
    });

    service.set('editor.fontSize', 16, 'user');
    expect(receivedKey).toBe('editor.fontSize');
    expect(receivedVal).toBe(16);

    unsub();
  });

  it('exports and imports configuration safely', () => {
    service.set('editor.tabSize', 4, 'user');
    service.set('appearance.theme', 'light', 'user');

    const exported = service.exportSettings();
    expect(exported.version).toBe('1.0.0');
    expect(exported.userSettings['editor.tabSize']).toBe(4);
    expect(exported.userSettings['appearance.theme']).toBe('light');

    // Reset
    service.resetAll('user');
    expect(service.get('editor.tabSize')).toBe(2);

    // Import back
    const importRes = service.importSettings(exported);
    expect(importRes.success).toBe(true);
    expect(importRes.importedCount).toBeGreaterThanOrEqual(2);
    expect(service.get('editor.tabSize')).toBe(4);
    expect(service.get('appearance.theme')).toBe('light');
  });

  it('migrates legacy preferences automatically', () => {
    const legacy = {
      theme: 'light',
      sidebarWidth: 300,
      editor: {
        fontSize: 20,
        tabSize: 4,
      },
    };

    SettingsStorage.setRawItem('qm_editor_user_preferences_v1', JSON.stringify(legacy));
    // Clear unified settings to trigger migration
    SettingsStorage.removeRawItem('qm_editor_unified_settings_v1');

    const migrated = SettingsStorage.loadUserSettings();
    expect(migrated['appearance.theme']).toBe('light');
    expect(migrated['appearance.sidebarWidth']).toBe(300);
    expect(migrated['editor.fontSize']).toBe(20);
    expect(migrated['editor.tabSize']).toBe(4);
  });
});
