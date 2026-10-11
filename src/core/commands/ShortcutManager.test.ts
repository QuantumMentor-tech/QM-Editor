import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ShortcutManager } from './ShortcutManager';
import { CommandRegistry } from './CommandRegistry';
import { CommandContext } from './CommandTypes';

describe('ShortcutManager Unit Tests', () => {
  let registry: CommandRegistry;
  let mockContext: CommandContext;

  beforeEach(() => {
    registry = new CommandRegistry();
    document.body.innerHTML = '';

    mockContext = {
      activeDoc: null,
      shellState: {
        theme: 'dark',
        sidebarOpen: true,
        sidebarWidth: 260,
        sidebarView: 'explorer',
        panelOpen: false,
        activePanelView: 'terminal',
        activeView: 'editor',
        dialogOpen: false,
        dialogTitle: '',
        dialogContent: null,
        editorSettings: {
          fontSize: 14,
          fontFamily: 'monospace',
          lineNumbers: true,
          wordWrap: 'off',
          tabSize: 2,
          insertSpaces: true,
          bracketMatching: true,
          autoClosingBrackets: true,
          highlightActiveLine: true,
          whitespace: 'none',
          folding: true,
          minimap: false,
        },
      },
      workspaceActions: {
        saveDoc: vi.fn(),
        createDoc: vi.fn(),
        closeDoc: vi.fn(),
        activateDoc: vi.fn(),
      },
      shellActions: {
        toggleSidebar: vi.fn(),
        togglePanel: vi.fn(),
        toggleTheme: vi.fn(),
      },
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Shortcut Pattern Matching', () => {
    it('matches Mod+S with ctrlKey or metaKey', () => {
      const isMac = ShortcutManager.isMac();
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: !isMac,
        metaKey: isMac,
      });

      const matches = ShortcutManager.matchesShortcut(event, 'Mod+S', true);
      expect(matches).toBe(true);
    });

    it('rejects match if required Shift modifier is missing', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'e',
        ctrlKey: true,
        shiftKey: false,
      });

      const matches = ShortcutManager.matchesShortcut(event, 'Mod+Shift+E', true);
      expect(matches).toBe(false);
    });

    it('formats shortcuts cleanly for human presentation', () => {
      const formatted = ShortcutManager.formatShortcut('Mod+Shift+P');
      expect(formatted).toContain('Shift+P');
      expect(formatted).toMatch(/Ctrl|⌘/);
    });
  });

  describe('Input Field Protection (Rule 43)', () => {
    it('identifies standard input and textarea elements as editable', () => {
      const input = document.createElement('input');
      input.type = 'text';
      expect(ShortcutManager.isEditableElement(input)).toBe(true);

      const textarea = document.createElement('textarea');
      expect(ShortcutManager.isEditableElement(textarea)).toBe(true);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      expect(ShortcutManager.isEditableElement(checkbox)).toBe(false);

      const div = document.createElement('div');
      expect(ShortcutManager.isEditableElement(div)).toBe(false);

      div.contentEditable = 'true';
      expect(ShortcutManager.isEditableElement(div)).toBe(true);
    });

    it('does not intercept Ctrl+A, Ctrl+C, Ctrl+V, etc. inside text inputs', () => {
      const selectAllFn = vi.fn();
      registry.register({
        id: 'editor.selectAll',
        label: 'Select All',
        category: 'editor',
        shortcut: 'Mod+A',
        canExecute: () => true,
        execute: selectAllFn,
      });

      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', {
        key: 'a',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'target', { value: input });

      const handled = ShortcutManager.handleKeyDown(event, mockContext, registry);
      expect(handled).toBe(false);
      expect(selectAllFn).not.toHaveBeenCalled();
    });

    it('suppresses editor-specific shortcuts when typing in search or settings input', () => {
      const formatFn = vi.fn();
      registry.register({
        id: 'editor.format',
        label: 'Format Code',
        category: 'editor',
        shortcut: 'Mod+Shift+F',
        canExecute: () => true,
        execute: formatFn,
      });

      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        shiftKey: true,
      });
      Object.defineProperty(event, 'target', { value: input });

      const handled = ShortcutManager.handleKeyDown(event, mockContext, registry);
      expect(handled).toBe(false);
      expect(formatFn).not.toHaveBeenCalled();
    });

    it('allows global shortcuts like Command Palette or Save even from input if appropriate', () => {
      const saveFn = vi.fn();
      registry.register({
        id: 'workspace.save',
        label: 'Save File',
        category: 'workspace',
        shortcut: 'Mod+S',
        canExecute: () => true,
        execute: saveFn,
      });

      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
      });
      Object.defineProperty(event, 'target', { value: input });

      const handled = ShortcutManager.handleKeyDown(event, mockContext, registry);
      expect(handled).toBe(true);
      expect(saveFn).toHaveBeenCalledTimes(1);
    });
  });
});
