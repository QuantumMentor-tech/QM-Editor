/**
 * QM Editor Centralized Focus Manager
 * Phase 03, Step 24 — Accessibility, Focus Management, Keyboard Navigation & Interaction Foundation
 */

import {
  FocusScope,
  FocusHistoryEntry,
  FocusTrapOptions,
  AriaLiveMode,
  AnnouncementMessage,
} from './AccessibilityTypes';
import { logger } from '../../utils/logger';

export class FocusManager {
  private scopeStack: FocusScope[] = ['application'];
  private historyStack: FocusHistoryEntry[] = [];
  private regionGetters: Map<FocusScope, () => HTMLElement | null> = new Map();
  private subscribers: Set<() => void> = new Set();
  private announcements: AnnouncementMessage[] = [];
  private maxHistory: number = 20;

  /**
   * Retrieves current active focus scope
   */
  public getCurrentScope(): FocusScope {
    return this.scopeStack[this.scopeStack.length - 1] || 'application';
  }

  /**
   * Pushes a new focus scope onto the stack and records previous focus for restoration
   */
  public pushScope(scope: FocusScope, returnElement?: HTMLElement | null): () => void {
    const prevElement = returnElement !== undefined ? returnElement : (document.activeElement as HTMLElement | null);
    this.historyStack.push({
      scope: this.getCurrentScope(),
      element: prevElement,
      timestamp: Date.now(),
    });

    if (this.historyStack.length > this.maxHistory) {
      this.historyStack.shift();
    }

    this.scopeStack.push(scope);
    logger.debug('FocusManager: Pushed focus scope', { scope, prevScope: this.historyStack[this.historyStack.length - 1]?.scope });
    this.notify();

    return () => {
      this.popScope();
    };
  }

  /**
   * Pops the current focus scope and restores focus to previous scope's target
   */
  public popScope(): boolean {
    if (this.scopeStack.length <= 1) {
      return false;
    }

    const exitedScope = this.scopeStack.pop();
    const historyItem = this.historyStack.pop();

    logger.debug('FocusManager: Popped focus scope', { exitedScope, currentScope: this.getCurrentScope() });

    if (historyItem?.element && document.body.contains(historyItem.element)) {
      try {
        historyItem.element.focus();
      } catch (err) {
        logger.warn('FocusManager: Failed to focus restored element', { error: err });
      }
    }

    this.notify();
    return true;
  }

  /**
   * Explicitly records current focus element for future restoration
   */
  public saveFocus(element?: HTMLElement | null): void {
    const target = element !== undefined ? element : (document.activeElement as HTMLElement | null);
    this.historyStack.push({
      scope: this.getCurrentScope(),
      element: target,
      timestamp: Date.now(),
    });

    if (this.historyStack.length > this.maxHistory) {
      this.historyStack.shift();
    }
  }

  /**
   * Restores focus to the last saved focus element if still connected to the DOM
   */
  public restoreFocus(): boolean {
    while (this.historyStack.length > 0) {
      const entry = this.historyStack.pop();
      if (entry?.element && document.body.contains(entry.element)) {
        try {
          entry.element.focus();
          return true;
        } catch {
          // Continue attempting previous history if target threw error
        }
      }
    }
    return false;
  }

  /**
   * Registers a major shell region for programmatic focus commands
   */
  public registerRegion(region: FocusScope, getter: () => HTMLElement | null): () => void {
    this.regionGetters.set(region, getter);
    return () => {
      this.regionGetters.delete(region);
    };
  }

  /**
   * Moves keyboard focus to a registered shell region
   */
  public focusRegion(region: FocusScope): boolean {
    const getter = this.regionGetters.get(region);
    if (!getter) {
      logger.warn('FocusManager: Region not registered', { region });
      return false;
    }

    const container = getter();
    if (!container || !document.body.contains(container)) {
      return false;
    }

    // Attempt to focus container or its first interactive child
    if (container.hasAttribute('tabindex') || container.getAttribute('role') === 'textbox') {
      container.focus();
      this.pushScope(region, null);
      return true;
    }

    const focusables = this.findFocusableElements(container);
    if (focusables.length > 0) {
      focusables[0].focus();
      this.pushScope(region, null);
      return true;
    }

    // Default container fallback
    container.setAttribute('tabindex', '-1');
    container.focus();
    this.pushScope(region, null);
    return true;
  }

  /**
   * Discovers all visibly focusable elements inside a DOM container
   */
  public findFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector = [
      'button:not([disabled]):not([aria-hidden="true"])',
      '[href]:not([aria-hidden="true"])',
      'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"])',
      'select:not([disabled]):not([aria-hidden="true"])',
      'textarea:not([disabled]):not([aria-hidden="true"])',
      '[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])',
      '[role="button"]:not([aria-disabled="true"]):not([aria-hidden="true"])',
      '[role="treeitem"]:not([aria-hidden="true"])',
      '[role="menuitem"]:not([aria-hidden="true"])',
      '[role="tab"]:not([aria-hidden="true"])',
    ].join(', ');

    const nodes = Array.from(container.querySelectorAll<HTMLElement>(selector));
    return nodes.filter((el) => {
      // Must not be hidden by display: none or visibility: hidden
      if (el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0) {
        return true;
      }
      // jsdom environment fallback where offsetParent is null for all elements
      return el.style.display !== 'none' && el.style.visibility !== 'hidden';
    });
  }

  /**
   * Sets up a strict modal focus trap within container
   */
  public trapFocus(container: HTMLElement, options: FocusTrapOptions = {}): () => void {
    const prevFocused = options.returnFocusElement !== undefined
      ? options.returnFocusElement
      : (document.activeElement as HTMLElement | null);

    const focusables = this.findFocusableElements(container);
    const initialTarget = options.initialFocusElement || focusables[0] || container;

    if (options.autoFocus !== false && initialTarget) {
      setTimeout(() => {
        if (document.body.contains(initialTarget)) {
          initialTarget.focus();
        }
      }, 30);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (options.onEscape) {
          e.preventDefault();
          e.stopPropagation();
          options.onEscape();
        }
        return;
      }

      if (e.key === 'Tab') {
        const currentFocusables = this.findFocusableElements(container);
        if (currentFocusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = currentFocusables[0];
        const last = currentFocusables[currentFocusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !container.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      if (prevFocused && document.body.contains(prevFocused)) {
        try {
          prevFocused.focus();
        } catch {
          // ignore error if previous element unmounted
        }
      }
    };
  }

  /**
   * Emits an accessible text announcement for screen readers
   */
  public announce(message: string, mode: AriaLiveMode = 'polite'): void {
    if (!message.trim()) return;

    const announcement: AnnouncementMessage = {
      id: `ann-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      message: message.trim(),
      mode,
      timestamp: Date.now(),
    };

    this.announcements.push(announcement);
    if (this.announcements.length > 10) {
      this.announcements.shift();
    }

    this.notify();
  }

  public getAnnouncements(): AnnouncementMessage[] {
    return [...this.announcements];
  }

  public subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notify(): void {
    this.subscribers.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        logger.error('FocusManager listener threw error', { error: err });
      }
    });
  }
}

export const globalFocusManager = new FocusManager();
