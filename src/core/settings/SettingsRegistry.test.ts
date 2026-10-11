import { describe, it, expect } from 'vitest';
import { SettingsRegistry } from './SettingsRegistry';

describe('SettingsRegistry', () => {
  const registry = SettingsRegistry.getInstance();

  it('contains pre-registered built-in settings across all categories', () => {
    const all = registry.getAll();
    expect(all.length).toBeGreaterThanOrEqual(15);

    expect(registry.get('editor.fontSize')).toBeDefined();
    expect(registry.get('editor.tabSize')).toBeDefined();
    expect(registry.get('appearance.theme')).toBeDefined();
    expect(registry.get('terminal.scrollback')).toBeDefined();
    expect(registry.get('sourceControl.showDecorations')).toBeDefined();
    expect(registry.get('tasks.showConsoleOnRun')).toBeDefined();
    expect(registry.get('files.autoSave')).toBeDefined();
  });

  it('rejects duplicate key registration', () => {
    expect(() => {
      registry.register({
        key: 'editor.fontSize',
        title: 'Duplicate',
        description: 'Duplicate',
        category: 'Editor',
        type: 'number',
        defaultValue: 14,
        scope: 'user',
      });
    }).toThrowError(/Duplicate setting key/);
  });

  it('searches settings with accurate ranking', () => {
    // 1. Exact key match
    const exactKey = registry.search('editor.fontSize');
    expect(exactKey[0].key).toBe('editor.fontSize');

    // 2. Partial title match
    const titleMatch = registry.search('font size');
    expect(titleMatch.some((s) => s.key === 'editor.fontSize')).toBe(true);

    // 3. Category match
    const catMatch = registry.search('Terminal');
    expect(catMatch.some((s) => s.key.startsWith('terminal.'))).toBe(true);
  });
});
