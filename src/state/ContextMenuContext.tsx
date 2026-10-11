import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export interface ContextMenuState {
  isOpen: boolean;
  surfaceId: string;
  position: { x: number; y: number };
  target?: any;
}

export interface ContextMenuContextApi {
  menuState: ContextMenuState;
  openContextMenu: (surfaceId: string, position: { x: number; y: number }, target?: any) => void;
  closeContextMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextApi | undefined>(undefined);

export const ContextMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [menuState, setMenuState] = useState<ContextMenuState>({
    isOpen: false,
    surfaceId: '',
    position: { x: 0, y: 0 },
    target: undefined,
  });

  const previousFocusRef = useRef<HTMLElement | null>(null);

  const openContextMenu = useCallback(
    (surfaceId: string, position: { x: number; y: number }, target?: any) => {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setMenuState({
        isOpen: true,
        surfaceId,
        position,
        target,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setMenuState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
    if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, []);

  return (
    <ContextMenuContext.Provider
      value={{
        menuState,
        openContextMenu,
        closeContextMenu,
      }}
    >
      {children}
    </ContextMenuContext.Provider>
  );
};

export const useContextMenu = (): ContextMenuContextApi => {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error('useContextMenu must be used within a ContextMenuProvider');
  }
  return context;
};
