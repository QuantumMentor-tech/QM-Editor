/**
 * QM Editor Terminal Service Implementation
 * Phase 1, Step 19 — Integrated Terminal & Safe Process Execution Foundation
 */

import { CreateSessionOptions } from './TerminalTypes';
import { TerminalSession } from './TerminalSession';
import { defaultPtyAdapter } from './PtyAdapter';
import { logger } from '../../utils/logger';

export const MAX_TERMINAL_SESSIONS = 8;

export class TerminalService {
  private sessions: Map<string, TerminalSession> = new Map();
  private activeSessionId: string | null = null;
  private listeners: Set<() => void> = new Set();

  public getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  public getActiveSession(): TerminalSession | undefined {
    if (!this.activeSessionId) return undefined;
    return this.sessions.get(this.activeSessionId);
  }

  public getAllSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  public getSession(id: string): TerminalSession | undefined {
    return this.sessions.get(id);
  }

  public async createSession(options: CreateSessionOptions = {}): Promise<TerminalSession> {
    if (this.sessions.size >= MAX_TERMINAL_SESSIONS) {
      logger.warn('Max terminal sessions limit reached', { max: MAX_TERMINAL_SESSIONS });
      const active = this.getActiveSession();
      if (active) return active;
    }

    const session = new TerminalSession(options, defaultPtyAdapter);
    await session.start();

    this.sessions.set(session.getId(), session);
    this.activeSessionId = session.getId();

    session.subscribe(() => {
      this.notifyListeners();
    });

    this.notifyListeners();
    logger.info('Created new terminal session', { id: session.getId(), title: session.getTitle() });
    return session;
  }

  public setActiveSession(id: string): void {
    if (this.sessions.has(id)) {
      this.activeSessionId = id;
      this.notifyListeners();
    }
  }

  public async closeSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (!session) return;

    await session.dispose();
    this.sessions.delete(id);

    if (this.activeSessionId === id) {
      const remaining = Array.from(this.sessions.keys());
      this.activeSessionId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    }

    this.notifyListeners();
    logger.info('Closed terminal session', { id });
  }

  public async closeActiveSession(): Promise<void> {
    if (this.activeSessionId) {
      await this.closeSession(this.activeSessionId);
    }
  }

  public clearActiveSession(): void {
    const active = this.getActiveSession();
    if (active) {
      active.clear();
    }
  }

  public nextSession(): void {
    const ids = Array.from(this.sessions.keys());
    if (ids.length <= 1 || !this.activeSessionId) return;

    const currentIndex = ids.indexOf(this.activeSessionId);
    const nextIndex = (currentIndex + 1) % ids.length;
    this.setActiveSession(ids[nextIndex]);
  }

  public previousSession(): void {
    const ids = Array.from(this.sessions.keys());
    if (ids.length <= 1 || !this.activeSessionId) return;

    const currentIndex = ids.indexOf(this.activeSessionId);
    const prevIndex = (currentIndex - 1 + ids.length) % ids.length;
    this.setActiveSession(ids[prevIndex]);
  }

  public async disposeAll(): Promise<void> {
    const sessionList = Array.from(this.sessions.values());
    for (const s of sessionList) {
      await s.dispose();
    }
    this.sessions.clear();
    this.activeSessionId = null;
    this.notifyListeners();
    logger.info('All terminal sessions disposed');
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        logger.error('Error in TerminalService listener', { error: (err as Error).message });
      }
    });
  }
}

export const terminalService = new TerminalService();
