/**
 * QM Editor Accessibility Context & Hook
 * Phase 03, Step 24 — Accessibility, Focus Management, Keyboard Navigation & Interaction Foundation
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  FocusManager,
  globalFocusManager,
} from '../core/accessibility/FocusManager';
import {
  FocusScope,
  AriaLiveMode,
  AnnouncementMessage,
} from '../core/accessibility/AccessibilityTypes';

export interface AccessibilityContextApi {
  focusManager: FocusManager;
  currentScope: FocusScope;
  announcements: AnnouncementMessage[];
  pushScope: (scope: FocusScope, returnElement?: HTMLElement | null) => () => void;
  popScope: () => boolean;
  focusRegion: (region: FocusScope) => boolean;
  announce: (message: string, mode?: AriaLiveMode) => void;
}

const AccessibilityContext = createContext<AccessibilityContextApi | undefined>(undefined);

export const AccessibilityProvider: React.FC<{
  children: React.ReactNode;
  focusManager?: FocusManager;
}> = ({ children, focusManager = globalFocusManager }) => {
  const [currentScope, setCurrentScope] = useState<FocusScope>(() => focusManager.getCurrentScope());
  const [announcements, setAnnouncements] = useState<AnnouncementMessage[]>(() =>
    focusManager.getAnnouncements()
  );

  useEffect(() => {
    const unsubscribe = focusManager.subscribe(() => {
      setCurrentScope(focusManager.getCurrentScope());
      setAnnouncements(focusManager.getAnnouncements());
    });
    return unsubscribe;
  }, [focusManager]);

  const api: AccessibilityContextApi = useMemo(
    () => ({
      focusManager,
      currentScope,
      announcements,
      pushScope: (scope, returnEl) => focusManager.pushScope(scope, returnEl),
      popScope: () => focusManager.popScope(),
      focusRegion: (region) => focusManager.focusRegion(region),
      announce: (msg, mode) => focusManager.announce(msg, mode),
    }),
    [focusManager, currentScope, announcements]
  );

  return <AccessibilityContext.Provider value={api}>{children}</AccessibilityContext.Provider>;
};

export const useAccessibility = (): AccessibilityContextApi => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};
