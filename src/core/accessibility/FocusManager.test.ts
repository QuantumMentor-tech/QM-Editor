import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FocusManager } from './FocusManager';

describe('FocusManager Unit Tests', () => {
  let focusManager: FocusManager;

  beforeEach(() => {
    focusManager = new FocusManager();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Focus Scopes & Lifecycle', () => {
    it('initializes with default "application" scope', () => {
      expect(focusManager.getCurrentScope()).toBe('application');
    });

    it('pushes and pops focus scopes in LIFO order', () => {
      const btn = document.createElement('button');
      btn.id = 'orig-btn';
      document.body.appendChild(btn);
      btn.focus();

      const popDialog = focusManager.pushScope('dialog');
      expect(focusManager.getCurrentScope()).toBe('dialog');

      const popMenu = focusManager.pushScope('menu');
      expect(focusManager.getCurrentScope()).toBe('menu');

      popMenu();
      expect(focusManager.getCurrentScope()).toBe('dialog');

      popDialog();
      expect(focusManager.getCurrentScope()).toBe('application');
    });

    it('restores focus to previous element upon popScope', () => {
      const btn = document.createElement('button');
      document.body.appendChild(btn);
      btn.focus();
      expect(document.activeElement).toBe(btn);

      focusManager.pushScope('dialog');
      expect(focusManager.getCurrentScope()).toBe('dialog');

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      expect(document.activeElement).toBe(input);

      focusManager.popScope();
      expect(focusManager.getCurrentScope()).toBe('application');
      expect(document.activeElement).toBe(btn);
    });

    it('safely handles popping when element has been removed from DOM', () => {
      const btn = document.createElement('button');
      document.body.appendChild(btn);
      btn.focus();

      focusManager.pushScope('dialog');
      document.body.removeChild(btn); // Destroy element

      expect(() => {
        focusManager.popScope();
      }).not.toThrow();

      expect(focusManager.getCurrentScope()).toBe('application');
    });
  });

  describe('Focus Restoration Stack', () => {
    it('manually saves and restores focus safely', () => {
      const btn1 = document.createElement('button');
      const btn2 = document.createElement('button');
      document.body.appendChild(btn1);
      document.body.appendChild(btn2);

      btn1.focus();
      focusManager.saveFocus();

      btn2.focus();
      expect(document.activeElement).toBe(btn2);

      const restored = focusManager.restoreFocus();
      expect(restored).toBe(true);
      expect(document.activeElement).toBe(btn1);
    });
  });

  describe('Focusable Elements Discovery', () => {
    it('identifies focusable buttons, inputs, links, and composite roles', () => {
      const container = document.createElement('div');
      container.innerHTML = `
        <button id="b1">Button 1</button>
        <button id="b2" disabled>Disabled Button</button>
        <a id="l1" href="#">Link</a>
        <input id="i1" type="text" />
        <input id="i2" type="hidden" />
        <div id="t1" role="tab" tabindex="0">Tab 1</div>
        <div id="hidden" style="display: none;"><button>Hidden</button></div>
      `;
      document.body.appendChild(container);

      const focusables = focusManager.findFocusableElements(container);
      const ids = focusables.map((el) => el.id);

      expect(ids).toContain('b1');
      expect(ids).not.toContain('b2');
      expect(ids).toContain('l1');
      expect(ids).toContain('i1');
      expect(ids).not.toContain('i2');
      expect(ids).toContain('t1');
      expect(ids).not.toContain('hidden');
    });
  });

  describe('Modal Focus Trap', () => {
    it('traps Tab navigation within container (forward and backward)', () => {
      const dialog = document.createElement('div');
      const first = document.createElement('button');
      first.id = 'first';
      const second = document.createElement('button');
      second.id = 'second';
      dialog.appendChild(first);
      dialog.appendChild(second);
      document.body.appendChild(dialog);

      const untrap = focusManager.trapFocus(dialog, { autoFocus: false });

      // Tab on last element should wrap to first
      second.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      dialog.dispatchEvent(tabEvent);
      expect(document.activeElement).toBe(first);

      // Shift+Tab on first element should wrap to last
      first.focus();
      const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
      dialog.dispatchEvent(shiftTabEvent);
      expect(document.activeElement).toBe(second);

      untrap();
    });

    it('triggers onEscape handler when Escape key is pressed', () => {
      const dialog = document.createElement('div');
      const btn = document.createElement('button');
      dialog.appendChild(btn);
      document.body.appendChild(dialog);

      const onEscape = vi.fn();
      const untrap = focusManager.trapFocus(dialog, { onEscape, autoFocus: false });

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      dialog.dispatchEvent(escEvent);

      expect(onEscape).toHaveBeenCalledTimes(1);
      untrap();
    });
  });

  describe('Region Registration & Navigation', () => {
    it('registers a shell region and focuses its container or child', () => {
      const terminalContainer = document.createElement('div');
      terminalContainer.tabIndex = -1;
      document.body.appendChild(terminalContainer);

      const unregister = focusManager.registerRegion('terminal', () => terminalContainer);

      const success = focusManager.focusRegion('terminal');
      expect(success).toBe(true);
      expect(document.activeElement).toBe(terminalContainer);

      unregister();
      expect(focusManager.focusRegion('terminal')).toBe(false);
    });
  });

  describe('ARIA Live Region Announcements', () => {
    it('stores announcements and notifies subscribers', () => {
      const listener = vi.fn();
      const unsub = focusManager.subscribe(listener);

      focusManager.announce('Build succeeded', 'polite');
      expect(listener).toHaveBeenCalled();

      const announcements = focusManager.getAnnouncements();
      expect(announcements.length).toBe(1);
      expect(announcements[0].message).toBe('Build succeeded');
      expect(announcements[0].mode).toBe('polite');

      unsub();
    });
  });
});
