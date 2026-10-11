/**
 * QM Editor Accessibility Types
 * Phase 03, Step 24 — Accessibility, Focus Management, Keyboard Navigation & Interaction Foundation
 */

export type FocusScope =
  | 'application'
  | 'editor'
  | 'explorer'
  | 'terminal'
  | 'dialog'
  | 'menu'
  | 'contextMenu'
  | 'commandPalette'
  | 'quickOpen'
  | 'settings'
  | 'search'
  | 'sourceControl'
  | 'tasks'
  | 'problems';

export interface FocusHistoryEntry {
  scope: FocusScope;
  element: HTMLElement | null;
  timestamp: number;
  descriptor?: string;
}

export interface FocusTrapOptions {
  initialFocusElement?: HTMLElement | null;
  returnFocusElement?: HTMLElement | null;
  onEscape?: () => void;
  autoFocus?: boolean;
}

export type AriaLiveMode = 'off' | 'polite' | 'assertive';

export interface AnnouncementMessage {
  id: string;
  message: string;
  mode: AriaLiveMode;
  timestamp: number;
}
