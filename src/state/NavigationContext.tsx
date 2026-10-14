import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { NavigationService, globalNavigationService } from '../services/NavigationService';
import { EditorLocation, NavigationHistoryState } from '../types';
import { globalNavigationCoordinator } from '../core/navigation';

export interface NavigationContextApi {
  currentPos: { line: number; column: number };
  setCurrentPos: (pos: { line: number; column: number }) => void;
  pushLocation: (location: EditorLocation) => void;
  navigateBack: () => EditorLocation | null;
  navigateForward: () => EditorLocation | null;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  historyState: NavigationHistoryState;
}

const NavigationContext = createContext<NavigationContextApi | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navServiceRef = useRef<NavigationService>(globalNavigationService);
  const [currentPos, setCurrentPosState] = useState<{ line: number; column: number }>({ line: 1, column: 1 });
  const [historyState, setHistoryState] = useState<NavigationHistoryState>(() => navServiceRef.current.getState());

  const syncState = useCallback(() => {
    setHistoryState(navServiceRef.current.getState());
  }, []);

  // Sync state whenever NavigationCoordinator completes a navigation jump
  useEffect(() => {
    const unregister = globalNavigationCoordinator.on('navigation.completed', (payload) => {
      syncState();
      if (payload.location.range) {
        setCurrentPosState({
          line: payload.location.range.startLine,
          column: payload.location.range.startColumn,
        });
      }
    });

    return unregister;
  }, [syncState]);

  const setCurrentPos = useCallback((pos: { line: number; column: number }) => {
    setCurrentPosState(pos);
  }, []);

  const pushLocation = useCallback((location: EditorLocation) => {
    navServiceRef.current.pushLocation(location);
    syncState();
  }, [syncState]);

  const navigateBack = useCallback(() => {
    const target = navServiceRef.current.navigateBack();
    syncState();
    return target;
  }, [syncState]);

  const navigateForward = useCallback(() => {
    const target = navServiceRef.current.navigateForward();
    syncState();
    return target;
  }, [syncState]);

  return (
    <NavigationContext.Provider
      value={{
        currentPos,
        setCurrentPos,
        pushLocation,
        navigateBack,
        navigateForward,
        canNavigateBack: historyState.backStack.length > 0,
        canNavigateForward: historyState.forwardStack.length > 0,
        historyState,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextApi => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
