/**
 * QM Editor Terminal Context & React Provider
 * Phase 1, Step 19 — Integrated Terminal & Safe Process Execution Foundation
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { CreateSessionOptions, TerminalSessionModel } from '../core/terminal/TerminalTypes';
import { TerminalSession } from '../core/terminal/TerminalSession';
import { terminalService } from '../core/terminal/TerminalService';

export interface TerminalContextApi {
  sessions: TerminalSessionModel[];
  activeSessionId: string | null;
  activeSession: TerminalSession | undefined;
  createTerminal: (options?: CreateSessionOptions) => Promise<TerminalSession>;
  closeTerminal: (id: string) => Promise<void>;
  switchTerminal: (id: string) => void;
  clearActiveTerminal: () => void;
  renameTerminal: (id: string, title: string) => void;
  writeToActive: (data: string) => Promise<void>;
}

const TerminalContext = createContext<TerminalContextApi | undefined>(undefined);

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<TerminalSessionModel[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const syncState = useCallback(() => {
    const all = terminalService.getAllSessions();
    setSessions(all.map((s) => s.getModel()));
    setActiveSessionId(terminalService.getActiveSessionId());
  }, []);

  useEffect(() => {
    const unsubscribe = terminalService.subscribe(syncState);
    syncState();
    return unsubscribe;
  }, [syncState]);

  const createTerminal = useCallback(async (options?: CreateSessionOptions) => {
    return await terminalService.createSession(options);
  }, []);

  const closeTerminal = useCallback(async (id: string) => {
    await terminalService.closeSession(id);
  }, []);

  const switchTerminal = useCallback((id: string) => {
    terminalService.setActiveSession(id);
  }, []);

  const clearActiveTerminal = useCallback(() => {
    terminalService.clearActiveSession();
  }, []);

  const renameTerminal = useCallback((id: string, title: string) => {
    const session = terminalService.getSession(id);
    if (session) {
      session.setTitle(title);
    }
  }, []);

  const writeToActive = useCallback(async (data: string) => {
    const active = terminalService.getActiveSession();
    if (active) {
      await active.write(data);
    }
  }, []);

  const activeSession = terminalService.getActiveSession();

  return (
    <TerminalContext.Provider
      value={{
        sessions,
        activeSessionId,
        activeSession,
        createTerminal,
        closeTerminal,
        switchTerminal,
        clearActiveTerminal,
        renameTerminal,
        writeToActive,
      }}
    >
      {children}
    </TerminalContext.Provider>
  );
};

export const useTerminal = (): TerminalContextApi => {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
};
